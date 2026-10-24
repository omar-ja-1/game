/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CompanionRobot } from './CompanionRobot';
import { BillboardSharedResources, HologramBillboard } from './HologramBillboard';
import { SharedTexturePool, createFloorGridTexture } from './proceduralAssets';
import {
  MAX_AMBIENT_DUST_PARTICLES,
  QUALITY_PROFILES,
  QualityProfile,
  RuntimeQualityGovernor,
  computeEffectivePixelRatio,
  gatherDeviceCapabilitySignals,
  resolveQualityProfile,
} from './qualityConfig';
import { INITIAL_ORBS } from '../data/portfolioData';
import { clampToPlazaBounds, isWithinProximity, distanceXZ } from '../game/portfolioLogic';
import { ZoneLayoutResult } from '../game/zoneLayout';
import { synthAudio } from '../audio/synthAudio';
import {
  CameraMode,
  CollectibleOrbData,
  GameState,
  PerfDiagnostics,
  QualityPreference,
  QualityTier,
  RenderActivityMode,
  WorldBillboardNode,
  ZoneId,
} from '../types/portfolio';
import { isWebGLSupported } from './webglCheck';

export interface WorldCallbacks {
  onActivateNode: (node: WorldBillboardNode, meta?: { fromUserGesture?: boolean }) => void;
  onOrbCollected: (orb: CollectibleOrbData, index: number, totalCollected: number) => void;
  onNearNodeChange: (node: WorldBillboardNode | null) => void;
  onStateChange: (state: GameState) => void;
  onReturnHubShortcut?: () => void;
  onCameraModeChange?: (mode: CameraMode) => void;
  onToggleMute?: () => void;
  onToggleDock?: () => void;
  onQualityResolved?: (tier: QualityTier, preference: QualityPreference) => void;
  onLowPerformanceSuggestion?: () => void;
  onPerfDiagnostics?: (stats: PerfDiagnostics) => void;
}

export interface WorldSceneOptions {
  initialQualityPreference?: QualityPreference;
  enablePerfDiagnostics?: boolean;
  initialZoneLayout: ZoneLayoutResult;
}

interface OrbEntity {
  data: CollectibleOrbData;
  mesh: THREE.Group;
  light: THREE.PointLight;
  glowMat: THREE.MeshBasicMaterial;
  collected: boolean;
}

const HUB_BEACON_NODE: WorldBillboardNode = {
  id: 'hub-central-beacon',
  zone: 'hub',
  kind: 'beacon',
  kicker: 'Central Monument',
  title: 'Frequency Beacon & Guestbook',
  subtitle: 'Plaza Centerpiece & Harmonic Core',
  summaryLines: ['Collect all 5 energy orbs across the Main Plaza to awaken the skyward beam.'],
  footerMeta: '5 Energy Cores · Visitor Signal Log',
  promptLabel: 'OPEN CENTRAL BEACON',
  accentColor: '#f59e0b',
  glowColor: 0xf59e0b,
  position: [0, 0, 0],
  rotationY: 0,
  action: { type: 'open_modal', modal: { type: 'beacon' } },
};

const IS_SOFTWARE_GL = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const gl =
      document.createElement('canvas').getContext('webgl2') ||
      document.createElement('canvas').getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

const PYLON_COUNT = 20;
const _dummyObj = new THREE.Object3D();

export class WorldScene {
  public container: HTMLElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public robot: CompanionRobot;
  public billboards: HologramBillboard[] = [];
  public orbs: OrbEntity[] = [];
  public beaconGroup: THREE.Group;
  public isBeaconActive: boolean = false;
  public isSimulationActive: boolean = false;

  public virtualMoveX: number = 0;
  public virtualMoveZ: number = 0;

  private isSoftwareGl: boolean = IS_SOFTWARE_GL;
  private prefersReducedMotion: boolean = false;
  private qualityPreference: QualityPreference;
  private qualityProfile: QualityProfile;
  private qualityGovernor: RuntimeQualityGovernor;
  private adaptiveDprScale: number = 1.0;
  private renderActivityMode: RenderActivityMode = 'throttled';
  private enablePerfDiagnostics: boolean;

  private currentZone: ZoneId = 'hub';
  private currentBoundsRadius: number = 36;
  private savedHubState: {
    x: number;
    z: number;
    rotY: number;
    orbitAngleX: number;
  } | null = null;

  private animFrameId: number = 0;
  private throttleTimerId: number = 0;
  private isLoopScheduled: boolean = false;
  private staticRenderQueued: boolean = false;
  private isContextLost: boolean = false;
  private isDisposed: boolean = false;

  private texturePool: SharedTexturePool = new SharedTexturePool();
  private billboardShared!: BillboardSharedResources;
  private envTexture: THREE.Texture | null = null;
  private floorTexture: THREE.CanvasTexture;
  private floorStandardMat: THREE.MeshStandardMaterial;
  private floorLightweightMat: THREE.MeshLambertMaterial;
  private floorMesh: THREE.Mesh;
  private currentFloorTexSize: number;

  private pylonInstanced!: THREE.InstancedMesh;
  private tipInstanced!: THREE.InstancedMesh;
  private pylonTipMat!: THREE.MeshBasicMaterial;

  private dirLight: THREE.DirectionalLight;
  private plazaFill: THREE.PointLight;
  private ambientDust!: THREE.Points;

  private beaconBaseCyl!: THREE.Mesh;
  private beaconBeam!: THREE.Mesh;
  private beaconRings: THREE.Mesh[] = [];
  private beaconLight!: THREE.PointLight;

  public cameraMode: CameraMode = 'follow';
  private cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 1.2, 0);
  private cameraCurrentPos: THREE.Vector3 = new THREE.Vector3(0, 3.8, 12);
  private orbitAngleX: number = 0;
  private orbitAngleY: number = 0.35;
  private isDraggingMouse: boolean = false;
  private activeCameraTouchId: number | null = null;
  private prevPointerX: number = 0;
  private prevPointerY: number = 0;
  private pointerDownX: number = 0;
  private pointerDownY: number = 0;
  private pointerDownAt: number = 0;

  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private pointerNdc: THREE.Vector2 = new THREE.Vector2();
  private billboardDistBuffer: Array<{ index: number; distSq: number }> = [];

  private keysPressed: Set<string> = new Set();
  private callbacks: WorldCallbacks;
  private nearestNode: WorldBillboardNode | null = null;
  private collectedOrbCount: number = 0;
  private lastTime: number = performance.now();
  private elapsedSec: number = 0;
  private frameIndex: number = 0;

  private perfFrameCount: number = 0;
  private perfFrameMsSum: number = 0;
  private perfWindowStart: number = performance.now();

  private ownedGeometries: THREE.BufferGeometry[] = [];
  private ownedMaterials: THREE.Material[] = [];

  constructor(container: HTMLElement, callbacks: WorldCallbacks, options: WorldSceneOptions) {
    this.container = container;
    this.callbacks = callbacks;
    this.qualityPreference = options.initialQualityPreference ?? 'auto';
    const signals = gatherDeviceCapabilitySignals();
    this.prefersReducedMotion = signals.prefersReducedMotion;
    this.qualityProfile = resolveQualityProfile(this.qualityPreference);
    this.qualityGovernor = new RuntimeQualityGovernor(this.qualityProfile.tier);
    this.enablePerfDiagnostics = options.enablePerfDiagnostics ?? false;

    if (!isWebGLSupported()) {
      throw new Error('WebGL is not supported or disabled in this browser environment');
    }

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && this.qualityProfile.antialias,
      powerPreference: this.qualityProfile.tier === 'low' ? 'default' : 'high-performance',
      alpha: false,
      stencil: false,
    });

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.getEffectivePixelRatio());
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.qualityProfile.shadowsEnabled;
    this.renderer.shadowMap.type =
      this.qualityProfile.shadowMapType === 'pcf-soft'
        ? THREE.PCFSoftShadowMap
        : THREE.PCFShadowMap;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    // Scene & Atmosphere
    this.scene = new THREE.Scene();
    const bgDark = new THREE.Color(options.initialZoneLayout.theme.fogHex);
    this.scene.background = bgDark;
    this.scene.fog = new THREE.FogExp2(
      options.initialZoneLayout.theme.fogHex,
      options.initialZoneLayout.theme.fogDensity
    );

    // Camera
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 140);
    this.camera.position.set(0, 3.8, 12.5);

    // Studio Reflections via PMREMGenerator & RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    this.scene.environment = this.envTexture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0x1e293b, 0x070b14, 0.9);
    this.scene.add(hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff1e6, 1.35);
    this.dirLight.position.set(16, 24, 12);
    this.dirLight.castShadow = !this.isSoftwareGl && this.qualityProfile.shadowsEnabled;
    this.dirLight.shadow.mapSize.set(
      this.qualityProfile.shadowMapSize,
      this.qualityProfile.shadowMapSize
    );
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 60;
    const d = 30;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);

    this.plazaFill = new THREE.PointLight(0x06b6d4, 1.2, 35);
    this.plazaFill.position.set(0, 8, 0);
    this.plazaFill.visible = this.qualityProfile.enablePlazaFillLight;
    this.scene.add(this.plazaFill);

    // Ground (dual material setup: PBR Standard on Medium/High, lightweight Lambert on Low)
    const floorGeo = this.trackGeometry(new THREE.PlaneGeometry(160, 160));
    this.currentFloorTexSize = this.qualityProfile.floorTextureSize;
    this.floorTexture = createFloorGridTexture(
      this.renderer.capabilities.getMaxAnisotropy(),
      this.currentFloorTexSize,
      this.qualityProfile.maxAnisotropyCap
    );
    this.floorTexture.repeat.set(28, 28);

    this.floorStandardMat = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x090d16,
        map: this.floorTexture,
        roughness: 0.28,
        metalness: 0.65,
      })
    );

    this.floorLightweightMat = this.trackMaterial(
      new THREE.MeshLambertMaterial({
        color: 0x101827,
        map: this.floorTexture,
        emissive: 0x0b1526,
        emissiveMap: this.floorTexture,
        emissiveIntensity: 0.85,
      })
    );

    this.floorMesh = new THREE.Mesh(
      floorGeo,
      this.qualityProfile.useLightweightFloor ? this.floorLightweightMat : this.floorStandardMat
    );
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = 0;
    this.floorMesh.receiveShadow = !this.isSoftwareGl && this.qualityProfile.shadowsEnabled;
    this.scene.add(this.floorMesh);

    // Instanced Perimeter Boundary Pylons
    this.createPerimeterPylons(options.initialZoneLayout.boundsRadius + 2.5);

    // Central Beacon Spire
    this.beaconGroup = this.createCentralBeacon();
    this.scene.add(this.beaconGroup);

    // Companion Robot
    this.robot = new CompanionRobot(this.texturePool.getContactShadowTexture());
    this.robot.applyQuality(this.qualityProfile, this.isSoftwareGl);
    this.scene.add(this.robot.group);

    // Shared Billboard Resources & Collectible Orbs & Ambient Dust
    this.billboardShared = HologramBillboard.createSharedResources(this.texturePool);
    this.createCollectibleOrbs();
    this.createAmbientDust();

    // Populate initial zone layout
    this.applyZoneLayout(options.initialZoneLayout, { immediateSnap: true });

    // Bind events
    this.bindEvents();

    this.callbacks.onQualityResolved?.(this.qualityProfile.tier, this.qualityPreference);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.updateCamera(0.016, true);
    this.renderSingleFrame();
    this.syncLoopState();
  }

  private trackGeometry<T extends THREE.BufferGeometry>(geo: T): T {
    this.ownedGeometries.push(geo);
    return geo;
  }

  private trackMaterial<T extends THREE.Material>(mat: T): T {
    this.ownedMaterials.push(mat);
    return mat;
  }

  private getEffectivePixelRatio(): number {
    return computeEffectivePixelRatio(
      this.qualityProfile,
      gatherDeviceCapabilitySignals(),
      this.adaptiveDprScale,
      this.isSoftwareGl
    );
  }

  public getQualityTier(): QualityTier {
    return this.qualityProfile.tier;
  }

  public setQualityPreference(preference: QualityPreference) {
    this.qualityPreference = preference;
    this.adaptiveDprScale = 1.0;
    const nextProfile = resolveQualityProfile(preference);
    this.qualityGovernor.reset(nextProfile.tier);
    this.applyQualityProfile(nextProfile);
    this.callbacks.onQualityResolved?.(nextProfile.tier, preference);
  }

  private applyQualityProfile(profile: QualityProfile) {
    const prevShadows = !this.isSoftwareGl && this.qualityProfile.shadowsEnabled;
    const prevLightsKey = `${this.qualityProfile.enableBillboardLights}-${this.qualityProfile.enableOrbLights}-${this.qualityProfile.enablePlazaFillLight}-${this.qualityProfile.enableRobotHeartLight}`;

    this.qualityProfile = profile;

    this.renderer.setPixelRatio(this.getEffectivePixelRatio());
    const nextShadows = !this.isSoftwareGl && profile.shadowsEnabled;
    this.renderer.shadowMap.enabled = nextShadows;
    this.renderer.shadowMap.type =
      profile.shadowMapType === 'pcf-soft' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

    this.dirLight.castShadow = nextShadows;
    if (this.dirLight.shadow.mapSize.width !== profile.shadowMapSize) {
      this.dirLight.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
      if (this.dirLight.shadow.map) {
        this.dirLight.shadow.map.dispose();
        this.dirLight.shadow.map = null;
      }
    }

    // Swap lightweight vs PBR floor material cleanly
    const desiredFloorMat = profile.useLightweightFloor
      ? this.floorLightweightMat
      : this.floorStandardMat;
    if (this.floorMesh.material !== desiredFloorMat) {
      this.floorMesh.material = desiredFloorMat;
    }
    this.floorMesh.receiveShadow = nextShadows && !profile.useLightweightFloor;
    this.beaconBaseCyl.receiveShadow = nextShadows;

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    if (this.currentFloorTexSize !== profile.floorTextureSize) {
      this.currentFloorTexSize = profile.floorTextureSize;
      const oldFloorTex = this.floorTexture;
      this.floorTexture = createFloorGridTexture(
        maxAniso,
        this.currentFloorTexSize,
        profile.maxAnisotropyCap
      );
      this.floorTexture.repeat.set(28, 28);
      this.floorStandardMat.map = this.floorTexture;
      this.floorStandardMat.needsUpdate = true;
      this.floorLightweightMat.map = this.floorTexture;
      this.floorLightweightMat.emissiveMap = this.floorTexture;
      this.floorLightweightMat.needsUpdate = true;
      oldFloorTex.dispose();
    } else {
      this.floorTexture.anisotropy = Math.min(maxAniso, profile.maxAnisotropyCap);
    }

    this.plazaFill.visible = profile.enablePlazaFillLight;
    this.robot.applyQuality(profile, this.isSoftwareGl);

    this.billboards.forEach((bb) => {
      bb.applyQuality(profile, maxAniso, this.isSoftwareGl);
    });

    const isHub = this.currentZone === 'hub';
    this.orbs.forEach((orb) => {
      if (!orb.collected && isHub) {
        orb.light.visible = profile.enableOrbLights;
        orb.glowMat.opacity = profile.enableOrbLights ? 0.22 : 0.62;
      } else {
        orb.light.visible = false;
      }
    });

    const dustCount = this.prefersReducedMotion ? 0 : profile.ambientDustCount;
    this.ambientDust.geometry.setDrawRange(0, dustCount);
    this.ambientDust.visible = dustCount > 0;

    const nextLightsKey = `${profile.enableBillboardLights}-${profile.enableOrbLights}-${profile.enablePlazaFillLight}-${profile.enableRobotHeartLight}`;
    if (prevShadows !== nextShadows || prevLightsKey !== nextLightsKey) {
      this.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => {
              m.needsUpdate = true;
            });
          } else if (mat) {
            mat.needsUpdate = true;
          }
        }
      });
    }

    this.requestStaticRender();
  }

  /**
   * Switches or refreshes the active portfolio zone within the single shared WebGL scene.
   */
  public applyZoneLayout(
    layout: ZoneLayoutResult,
    options?: { restoreHubPosition?: boolean; preservePosition?: boolean; immediateSnap?: boolean }
  ) {
    const prevZone = this.currentZone;
    const nextZone = layout.zone;

    if (prevZone === 'hub' && nextZone !== 'hub' && !options?.preservePosition) {
      this.savedHubState = {
        x: this.robot.group.position.x,
        z: this.robot.group.position.z,
        rotY: this.robot.group.rotation.y,
        orbitAngleX: this.orbitAngleX,
      };
    }

    // Dispose previous zone's dynamic billboard card textures cleanly
    for (let i = 0; i < this.billboards.length; i++) {
      const bb = this.billboards[i];
      this.scene.remove(bb.group);
      bb.dispose();
    }
    this.billboards.length = 0;

    this.currentZone = nextZone;
    this.currentBoundsRadius = layout.boundsRadius;

    // Update atmosphere & perimeter ring
    (this.scene.background as THREE.Color).setHex(layout.theme.fogHex);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.setHex(layout.theme.fogHex);
    fog.density = layout.theme.fogDensity;
    this.plazaFill.color.set(layout.theme.accentHex);
    this.pylonTipMat.color.set(layout.theme.accentHex);
    this.updatePerimeterPylonsRadius(layout.boundsRadius + 2.5);

    // Toggle hub-exclusive Spire & Collectible Orbs while preserving collection progress
    const isHub = nextZone === 'hub';
    this.beaconGroup.visible = isHub;
    this.beaconLight.visible = isHub;
    for (let i = 0; i < this.orbs.length; i++) {
      const orb = this.orbs[i];
      const showOrb = isHub && !orb.collected;
      orb.mesh.visible = showOrb;
      orb.light.visible = showOrb && this.qualityProfile.enableOrbLights;
    }

    // Spawn new zone's billboards using shared static geometry/material pools
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    for (let i = 0; i < layout.nodes.length; i++) {
      const bb = new HologramBillboard(
        layout.nodes[i],
        i,
        this.billboardShared,
        this.texturePool,
        this.qualityProfile,
        maxAniso,
        this.isSoftwareGl,
        () => this.requestStaticRender()
      );
      this.billboards.push(bb);
      this.scene.add(bb.group);
    }

    // Reposition player cleanly unless refreshing data in-place
    if (!options?.preservePosition) {
      this.keysPressed.clear();
      this.virtualMoveX = 0;
      this.virtualMoveZ = 0;
      this.robot.isMoving = false;
      this.robot.isJumping = false;
      this.robot.jumpVy = 0;

      if (isHub && options?.restoreHubPosition && this.savedHubState) {
        const clamped = clampToPlazaBounds(
          { x: this.savedHubState.x, z: this.savedHubState.z },
          layout.boundsRadius
        );
        this.robot.group.position.set(clamped.x, 0, clamped.z);
        this.robot.group.rotation.y = this.savedHubState.rotY;
        this.robot.targetRotationY = this.savedHubState.rotY;
        this.orbitAngleX = this.savedHubState.orbitAngleX;
      } else {
        const [sx, sy, sz] = layout.spawnPosition;
        this.robot.group.position.set(sx, sy, sz);
        this.robot.group.rotation.y = Math.PI;
        this.robot.targetRotationY = Math.PI;
        this.orbitAngleX = 0;
      }

      this.updateCamera(0.016, true);
    }

    // Re-evaluate nearby node immediately
    this.nearestNode = null;
    this.callbacks.onNearNodeChange(null);
    if (this.isSimulationActive || options?.immediateSnap) {
      this.checkProximities();
    }
    this.requestStaticRender();
  }

  private createPerimeterPylons(radius: number) {
    const pylonGeo = this.trackGeometry(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 10));
    const pylonMat = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x0c121d,
        roughness: 0.6,
        metalness: 0.4,
      })
    );
    const tipGeo = this.trackGeometry(new THREE.SphereGeometry(0.12, 8, 8));
    this.pylonTipMat = this.trackMaterial(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));

    this.pylonInstanced = new THREE.InstancedMesh(pylonGeo, pylonMat, PYLON_COUNT);
    this.tipInstanced = new THREE.InstancedMesh(tipGeo, this.pylonTipMat, PYLON_COUNT);

    this.updatePerimeterPylonsRadius(radius);

    this.scene.add(this.pylonInstanced);
    this.scene.add(this.tipInstanced);
  }

  private updatePerimeterPylonsRadius(radius: number) {
    for (let i = 0; i < PYLON_COUNT; i++) {
      const angle = (i / PYLON_COUNT) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      _dummyObj.position.set(x, 1.1, z);
      _dummyObj.rotation.set(0, 0, 0);
      _dummyObj.scale.set(1, 1, 1);
      _dummyObj.updateMatrix();
      this.pylonInstanced.setMatrixAt(i, _dummyObj.matrix);

      _dummyObj.position.set(x, 2.3, z);
      _dummyObj.updateMatrix();
      this.tipInstanced.setMatrixAt(i, _dummyObj.matrix);
    }

    this.pylonInstanced.instanceMatrix.needsUpdate = true;
    this.tipInstanced.instanceMatrix.needsUpdate = true;
    this.pylonInstanced.computeBoundingSphere();
    this.tipInstanced.computeBoundingSphere();
  }

  private createCentralBeacon(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    const darkMetal = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x0b101a,
        roughness: 0.5,
        metalness: 0.7,
      })
    );

    const amberMat = this.trackMaterial(new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
    const cyanMat = this.trackMaterial(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));

    const baseGeo = this.trackGeometry(new THREE.CylinderGeometry(3.2, 3.6, 0.35, 24));
    this.beaconBaseCyl = new THREE.Mesh(baseGeo, darkMetal);
    this.beaconBaseCyl.position.y = 0.17;
    this.beaconBaseCyl.receiveShadow = !this.isSoftwareGl && this.qualityProfile.shadowsEnabled;
    group.add(this.beaconBaseCyl);

    const coreRingGeo = this.trackGeometry(new THREE.TorusGeometry(2.8, 0.04, 8, 32));
    const coreRing = new THREE.Mesh(coreRingGeo, amberMat);
    coreRing.rotation.x = Math.PI / 2;
    coreRing.position.y = 0.36;
    group.add(coreRing);

    const pillarGeo = this.trackGeometry(new THREE.CylinderGeometry(0.55, 0.75, 4.2, 8));
    const pillar = new THREE.Mesh(pillarGeo, darkMetal);
    pillar.position.y = 2.4;
    group.add(pillar);

    [1.8, 2.6, 3.4].forEach((yPos, i) => {
      const ringGeo = this.trackGeometry(new THREE.TorusGeometry(1.2 - i * 0.15, 0.03, 8, 24));
      const ring = new THREE.Mesh(ringGeo, i % 2 === 0 ? cyanMat : amberMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = yPos;
      this.beaconRings.push(ring);
      group.add(ring);
    });

    const beamGeo = this.trackGeometry(new THREE.CylinderGeometry(0.4, 1.8, 45, 16, 1, true));
    const beamMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.beaconBeam = new THREE.Mesh(beamGeo, beamMat);
    this.beaconBeam.position.y = 22.5;
    this.beaconBeam.visible = false;
    group.add(this.beaconBeam);

    this.beaconLight = new THREE.PointLight(0xf59e0b, 1.5, 12);
    this.beaconLight.position.set(0, 3.5, 0);
    group.add(this.beaconLight);

    return group;
  }

  private createCollectibleOrbs() {
    const orbMat = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x083344,
        emissive: 0x22d3ee,
        emissiveIntensity: 2.0,
        roughness: 0.15,
        metalness: 0.8,
      })
    );

    const haloMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.35,
        wireframe: true,
      })
    );

    const shadowMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        map: this.texturePool.getContactShadowTexture(),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })
    );

    const sphereGeo = this.trackGeometry(new THREE.SphereGeometry(0.28, 14, 14));
    const haloGeo = this.trackGeometry(new THREE.IcosahedronGeometry(0.42, 0));
    const shadowGeo = this.trackGeometry(new THREE.PlaneGeometry(1.2, 1.2));
    const glowDecalGeo = this.trackGeometry(new THREE.PlaneGeometry(3.4, 3.4));

    INITIAL_ORBS.forEach((orbData) => {
      const orbGroup = new THREE.Group();
      orbGroup.position.set(...orbData.position);

      const sphere = new THREE.Mesh(sphereGeo, orbMat);
      orbGroup.add(sphere);

      const halo = new THREE.Mesh(haloGeo, haloMat);
      orbGroup.add(halo);

      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -orbData.position[1] + 0.015;
      orbGroup.add(shadow);

      const glowMat = this.trackMaterial(
        new THREE.MeshBasicMaterial({
          map: this.texturePool.getRadialGlowTexture(orbData.accentColor),
          transparent: true,
          opacity: this.qualityProfile.enableOrbLights ? 0.22 : 0.62,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
      );
      const glowDecal = new THREE.Mesh(glowDecalGeo, glowMat);
      glowDecal.rotation.x = -Math.PI / 2;
      glowDecal.position.y = -orbData.position[1] + 0.019;
      orbGroup.add(glowDecal);

      const light = new THREE.PointLight(0x22d3ee, 0.8, 4);
      light.visible = this.qualityProfile.enableOrbLights;
      orbGroup.add(light);

      this.scene.add(orbGroup);
      this.orbs.push({
        data: { ...orbData },
        mesh: orbGroup,
        light,
        glowMat,
        collected: false,
      });
    });
  }

  private createAmbientDust() {
    const dustGeo = this.trackGeometry(new THREE.BufferGeometry());
    const positions = new Float32Array(MAX_AMBIENT_DUST_PARTICLES * 3);
    for (let i = 0; i < MAX_AMBIENT_DUST_PARTICLES; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 8 + 0.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dustCount = this.prefersReducedMotion ? 0 : this.qualityProfile.ambientDustCount;
    dustGeo.setDrawRange(0, dustCount);

    const dustMat = this.trackMaterial(
      new THREE.PointsMaterial({
        color: 0x38bdf8,
        size: 0.055,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.ambientDust = new THREE.Points(dustGeo, dustMat);
    this.ambientDust.visible = dustCount > 0;
    this.scene.add(this.ambientDust);
  }

  public activateBeacon() {
    this.isBeaconActive = true;
    this.beaconBeam.visible = true;
    this.beaconLight.intensity = 4.0;
    this.beaconLight.color.setHex(0x22d3ee);
    synthAudio.playBeaconActivated();
  }

  public warpToNode(nodeId: string) {
    if (nodeId === 'hub-central-beacon' && this.currentZone === 'hub') {
      this.robot.group.position.set(0, 0, 3.8);
      this.robot.targetRotationY = Math.PI;
      this.robot.group.rotation.y = Math.PI;
      this.orbitAngleX = 0;
      this.updateCamera(0.016, true);
      this.checkProximities();
      synthAudio.playRobotChirp('curious');
      this.requestStaticRender();
      return;
    }

    const bb = this.billboards.find((b) => b.node.id === nodeId);
    if (!bb) return;

    const node = bb.node;
    const angle = node.rotationY;
    const offsetX = Math.sin(angle) * 3.4;
    const offsetZ = Math.cos(angle) * 3.4;

    const clamped = clampToPlazaBounds(
      { x: node.position[0] + offsetX, z: node.position[2] + offsetZ },
      this.currentBoundsRadius
    );
    this.robot.group.position.set(clamped.x, 0, clamped.z);
    this.robot.targetRotationY = angle + Math.PI;
    this.robot.group.rotation.y = angle + Math.PI;
    this.orbitAngleX = angle;
    this.robot.setEmotion('curious');
    this.updateCamera(0.016, true);
    this.checkProximities();
    synthAudio.playRobotChirp('curious');
    this.requestStaticRender();
  }

  public triggerRobotWave() {
    this.robot.triggerWave();
    synthAudio.playRobotChirp('wave');
  }

  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
    this.requestStaticRender();
  }

  public setRenderActivityMode(mode: RenderActivityMode) {
    if (this.renderActivityMode === mode) return;
    this.renderActivityMode = mode;

    if (mode === 'paused') {
      this.stopLoopTimers();
      this.requestStaticRender();
    } else {
      this.lastTime = performance.now();
      this.syncLoopState();
    }
  }

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('resize', this.onResize);

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);

    dom.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.onTouchEnd, { passive: true });

    dom.addEventListener('webglcontextlost', this.onContextLost, false);
    dom.addEventListener('webglcontextrestored', this.onContextRestored, false);
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.isContextLost = true;
    this.stopLoopTimers();
  };

  private onContextRestored = () => {
    this.isContextLost = false;
    this.lastTime = performance.now();
    this.syncLoopState();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }
    if (!this.isSimulationActive) {
      return;
    }

    const key = e.key.toLowerCase();
    this.keysPressed.add(key);

    if (e.code === 'Space') {
      e.preventDefault();
      if (!this.robot.isJumping) {
        this.robot.isJumping = true;
        this.robot.jumpVy = 8.5;
        synthAudio.playJump();
      }
    } else if (key === 'e') {
      e.preventDefault();
      this.handleInteract(true);
    } else if (key === 'backspace' && this.currentZone !== 'hub') {
      e.preventDefault();
      this.callbacks.onReturnHubShortcut?.();
    } else if (key === 'q') {
      e.preventDefault();
      this.triggerRobotWave();
    } else if (key === 'c') {
      e.preventDefault();
      const nextMode: CameraMode = this.cameraMode === 'follow' ? 'orbit' : 'follow';
      this.setCameraMode(nextMode);
      this.callbacks.onCameraModeChange?.(nextMode);
    } else if (key === 'm') {
      e.preventDefault();
      if (this.callbacks.onToggleMute) {
        this.callbacks.onToggleMute();
      } else {
        synthAudio.toggleMute();
      }
    } else if (key === 'h') {
      e.preventDefault();
      this.callbacks.onToggleDock?.();
    } else if (key === 'escape' || key === 'p') {
      e.preventDefault();
      this.callbacks.onStateChange('paused');
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysPressed.delete(e.key.toLowerCase());
  };

  private onWindowBlur = () => {
    this.keysPressed.clear();
    this.isDraggingMouse = false;
    this.activeCameraTouchId = null;
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.keysPressed.clear();
      this.virtualMoveX = 0;
      this.virtualMoveZ = 0;
      this.isDraggingMouse = false;
      this.activeCameraTouchId = null;
      this.stopLoopTimers();
    } else {
      this.lastTime = performance.now();
      this.syncLoopState();
      if (this.renderActivityMode === 'paused') {
        this.requestStaticRender();
      }
    }
  };

  private tryRaycastNearbyBillboard(clientX: number, clientY: number) {
    if (!this.isSimulationActive || this.billboards.length === 0) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    // Only raycast against nearby billboards so walking is respected & cost stays O(1)
    const nearbyProxies: THREE.Object3D[] = [];
    for (let i = 0; i < this.billboards.length; i++) {
      if (this.billboards[i].isPlayerNearby) {
        nearbyProxies.push(this.billboards[i].hitProxyMesh);
      }
    }
    if (nearbyProxies.length === 0) return;

    const hits = this.raycaster.intersectObjects(nearbyProxies, false);
    if (hits.length > 0) {
      const hitNode = hits[0].object.userData.billboardNode as WorldBillboardNode | undefined;
      if (hitNode) {
        synthAudio.playHologramScan();
        this.callbacks.onActivateNode(hitNode, { fromUserGesture: true });
      }
    }
  }

  private onMouseDown = (e: MouseEvent) => {
    this.isDraggingMouse = true;
    this.prevPointerX = e.clientX;
    this.prevPointerY = e.clientY;
    this.pointerDownX = e.clientX;
    this.pointerDownY = e.clientY;
    this.pointerDownAt = performance.now();
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDraggingMouse) return;
    const dx = e.clientX - this.prevPointerX;
    const dy = e.clientY - this.prevPointerY;
    this.prevPointerX = e.clientX;
    this.prevPointerY = e.clientY;

    this.orbitAngleX -= dx * 0.006;
    this.orbitAngleY = Math.max(0.1, Math.min(1.2, this.orbitAngleY + dy * 0.005));
  };

  private onMouseUp = (e: MouseEvent) => {
    if (!this.isDraggingMouse) return;
    this.isDraggingMouse = false;

    const moved = Math.hypot(e.clientX - this.pointerDownX, e.clientY - this.pointerDownY);
    const elapsed = performance.now() - this.pointerDownAt;
    if (moved < 6 && elapsed < 260 && e.target === this.renderer.domElement) {
      this.tryRaycastNearbyBillboard(e.clientX, e.clientY);
    }
  };

  private onTouchStart = (e: TouchEvent) => {
    if (this.activeCameraTouchId !== null || e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    this.activeCameraTouchId = touch.identifier;
    this.prevPointerX = touch.clientX;
    this.prevPointerY = touch.clientY;
    this.pointerDownX = touch.clientX;
    this.pointerDownY = touch.clientY;
    this.pointerDownAt = performance.now();
  };

  private onTouchMove = (e: TouchEvent) => {
    if (this.activeCameraTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.activeCameraTouchId) {
        const dx = touch.clientX - this.prevPointerX;
        const dy = touch.clientY - this.prevPointerY;
        this.prevPointerX = touch.clientX;
        this.prevPointerY = touch.clientY;

        this.orbitAngleX -= dx * 0.006;
        this.orbitAngleY = Math.max(0.1, Math.min(1.2, this.orbitAngleY + dy * 0.005));
        break;
      }
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (this.activeCameraTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.activeCameraTouchId) {
        this.activeCameraTouchId = null;
        const moved = Math.hypot(
          touch.clientX - this.pointerDownX,
          touch.clientY - this.pointerDownY
        );
        const elapsed = performance.now() - this.pointerDownAt;
        if (moved < 10 && elapsed < 260) {
          this.tryRaycastNearbyBillboard(touch.clientX, touch.clientY);
        }
        break;
      }
    }
  };

  private onResize = () => {
    if (!this.container || this.isDisposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.getEffectivePixelRatio());
    this.renderer.setSize(width, height);

    if (this.qualityPreference === 'auto') {
      const autoProfile = resolveQualityProfile('auto');
      if (autoProfile.tier !== this.qualityProfile.tier) {
        this.adaptiveDprScale = 1.0;
        this.qualityGovernor.reset(autoProfile.tier);
        this.applyQualityProfile(autoProfile);
        this.callbacks.onQualityResolved?.(autoProfile.tier, 'auto');
        return;
      }
    }

    this.requestStaticRender();
  };

  private handleInteract(fromUserGesture: boolean = false) {
    if (this.nearestNode) {
      synthAudio.playHologramScan();
      this.callbacks.onActivateNode(this.nearestNode, { fromUserGesture });
    }
  }

  public setSimulationActive(active: boolean) {
    this.isSimulationActive = active;
    if (!active) {
      this.keysPressed.clear();
      this.virtualMoveX = 0;
      this.virtualMoveZ = 0;
      this.robot.isMoving = false;
    }
  }

  public setVirtualInput(forward: number, strafe: number) {
    this.virtualMoveZ = forward;
    this.virtualMoveX = strafe;
  }

  public triggerJump() {
    if (!this.robot.isJumping) {
      this.robot.isJumping = true;
      this.robot.jumpVy = 8.5;
      synthAudio.playJump();
    }
  }

  public resetSimulation(hubLayout: ZoneLayoutResult) {
    this.savedHubState = null;
    this.collectedOrbCount = 0;
    this.orbs.forEach((o) => {
      o.collected = false;
      o.mesh.visible = true;
      o.light.visible = this.qualityProfile.enableOrbLights;
      o.glowMat.opacity = this.qualityProfile.enableOrbLights ? 0.22 : 0.62;
    });
    this.isBeaconActive = false;
    this.beaconBeam.visible = false;
    this.beaconLight.intensity = 1.5;
    this.beaconLight.color.setHex(0xf59e0b);
    this.robot.setEmotion('idle');
    this.applyZoneLayout(hubLayout, { immediateSnap: true });
  }

  private updateMovement(dt: number) {
    if (!this.isSimulationActive) {
      this.robot.isMoving = false;
      return;
    }

    const isW = this.keysPressed.has('w') || this.keysPressed.has('arrowup');
    const isS = this.keysPressed.has('s') || this.keysPressed.has('arrowdown');
    const isA = this.keysPressed.has('a') || this.keysPressed.has('arrowleft');
    const isD = this.keysPressed.has('d') || this.keysPressed.has('arrowright');
    const isSprint = this.keysPressed.has('shift');

    let moveX = 0;
    let moveZ = 0;

    const cameraYaw = this.orbitAngleX;
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);

    if (isW) {
      moveX += forwardX;
      moveZ += forwardZ;
    }
    if (isS) {
      moveX -= forwardX;
      moveZ -= forwardZ;
    }
    if (isA) {
      moveX -= rightX;
      moveZ -= rightZ;
    }
    if (isD) {
      moveX += rightX;
      moveZ += rightZ;
    }

    if (this.virtualMoveZ !== 0 || this.virtualMoveX !== 0) {
      moveX += forwardX * this.virtualMoveZ + rightX * this.virtualMoveX;
      moveZ += forwardZ * this.virtualMoveZ + rightZ * this.virtualMoveX;
    }

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0.01) {
      moveX /= len;
      moveZ /= len;

      const speed = isSprint ? 8.5 : 5.0;
      const nextX = this.robot.group.position.x + moveX * speed * dt;
      const nextZ = this.robot.group.position.z + moveZ * speed * dt;

      const clamped = clampToPlazaBounds({ x: nextX, z: nextZ }, this.currentBoundsRadius);
      this.robot.group.position.x = clamped.x;
      this.robot.group.position.z = clamped.z;

      this.robot.targetRotationY = Math.atan2(moveX, moveZ);
      this.robot.isMoving = true;

      if (!this.robot.isJumping) {
        synthAudio.playFootstep();
      }
    } else {
      this.robot.isMoving = false;
    }
  }

  private checkProximities() {
    const rx = this.robot.group.position.x;
    const rz = this.robot.group.position.z;
    const rPos = { x: rx, z: rz };

    let foundNearby: WorldBillboardNode | null = null;
    let minNodeDist = Infinity;

    for (let i = 0; i < this.billboards.length; i++) {
      const bb = this.billboards[i];
      const dist = distanceXZ(rPos, { x: bb.group.position.x, z: bb.group.position.z });
      const isNearby = dist <= 4.3;
      bb.setPlayerNearby(isNearby && dist < minNodeDist);

      if (isNearby && dist < minNodeDist) {
        minNodeDist = dist;
        foundNearby = bb.node;
      }
    }

    // Ensure only the single closest board shows its active prompt if two were ever close
    for (let i = 0; i < this.billboards.length; i++) {
      const bb = this.billboards[i];
      bb.setPlayerNearby(foundNearby !== null && bb.node.id === foundNearby.id);
    }

    if (this.currentZone === 'hub') {
      const beaconDist = Math.sqrt(rx * rx + rz * rz);
      if (beaconDist <= 4.5 && beaconDist < minNodeDist) {
        foundNearby = HUB_BEACON_NODE;
      }
    }

    if (foundNearby?.id !== this.nearestNode?.id) {
      this.nearestNode = foundNearby;
      this.callbacks.onNearNodeChange(foundNearby);
      if (foundNearby) {
        this.robot.setEmotion('curious');
      }
    }

    if (this.currentZone === 'hub') {
      for (let i = 0; i < this.orbs.length; i++) {
        const orb = this.orbs[i];
        if (orb.collected) continue;
        if (isWithinProximity(rPos, { x: orb.data.position[0], z: orb.data.position[2] }, 1.45)) {
          orb.collected = true;
          orb.mesh.visible = false;
          orb.light.visible = false;
          this.collectedOrbCount += 1;
          this.callbacks.onOrbCollected(orb.data, i, this.collectedOrbCount);
          synthAudio.playOrbCollect(i);

          if (this.collectedOrbCount === this.orbs.length) {
            this.activateBeacon();
          }
        }
      }
    }
  }

  private updateCamera(dt: number, snapImmediate: boolean = false) {
    const robotPos = this.robot.group.position;
    this.cameraTarget.set(robotPos.x, robotPos.y + 1.2, robotPos.z);

    if (this.cameraMode === 'follow') {
      const dist = 5.8;
      const height = Math.sin(this.orbitAngleY) * dist;
      const groundDist = Math.cos(this.orbitAngleY) * dist;

      const idealX = robotPos.x + Math.sin(this.orbitAngleX) * groundDist;
      const idealZ = robotPos.z + Math.cos(this.orbitAngleX) * groundDist;
      const idealY = Math.max(0.6, robotPos.y + height + 0.8);

      if (snapImmediate || this.prefersReducedMotion) {
        this.cameraCurrentPos.set(idealX, idealY, idealZ);
      } else {
        const alpha = 1 - Math.exp(-8 * dt);
        this.cameraCurrentPos.x += (idealX - this.cameraCurrentPos.x) * alpha;
        this.cameraCurrentPos.y += (idealY - this.cameraCurrentPos.y) * alpha;
        this.cameraCurrentPos.z += (idealZ - this.cameraCurrentPos.z) * alpha;
      }

      this.camera.position.copy(this.cameraCurrentPos);
      this.camera.lookAt(this.cameraTarget);
    } else {
      const dist = 14;
      const cosPitch = Math.cos(this.orbitAngleY);
      this.camera.position.x = robotPos.x + Math.sin(this.orbitAngleX) * dist * cosPitch;
      this.camera.position.y = Math.max(1.0, robotPos.y + Math.sin(this.orbitAngleY) * dist);
      this.camera.position.z = robotPos.z + Math.cos(this.orbitAngleX) * dist * cosPitch;
      this.camera.lookAt(this.cameraTarget);
    }
  }

  private renderSingleFrame() {
    if (this.isDisposed || this.isContextLost) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    this.renderer.render(this.scene, this.camera);
  }

  private requestStaticRender() {
    if (this.isDisposed || this.isContextLost) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (this.isLoopScheduled) return;
    if (this.staticRenderQueued) return;

    this.staticRenderQueued = true;
    requestAnimationFrame(() => {
      this.staticRenderQueued = false;
      this.renderSingleFrame();
    });
  }

  private stopLoopTimers() {
    this.isLoopScheduled = false;
    cancelAnimationFrame(this.animFrameId);
    clearTimeout(this.animFrameId);
    clearTimeout(this.throttleTimerId);
  }

  private shouldRunContinuousLoop(): boolean {
    if (this.isDisposed || this.isContextLost) return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    return this.renderActivityMode !== 'paused';
  }

  private syncLoopState() {
    if (!this.shouldRunContinuousLoop()) {
      this.stopLoopTimers();
      return;
    }
    if (this.isLoopScheduled) return;

    this.isLoopScheduled = true;
    this.lastTime = performance.now();
    this.perfWindowStart = this.lastTime;
    this.perfFrameCount = 0;
    this.perfFrameMsSum = 0;
    this.animFrameId = requestAnimationFrame(this.tick);
  }

  private updateBillboardsBounded(dt: number) {
    const count = this.billboards.length;
    if (count === 0) return;

    const rx = this.robot.group.position.x;
    const rz = this.robot.group.position.z;
    const maxUpdates = this.qualityProfile.maxActiveBillboardUpdates;

    // When content size is small, update directly without sorting
    if (count <= maxUpdates) {
      for (let i = 0; i < count; i++) {
        const bb = this.billboards[i];
        const dx = bb.group.position.x - rx;
        const dz = bb.group.position.z - rz;
        bb.update(
          dt,
          this.elapsedSec,
          this.frameIndex,
          dx * dx + dz * dz,
          this.qualityProfile,
          this.prefersReducedMotion
        );
      }
      return;
    }

    // For large zones (e.g. 10–30+ items), reuse pre-allocated buffer & only animate nearest K boards
    while (this.billboardDistBuffer.length < count) {
      this.billboardDistBuffer.push({ index: 0, distSq: 0 });
    }
    this.billboardDistBuffer.length = count;

    for (let i = 0; i < count; i++) {
      const bb = this.billboards[i];
      const dx = bb.group.position.x - rx;
      const dz = bb.group.position.z - rz;
      const slot = this.billboardDistBuffer[i];
      slot.index = i;
      slot.distSq = dx * dx + dz * dz;
    }

    this.billboardDistBuffer.sort((a, b) => a.distSq - b.distSq);

    const limit = Math.min(count, maxUpdates);
    for (let k = 0; k < limit; k++) {
      const slot = this.billboardDistBuffer[k];
      this.billboards[slot.index].update(
        dt,
        this.elapsedSec,
        this.frameIndex,
        slot.distSq,
        this.qualityProfile,
        this.prefersReducedMotion
      );
    }
  }

  private tick = () => {
    if (!this.shouldRunContinuousLoop()) {
      this.isLoopScheduled = false;
      return;
    }

    const now = performance.now();
    const rawElapsedMs = Math.max(0, now - this.lastTime);
    const rawDt = rawElapsedMs * 0.001;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);
    this.elapsedSec += dt;
    this.frameIndex += 1;

    // 1. Gameplay & Companion Kinematics
    this.updateMovement(dt);
    this.robot.update(dt, this.elapsedSec);
    if (this.isSimulationActive) {
      this.checkProximities();
    }

    // 2. Bounded Billboard Updates (keeps cost independent of total record count)
    this.updateBillboardsBounded(dt);

    // 3. Hub-only Orb & Beacon animations
    if (this.currentZone === 'hub' && !this.prefersReducedMotion) {
      const orbPhase = this.elapsedSec * 2.0;
      for (let i = 0; i < this.orbs.length; i++) {
        const orb = this.orbs[i];
        if (!orb.collected) {
          orb.mesh.rotation.y += dt * 1.5;
          orb.mesh.position.y =
            orb.data.position[1] + Math.sin(orbPhase + orb.data.position[0]) * 0.15;
        }
      }

      for (let i = 0; i < this.beaconRings.length; i++) {
        this.beaconRings[i].rotation.z += dt * (i % 2 === 0 ? 0.8 : -0.8);
      }
      if (this.isBeaconActive) {
        this.beaconBeam.rotation.y += dt * 0.4;
      }
    }

    // 4. Camera Rig
    this.updateCamera(dt);

    // 5. Render Scene
    this.renderer.render(this.scene, this.camera);

    // 6. Conservative Runtime Quality Adaptation (Auto mode during active gameplay)
    if (
      this.qualityPreference === 'auto' &&
      this.isSimulationActive &&
      this.renderActivityMode === 'active' &&
      !this.isSoftwareGl
    ) {
      const outcome = this.qualityGovernor.recordFrame(rawElapsedMs, now);
      if (outcome) {
        if (outcome.changed) {
          this.adaptiveDprScale = outcome.dprScale;
          const nextProfile = QUALITY_PROFILES[outcome.tier];
          this.applyQualityProfile(nextProfile);
          this.callbacks.onQualityResolved?.(outcome.tier, 'auto');
        }
        if (outcome.recommendFallbackView) {
          this.callbacks.onLowPerformanceSuggestion?.();
        }
      }
    }

    // 7. Optional lightweight dev-only diagnostics (?perf=1)
    if (this.enablePerfDiagnostics && this.callbacks.onPerfDiagnostics) {
      this.perfFrameCount += 1;
      this.perfFrameMsSum += rawElapsedMs;
      const windowElapsed = now - this.perfWindowStart;
      if (windowElapsed >= 500) {
        const fps = Math.round((this.perfFrameCount * 1000) / windowElapsed);
        const avgFrameMs = Number((this.perfFrameMsSum / this.perfFrameCount).toFixed(1));
        this.callbacks.onPerfDiagnostics({
          fps,
          avgFrameMs,
          tier: this.qualityProfile.tier,
          dpr: Number(this.renderer.getPixelRatio().toFixed(2)),
          drawCalls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles,
          textures: this.renderer.info.memory.textures,
          geometries: this.renderer.info.memory.geometries,
        });
        this.perfFrameCount = 0;
        this.perfFrameMsSum = 0;
        this.perfWindowStart = now;
      }
    }

    // 8. Schedule next frame
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else if (this.renderActivityMode === 'throttled') {
      const intervalMs = Math.round(1000 / this.qualityProfile.titleTargetFps);
      this.throttleTimerId = window.setTimeout(() => {
        if (!this.shouldRunContinuousLoop()) {
          this.isLoopScheduled = false;
          return;
        }
        this.animFrameId = requestAnimationFrame(this.tick);
      }, intervalMs);
    } else {
      this.animFrameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    let sync: WebGLSync | null = null;
    try {
      sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    } catch {
      // fenceSync not supported
    }
    if (!sync) {
      this.animFrameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.isDisposed || !this.shouldRunContinuousLoop()) {
        this.isLoopScheduled = false;
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.animFrameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.animFrameId = window.setTimeout(cb, 80);
      }
    };
    this.animFrameId = window.setTimeout(poll, 5);
  }

  public dispose() {
    this.isDisposed = true;
    this.stopLoopTimers();

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('resize', this.onResize);

    const dom = this.renderer.domElement;
    dom.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    dom.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('touchcancel', this.onTouchEnd);
    dom.removeEventListener('webglcontextlost', this.onContextLost);
    dom.removeEventListener('webglcontextrestored', this.onContextRestored);

    this.billboards.forEach((bb) => bb.dispose());
    this.billboards.length = 0;
    this.billboardShared?.dispose();

    this.robot.dispose();

    this.ownedGeometries.forEach((geo) => geo.dispose());
    this.ownedGeometries.length = 0;

    this.ownedMaterials.forEach((mat) => mat.dispose());
    this.ownedMaterials.length = 0;

    this.floorTexture.dispose();
    this.envTexture?.dispose();
    this.envTexture = null;
    this.texturePool.dispose();

    if (this.dirLight.shadow.map) {
      this.dirLight.shadow.map.dispose();
    }

    this.renderer.dispose();
    if (dom.parentElement) {
      dom.parentElement.removeChild(dom);
    }
  }
}
