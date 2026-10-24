/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CompanionRobot } from './CompanionRobot';
import { HologramBillboard } from './HologramBillboard';
import { createFloorGridTexture, createContactShadowTexture } from './proceduralAssets';
import { EXHIBITS, INITIAL_ORBS } from '../data/portfolioData';
import { clampToPlazaBounds, isWithinProximity, distanceXZ } from '../game/portfolioLogic';
import { synthAudio } from '../audio/synthAudio';
import { CameraMode, CollectibleOrbData, ExhibitData, GameState } from '../types/portfolio';

export interface WorldCallbacks {
  onInteractExhibit: (exhibit: ExhibitData) => void;
  onOrbCollected: (orb: CollectibleOrbData, index: number, totalCollected: number) => void;
  onNearExhibitChange: (exhibit: ExhibitData | null) => void;
  onStateChange: (state: GameState) => void;
  onToggleDock?: () => void;
}

import { isWebGLSupported } from './webglCheck';

// Module-level cached software GL detection with safe fallback
const IS_SOFTWARE_GL = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
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

export class WorldScene {
  public container: HTMLElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public robot: CompanionRobot;
  public billboards: HologramBillboard[] = [];
  public orbs: { data: CollectibleOrbData; mesh: THREE.Group; collected: boolean }[] = [];
  public beaconGroup: THREE.Group;
  public isBeaconActive: boolean = false;
  public isSimulationActive: boolean = false;

  // Virtual touch controls for mobile
  public virtualMoveX: number = 0;
  public virtualMoveZ: number = 0;

  private isSoftwareGl: boolean = IS_SOFTWARE_GL;
  private animFrameId: number = 0;
  private isDisposed: boolean = false;
  private textureLoader: THREE.TextureLoader = new THREE.TextureLoader();

  // Camera rigs
  public cameraMode: CameraMode = 'follow';
  private cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 1.2, 0);
  private cameraCurrentPos: THREE.Vector3 = new THREE.Vector3(0, 3.8, 7.5);
  private orbitAngleX: number = 0;
  private orbitAngleY: number = 0.35;
  private isDraggingMouse: boolean = false;
  private prevMouseX: number = 0;
  private prevMouseY: number = 0;

  // Input state
  private keysPressed: Set<string> = new Set();
  private callbacks: WorldCallbacks;
  private nearestExhibit: ExhibitData | null = null;
  private lastTime: number = performance.now();

  // Beacon elements
  private beaconBeam!: THREE.Mesh;
  private beaconRings: THREE.Mesh[] = [];
  private beaconLight!: THREE.PointLight;

  constructor(container: HTMLElement, callbacks: WorldCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    if (!isWebGLSupported()) {
      throw new Error('WebGL is not supported or disabled in this browser environment');
    }

    // 2. Initialize Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch (err) {
      console.warn('THREE.WebGLRenderer context creation failed:', err);
      throw err;
    }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // 3. Scene & Atmosphere (Deep nocturnal navy fog)
    this.scene = new THREE.Scene();
    const bgDark = new THREE.Color(0x060911); // Deep night navy/black
    this.scene.background = bgDark;
    this.scene.fog = new THREE.FogExp2(0x060911, 0.024);

    // 4. Camera
    this.camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      120
    );
    this.camera.position.set(0, 3.8, 7.5);

    // 5. Studio Reflections via PMREMGenerator & RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 6. Lighting (Warm key light vs cool hemisphere fill)
    const hemiLight = new THREE.HemisphereLight(0x1e293b, 0x070b14, 0.85); // Cool night sky / dark ground
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff1e6, 1.4); // Warm key light
    dirLight.position.set(16, 24, 12);
    if (!this.isSoftwareGl) {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 60;
      const d = 32;
      dirLight.shadow.camera.left = -d;
      dirLight.shadow.camera.right = d;
      dirLight.shadow.camera.top = d;
      dirLight.shadow.camera.bottom = -d;
      dirLight.shadow.bias = -0.0005;
      dirLight.shadow.normalBias = 0.02;
    }
    this.scene.add(dirLight);

    // Ambient plaza fill light
    const plazaFill = new THREE.PointLight(0x06b6d4, 1.2, 35);
    plazaFill.position.set(0, 8, 0);
    this.scene.add(plazaFill);

    // 7. Ground (Dark reflective grid plane)
    const floorSize = 90;
    const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
    const floorTexture = createFloorGridTexture(this.renderer.capabilities.getMaxAnisotropy());
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      map: floorTexture,
      roughness: 0.28, // High gloss for reflections
      metalness: 0.65,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // 8. Perimeter Boundary Pylons (Plaza circle)
    this.createPerimeterPylons();

    // 9. Central Beacon Spire
    this.beaconGroup = this.createCentralBeacon();
    this.scene.add(this.beaconGroup);

    // 10. Companion Robot (Spawned south of center facing north)
    this.robot = new CompanionRobot();
    this.robot.group.position.set(0, 0, 4);
    this.robot.targetRotationY = 0; // Facing North toward profile exhibit
    this.scene.add(this.robot.group);

    // 11. Holographic Billboards
    this.createBillboards();

    // 12. Floating Collectible Energy Orbs
    this.createCollectibleOrbs();

    // 13. Drifting Nocturnal Dust / Starlight
    this.createAmbientDust();

    // 14. Event Listeners
    this.bindEvents();

    // Pre-warm shaders
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 15. Start Animation Loop
    this.startLoop();
  }

  private createPerimeterPylons() {
    const pylonCount = 20;
    const radius = 38;
    const pylonGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.2, 12);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x0c121d,
      roughness: 0.6,
      metalness: 0.4,
    });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });

    for (let i = 0; i < pylonCount; i++) {
      const angle = (i / pylonCount) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(x, 1.1, z);
      this.scene.add(pylon);

      // Glowing tip
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), beaconMat);
      tip.position.set(x, 2.3, z);
      this.scene.add(tip);
    }
  }

  private createCentralBeacon(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x0b101a,
      roughness: 0.5,
      metalness: 0.7,
    });

    const amberMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const cyanMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });

    // Step base
    const baseCyl = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.35, 24), darkMetal);
    baseCyl.position.y = 0.17;
    baseCyl.receiveShadow = true;
    group.add(baseCyl);

    // Glowing core ring
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.04, 8, 32), amberMat);
    coreRing.rotation.x = Math.PI / 2;
    coreRing.position.y = 0.36;
    group.add(coreRing);

    // Central Monolith Pillar
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 4.2, 8), darkMetal);
    pillar.position.y = 2.4;
    group.add(pillar);

    // Rotating kinetic rings around pillar
    [1.8, 2.6, 3.4].forEach((yPos, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2 - i * 0.15, 0.03, 8, 24), i % 2 === 0 ? cyanMat : amberMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = yPos;
      this.beaconRings.push(ring);
      group.add(ring);
    });

    // Central light beam (sky column, visible when activated)
    const beamGeo = new THREE.CylinderGeometry(0.4, 1.8, 45, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.beaconBeam = new THREE.Mesh(beamGeo, beamMat);
    this.beaconBeam.position.y = 22.5;
    this.beaconBeam.visible = false;
    group.add(this.beaconBeam);

    // Core point light
    this.beaconLight = new THREE.PointLight(0xf59e0b, 1.5, 12);
    this.beaconLight.position.set(0, 3.5, 0);
    group.add(this.beaconLight);

    return group;
  }

  private createBillboards() {
    EXHIBITS.forEach((exhibit) => {
      if (exhibit.terminalType === 'beacon') return; // Handled separately
      const billboard = new HologramBillboard(exhibit, this.textureLoader);
      this.billboards.push(billboard);
      this.scene.add(billboard.group);
    });
  }

  private createCollectibleOrbs() {
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x083344,
      emissive: 0x22d3ee,
      emissiveIntensity: 2.0,
      roughness: 0.15,
      metalness: 0.8,
    });

    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.35,
      wireframe: true,
    });

    const shadowTex = createContactShadowTexture();
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    INITIAL_ORBS.forEach((orbData) => {
      const orbGroup = new THREE.Group();
      orbGroup.position.set(...orbData.position);

      // Core glowing sphere
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), orbMat);
      orbGroup.add(sphere);

      // Wireframe halo
      const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), haloMat);
      orbGroup.add(halo);

      // Contact shadow on floor
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -orbData.position[1] + 0.015;
      orbGroup.add(shadow);

      // Subtle localized point light
      const light = new THREE.PointLight(0x22d3ee, 0.8, 4);
      orbGroup.add(light);

      this.scene.add(orbGroup);
      this.orbs.push({ data: { ...orbData }, mesh: orbGroup, collected: false });
    });
  }

  private createAmbientDust() {
    const dustCount = 120;
    const dustGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 8 + 0.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.05,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    this.scene.add(dust);
  }

  public activateBeacon() {
    this.isBeaconActive = true;
    this.beaconBeam.visible = true;
    this.beaconLight.intensity = 4.0;
    this.beaconLight.color.setHex(0x22d3ee);
    synthAudio.playBeaconActivated();
  }

  public warpToExhibit(exhibitId: string) {
    const exhibit = EXHIBITS.find((e) => e.id === exhibitId);
    if (!exhibit) return;

    // Place robot 4m in front of exhibit facing it
    const angle = exhibit.rotationY;
    const offsetX = Math.sin(angle) * 4;
    const offsetZ = Math.cos(angle) * 4;

    this.robot.group.position.set(
      exhibit.position[0] + offsetX,
      0,
      exhibit.position[2] + offsetZ
    );
    this.robot.targetRotationY = angle + Math.PI;
    this.robot.group.rotation.y = angle + Math.PI;
    this.robot.setEmotion('curious');
    synthAudio.playRobotChirp('curious');
  }

  public triggerRobotWave() {
    this.robot.triggerWave();
    synthAudio.playRobotChirp('wave');
  }

  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
  }

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('resize', this.onResize);

    // Mouse drag for camera orbit adjustment
    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);

    // Touch support for mobile dragging
    dom.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });
    window.addEventListener('touchend', this.onTouchEnd);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // Ignore when typing inside input or textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
      this.handleInteract();
    } else if (key === 'q') {
      e.preventDefault();
      this.triggerRobotWave();
    } else if (key === 'c') {
      e.preventDefault();
      this.setCameraMode(this.cameraMode === 'follow' ? 'orbit' : 'follow');
    } else if (key === 'm') {
      e.preventDefault();
      synthAudio.toggleMute();
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
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.keysPressed.clear();
      this.isDraggingMouse = false;
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    this.isDraggingMouse = true;
    this.prevMouseX = e.clientX;
    this.prevMouseY = e.clientY;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDraggingMouse) return;
    const dx = e.clientX - this.prevMouseX;
    const dy = e.clientY - this.prevMouseY;
    this.prevMouseX = e.clientX;
    this.prevMouseY = e.clientY;

    this.orbitAngleX -= dx * 0.006;
    this.orbitAngleY = Math.max(0.1, Math.min(1.2, this.orbitAngleY + dy * 0.005));
  };

  private onMouseUp = () => {
    this.isDraggingMouse = false;
  };

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      this.isDraggingMouse = true;
      this.prevMouseX = e.touches[0].clientX;
      this.prevMouseY = e.touches[0].clientY;
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    if (!this.isDraggingMouse || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - this.prevMouseX;
    const dy = e.touches[0].clientY - this.prevMouseY;
    this.prevMouseX = e.touches[0].clientX;
    this.prevMouseY = e.touches[0].clientY;

    this.orbitAngleX -= dx * 0.006;
    this.orbitAngleY = Math.max(0.1, Math.min(1.2, this.orbitAngleY + dy * 0.005));
  };

  private onTouchEnd = () => {
    this.isDraggingMouse = false;
  };

  private onResize = () => {
    if (!this.container || this.isDisposed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handleInteract() {
    if (this.nearestExhibit) {
      synthAudio.playHologramScan();
      this.callbacks.onInteractExhibit(this.nearestExhibit);
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

  public resetSimulation() {
    this.robot.group.position.set(0, 0, 4);
    this.robot.targetRotationY = 0;
    this.robot.group.rotation.y = 0;
    this.robot.isMoving = false;
    this.robot.isJumping = false;
    this.robot.jumpVy = 0;
    this.robot.setEmotion('idle');
    this.orbs.forEach((o) => {
      o.collected = false;
      o.mesh.visible = true;
    });
    this.isBeaconActive = false;
    this.beaconBeam.visible = false;
    this.beaconLight.intensity = 1.5;
    this.beaconLight.color.setHex(0xf59e0b);
    this.keysPressed.clear();
    this.virtualMoveX = 0;
    this.virtualMoveZ = 0;
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

    // Movement relative to current camera heading
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

    // Merge virtual touch joystick input
    if (this.virtualMoveZ !== 0 || this.virtualMoveX !== 0) {
      moveX += forwardX * this.virtualMoveZ + rightX * this.virtualMoveX;
      moveZ += forwardZ * this.virtualMoveZ + rightZ * this.virtualMoveX;
    }

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0.01) {
      moveX /= len;
      moveZ /= len;

      const speed = isSprint ? 8.5 : 5.0;
      this.robot.group.position.x += moveX * speed * dt;
      this.robot.group.position.z += moveZ * speed * dt;

      // Clamp player within the plaza barrier
      const clamped = clampToPlazaBounds(
        { x: this.robot.group.position.x, z: this.robot.group.position.z },
        36.0
      );
      this.robot.group.position.x = clamped.x;
      this.robot.group.position.z = clamped.z;

      // Face direction of movement
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
    const rPos = { x: this.robot.group.position.x, z: this.robot.group.position.z };

    // 1. Holographic Billboards
    let foundNearby: ExhibitData | null = null;
    let minExhibitDist = Infinity;

    this.billboards.forEach((bb) => {
      const bPos = { x: bb.group.position.x, z: bb.group.position.z };
      const dist = distanceXZ(rPos, bPos);
      const isNearby = dist <= 4.2;
      bb.setPlayerNearby(isNearby);

      if (isNearby && dist < minExhibitDist) {
        minExhibitDist = dist;
        foundNearby = bb.data;
      }
    });

    // Central beacon proximity
    const beaconDist = distanceXZ(rPos, { x: 0, z: 0 });
    if (beaconDist <= 4.5 && beaconDist < minExhibitDist) {
      const beaconData = EXHIBITS.find((e) => e.id === 'beacon');
      if (beaconData) {
        foundNearby = beaconData;
      }
    }

    if (foundNearby !== this.nearestExhibit) {
      this.nearestExhibit = foundNearby;
      this.callbacks.onNearExhibitChange(foundNearby);
      if (foundNearby) {
        this.robot.setEmotion('curious');
      }
    }

    // 2. Check Collectible Orbs
    this.orbs.forEach((orb, index) => {
      if (orb.collected) return;
      const oPos = { x: orb.data.position[0], z: orb.data.position[2] };
      if (isWithinProximity(rPos, oPos, 1.4)) {
        orb.collected = true;
        orb.mesh.visible = false;
        const total = this.orbs.filter((o) => o.collected).length;
        this.callbacks.onOrbCollected(orb.data, index, total);
        synthAudio.playOrbCollect(index);

        if (total === this.orbs.length) {
          this.activateBeacon();
        }
      }
    });
  }

  private updateCamera(dt: number) {
    const robotPos = this.robot.group.position;
    this.cameraTarget.set(robotPos.x, robotPos.y + 1.2, robotPos.z);

    if (this.cameraMode === 'follow') {
      const dist = 5.8;
      const height = Math.sin(this.orbitAngleY) * dist;
      const groundDist = Math.cos(this.orbitAngleY) * dist;

      const idealX = robotPos.x + Math.sin(this.orbitAngleX) * groundDist;
      const idealZ = robotPos.z + Math.cos(this.orbitAngleX) * groundDist;
      const idealY = Math.max(0.6, robotPos.y + height + 0.8);

      // Smooth exponential damping
      this.cameraCurrentPos.x += (idealX - this.cameraCurrentPos.x) * (1 - Math.exp(-8 * dt));
      this.cameraCurrentPos.y += (idealY - this.cameraCurrentPos.y) * (1 - Math.exp(-8 * dt));
      this.cameraCurrentPos.z += (idealZ - this.cameraCurrentPos.z) * (1 - Math.exp(-8 * dt));

      this.camera.position.copy(this.cameraCurrentPos);
      this.camera.lookAt(this.cameraTarget);
    } else {
      // Free Orbit Mode around plaza center or robot
      const dist = 14;
      this.camera.position.x = robotPos.x + Math.sin(this.orbitAngleX) * dist * Math.cos(this.orbitAngleY);
      this.camera.position.y = Math.max(1.0, robotPos.y + Math.sin(this.orbitAngleY) * dist);
      this.camera.position.z = robotPos.z + Math.cos(this.orbitAngleX) * dist * Math.cos(this.orbitAngleY);
      this.camera.lookAt(this.cameraTarget);
    }
  }

  private startLoop() {
    const tick = () => {
      if (this.isDisposed) return;

      const now = performance.now();
      const rawDt = (now - this.lastTime) * 0.001;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05); // Clamp dt

      // 1. Update entities
      this.updateMovement(dt);
      this.robot.update(dt);
      this.checkProximities();

      // 2. Update Billboards & Orbs
      this.billboards.forEach((bb) => bb.update(dt));
      const t = now * 0.002;
      this.orbs.forEach((orb) => {
        if (!orb.collected) {
          orb.mesh.rotation.y += dt * 1.5;
          orb.mesh.position.y = orb.data.position[1] + Math.sin(t + orb.data.position[0]) * 0.15;
        }
      });

      // 3. Central Beacon rings rotation
      this.beaconRings.forEach((ring, idx) => {
        ring.rotation.z += dt * (idx % 2 === 0 ? 0.8 : -0.8);
      });
      if (this.isBeaconActive) {
        this.beaconBeam.rotation.y += dt * 0.4;
      }

      // 4. Update Camera
      this.updateCamera(dt);

      // 5. Render Scene
      this.renderer.render(this.scene, this.camera);

      // 6. Schedule next frame (Paced on software WebGL)
      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.animFrameId = requestAnimationFrame(tick);
      }
    };

    tick();
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    let sync: WebGLSync | null = null;
    try {
      sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    } catch {
      // fenceSync not supported
    }
    if (!sync) {
      this.animFrameId = window.setTimeout(cb, 60);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.isDisposed) return;
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.animFrameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.animFrameId = window.setTimeout(cb, 60);
      }
    };
    this.animFrameId = window.setTimeout(poll, 5);
  }

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.animFrameId);
    clearTimeout(this.animFrameId);

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

    this.robot.dispose();
    this.renderer.dispose();
    if (dom.parentElement) {
      dom.parentElement.removeChild(dom);
    }
  }
}
