/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RobotEyeCanvas, createContactShadowTexture } from './proceduralAssets';
import { CompanionEmotion, FacialExpressionState } from '../types/portfolio';
import { QualityProfile } from './qualityConfig';

const VEC_ONE = new THREE.Vector3(1, 1, 1);

const UPPER_BODY_REST_Y = 0.62;
const HEAD_GROUP_REST_Y = 0.74;
const LEG_HIP_REST_Y = 0.5;
const GREETING_TOTAL_DURATION_SEC = 2.35;

interface SharedLimbGeometries {
  shoulderGeo: THREE.SphereGeometry;
  shoulderRingGeo: THREE.TorusGeometry;
  upperArmGeo: THREE.CylinderGeometry;
  elbowGeo: THREE.SphereGeometry;
  forearmGeo: THREE.CylinderGeometry;
  wristRingGeo: THREE.TorusGeometry;
  handGeo: THREE.SphereGeometry;
  thumbGeo: THREE.SphereGeometry;
  hipGeo: THREE.SphereGeometry;
  thighGeo: THREE.CylinderGeometry;
  kneeRingGeo: THREE.TorusGeometry;
  shinGeo: THREE.CylinderGeometry;
  bootGeo: THREE.BufferGeometry;
  soleGeo: THREE.BoxGeometry;
}

interface ArmAssembly {
  root: THREE.Group;
  forearmPivot: THREE.Group;
}

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);

  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function smoothstep01(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function normalizeAngleDelta(target: number, current: number): number {
  const diff = target - current;
  return Math.atan2(Math.sin(diff), Math.cos(diff));
}

/**
 * Exact vertical hip clearance required when a leg pitches by `theta` around X
 * so neither the forward toe (`z = +0.172`) nor heel (`z = -0.102`) dips below `y = 0`.
 */
function computeLegPitchClearance(theta: number): number {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const soleExtremeZ = sinT >= 0 ? 0.155 : -0.085;
  const bootExtremeZ = sinT >= 0 ? 0.172 : -0.102;
  const minSoleY = -0.5 * cosT - soleExtremeZ * sinT;
  const minBootY = -0.4845 * cosT - bootExtremeZ * sinT;
  return Math.max(0, -LEG_HIP_REST_Y - Math.min(minSoleY, minBootY));
}

export class CompanionRobot {
  public group: THREE.Group;
  public upperBodyGroup: THREE.Group;
  public headGroup: THREE.Group;
  public rightArm: THREE.Group;
  public rightForearmPivot: THREE.Group;
  public leftArm: THREE.Group;
  public leftForearmPivot: THREE.Group;
  public rightLeg: THREE.Group;
  public leftLeg: THREE.Group;
  public torso: THREE.Mesh;
  public faceMesh: THREE.Mesh;
  public antennaTip: THREE.Mesh;
  public heartCore: THREE.Mesh;
  public shadowPlane: THREE.Mesh;
  public hitProxyMesh: THREE.Mesh;
  public eyeCanvas: RobotEyeCanvas;
  public eyeMaterial: THREE.MeshBasicMaterial;

  // Kinematic & behavioral state
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public isMoving: boolean = false;
  public isJumping: boolean = false;
  public isWaving: boolean = false;
  public jumpVy: number = 0;
  public targetRotationY: number = 0;
  public currentEmotion: CompanionEmotion = 'idle';
  public currentExpression: FacialExpressionState = 'neutral';

  private walkPhase: number = 0;
  private greetingElapsed: number = 0;
  private greetingDuration: number = GREETING_TOTAL_DURATION_SEC;
  private greetingTargetYaw: number | null = null;
  private blinkTimer: number = 3.1;
  private isBlinking: boolean = false;

  private heartLight: THREE.PointLight;
  private headMesh: THREE.Mesh;
  private cyanEmissive: THREE.MeshStandardMaterial;
  private purpleEmissive: THREE.MeshStandardMaterial;

  private ownedGeometries: THREE.BufferGeometry[] = [];
  private ownedMaterials: THREE.Material[] = [];
  private ownsContactShadowTex: boolean = false;
  private contactShadowTex: THREE.Texture;

  constructor(sharedContactShadowTex?: THREE.Texture) {
    this.group = new THREE.Group();
    this.group.name = 'CompanionRobot';

    // Cohesive nocturnal character palette:
    // 1. Dark charcoal / graphite primary armor
    const charcoalBodyMat = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x1b2230,
        roughness: 0.62,
        metalness: 0.32,
      })
    );

    // 2. Dark navy structural joints, yokes, and trim (roughness delta >= 0.25)
    const darkNavyTrimMat = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x0d1526,
        roughness: 0.36,
        metalness: 0.68,
      })
    );

    // 3. Recessed obsidian visor bezel
    const visorBezelMat = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x050811,
        roughness: 0.22,
        metalness: 0.55,
      })
    );

    // 4. Restrained cyan & purple emissive accents
    this.cyanEmissive = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x083344,
        emissive: 0x22d3ee,
        emissiveIntensity: 1.35,
        roughness: 0.28,
        metalness: 0.2,
      })
    );

    this.purpleEmissive = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x240a3d,
        emissive: 0xa855f7,
        emissiveIntensity: 1.3,
        roughness: 0.3,
        metalness: 0.25,
      })
    );

    // ========================================================================
    // 1. Pelvis Chassis (bridges legs at y=0.50 cleanly to upperBody at y=0.62)
    // ========================================================================
    const pelvisGeo = this.trackGeometry(new THREE.CylinderGeometry(0.3, 0.25, 0.16, 18));
    const pelvisMesh = new THREE.Mesh(pelvisGeo, darkNavyTrimMat);
    pelvisMesh.position.y = 0.54;
    pelvisMesh.castShadow = true;
    pelvisMesh.receiveShadow = true;
    this.group.add(pelvisMesh);

    // ========================================================================
    // 2. Connected Upper Body Hierarchy (Torso + Chest + Pack + Neck + Head + Arms)
    // ========================================================================
    this.upperBodyGroup = new THREE.Group();
    this.upperBodyGroup.name = 'UpperBodyGroup';
    this.upperBodyGroup.position.set(0, UPPER_BODY_REST_Y, 0);
    this.group.add(this.upperBodyGroup);

    // Subtle purple waist seam ring
    const waistRingGeo = this.trackGeometry(new THREE.TorusGeometry(0.305, 0.016, 8, 24));
    const waistRing = new THREE.Mesh(waistRingGeo, this.purpleEmissive);
    waistRing.rotation.x = Math.PI / 2;
    waistRing.position.y = 0.02;
    this.upperBodyGroup.add(waistRing);

    // Tapered graphite torso hull (local y = 0.02 .. 0.58)
    const torsoGeo = this.trackGeometry(new THREE.CylinderGeometry(0.35, 0.3, 0.56, 20));
    this.torso = new THREE.Mesh(torsoGeo, charcoalBodyMat);
    this.torso.position.y = 0.3;
    this.torso.castShadow = true;
    this.torso.receiveShadow = true;
    this.upperBodyGroup.add(this.torso);

    // Dark navy shoulder collar yoke (local y = 0.57 .. 0.65)
    const collarGeo = this.trackGeometry(new THREE.CylinderGeometry(0.29, 0.352, 0.08, 20));
    const collar = new THREE.Mesh(collarGeo, darkNavyTrimMat);
    collar.position.y = 0.61;
    this.upperBodyGroup.add(collar);

    // Front (+Z) chest armor badge + cyan/purple harmonic core
    const chestPlateGeo = this.trackGeometry(new THREE.BoxGeometry(0.36, 0.24, 0.07));
    const chestPlate = new THREE.Mesh(chestPlateGeo, darkNavyTrimMat);
    chestPlate.position.set(0, 0.33, 0.315);
    this.upperBodyGroup.add(chestPlate);

    const coreRingGeo = this.trackGeometry(new THREE.TorusGeometry(0.074, 0.013, 8, 20));
    const coreRing = new THREE.Mesh(coreRingGeo, this.purpleEmissive);
    coreRing.position.set(0, 0.33, 0.355);
    this.upperBodyGroup.add(coreRing);

    const heartGeo = this.trackGeometry(new THREE.CylinderGeometry(0.056, 0.056, 0.03, 16));
    this.heartCore = new THREE.Mesh(heartGeo, this.cyanEmissive);
    this.heartCore.rotation.x = Math.PI / 2;
    this.heartCore.position.set(0, 0.33, 0.356);
    this.upperBodyGroup.add(this.heartCore);

    this.heartLight = new THREE.PointLight(0x22d3ee, 0.65, 2.4);
    this.heartLight.position.set(0, 0.33, 0.45);
    this.upperBodyGroup.add(this.heartLight);

    // Back (-Z) dorsal telemetry pack so third-person follow camera has crisp detail
    const packGeo = this.trackGeometry(new THREE.BoxGeometry(0.34, 0.32, 0.11));
    const backPack = new THREE.Mesh(packGeo, darkNavyTrimMat);
    backPack.position.set(0, 0.32, -0.325);
    this.upperBodyGroup.add(backPack);

    const packBarGeo = this.trackGeometry(new THREE.BoxGeometry(0.045, 0.18, 0.02));
    const packBar = new THREE.Mesh(packBarGeo, this.cyanEmissive);
    packBar.position.set(0, 0.32, -0.385);
    this.upperBodyGroup.add(packBar);

    // Neck gimbal (local y = 0.64 .. 0.75, seamlessly bridging collar to head base)
    const neckGeo = this.trackGeometry(new THREE.CylinderGeometry(0.125, 0.155, 0.11, 16));
    const neck = new THREE.Mesh(neckGeo, darkNavyTrimMat);
    neck.position.y = 0.695;
    this.upperBodyGroup.add(neck);

    // ========================================================================
    // 3. Head Group & Front-Facing (+Z) Digital Face Screen
    // ========================================================================
    this.headGroup = new THREE.Group();
    this.headGroup.name = 'HeadGroup';
    this.headGroup.position.set(0, HEAD_GROUP_REST_Y, 0);
    this.upperBodyGroup.add(this.headGroup);

    // Beveled rounded-rectangular head shell sitting cleanly above neck (local y = 0.00 .. 0.48)
    const headShape = createRoundedRectShape(0.58, 0.38, 0.11);
    const headExtrudeGeo = this.trackGeometry(
      new THREE.ExtrudeGeometry(headShape, {
        depth: 0.34,
        bevelEnabled: true,
        bevelThickness: 0.055,
        bevelSize: 0.05,
        bevelSegments: 3,
        curveSegments: 10,
      })
    );
    headExtrudeGeo.center();
    this.headMesh = new THREE.Mesh(headExtrudeGeo, charcoalBodyMat);
    this.headMesh.position.set(0, 0.24, 0);
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.headGroup.add(this.headMesh);

    // Recessed obsidian visor frame on +Z front face (front surface of headMesh is z = +0.225)
    const bezelShape = createRoundedRectShape(0.54, 0.34, 0.08);
    const bezelGeo = this.trackGeometry(
      new THREE.ExtrudeGeometry(bezelShape, {
        depth: 0.02,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 2,
        curveSegments: 8,
      })
    );
    bezelGeo.center();
    const bezelMesh = new THREE.Mesh(bezelGeo, visorBezelMat);
    bezelMesh.position.set(0, 0.24, 0.222);
    this.headGroup.add(bezelMesh);

    // Legible front-facing (+Z) OLED face plane (eyes + mouth, unlit & sharp in every quality mode)
    this.eyeCanvas = new RobotEyeCanvas();
    this.eyeMaterial = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        map: this.eyeCanvas.texture,
        toneMapped: false,
      })
    );
    const faceGeo = this.trackGeometry(new THREE.PlaneGeometry(0.49, 0.3));
    this.faceMesh = new THREE.Mesh(faceGeo, this.eyeMaterial);
    this.faceMesh.name = 'RobotFaceDisplay';
    this.faceMesh.position.set(0, 0.24, 0.241);
    // Explicitly faces +Z (rotation = 0, 0, 0)
    this.headGroup.add(this.faceMesh);

    // Symmetrical side ear-pods with restrained purple accent rings
    const earPodGeo = this.trackGeometry(new THREE.CylinderGeometry(0.09, 0.09, 0.055, 16));
    earPodGeo.rotateZ(Math.PI / 2);
    const earRingGeo = this.trackGeometry(new THREE.TorusGeometry(0.078, 0.013, 8, 18));
    earRingGeo.rotateY(Math.PI / 2);

    [-1, 1].forEach((side) => {
      const pod = new THREE.Mesh(earPodGeo, darkNavyTrimMat);
      pod.position.set(side * 0.355, 0.24, 0);
      this.headGroup.add(pod);

      const ring = new THREE.Mesh(earRingGeo, this.purpleEmissive);
      ring.position.set(side * 0.382, 0.24, 0);
      this.headGroup.add(ring);
    });

    // Top antenna mount, stem & cyan beacon tip
    const antennaBaseGeo = this.trackGeometry(new THREE.CylinderGeometry(0.05, 0.07, 0.04, 12));
    const antennaBase = new THREE.Mesh(antennaBaseGeo, darkNavyTrimMat);
    antennaBase.position.set(0, 0.49, 0);
    this.headGroup.add(antennaBase);

    const antennaStemGeo = this.trackGeometry(new THREE.CylinderGeometry(0.014, 0.022, 0.15, 8));
    const antennaStem = new THREE.Mesh(antennaStemGeo, darkNavyTrimMat);
    antennaStem.position.set(0, 0.575, 0);
    this.headGroup.add(antennaStem);

    const antennaTipGeo = this.trackGeometry(new THREE.SphereGeometry(0.046, 12, 12));
    this.antennaTip = new THREE.Mesh(antennaTipGeo, this.cyanEmissive);
    this.antennaTip.position.set(0, 0.665, 0);
    this.headGroup.add(this.antennaTip);

    // ========================================================================
    // 4. Shared Geometries for Symmetrical Articulated Arms & Grounded Legs
    // ========================================================================
    const handGeo = this.trackGeometry(new THREE.SphereGeometry(0.068, 12, 10));
    handGeo.scale(0.95, 1.08, 0.78);

    const bootShape = createRoundedRectShape(0.17, 0.25, 0.06);
    const bootGeo = this.trackGeometry(
      new THREE.ExtrudeGeometry(bootShape, {
        depth: 0.075,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.012,
        bevelSegments: 2,
        curveSegments: 8,
      })
    );
    bootGeo.center();
    bootGeo.rotateX(Math.PI / 2);

    const limbGeos: SharedLimbGeometries = {
      shoulderGeo: this.trackGeometry(new THREE.SphereGeometry(0.085, 12, 12)),
      shoulderRingGeo: this.trackGeometry(new THREE.TorusGeometry(0.086, 0.012, 8, 16)),
      upperArmGeo: this.trackGeometry(new THREE.CylinderGeometry(0.062, 0.055, 0.22, 12)),
      elbowGeo: this.trackGeometry(new THREE.SphereGeometry(0.055, 10, 10)),
      forearmGeo: this.trackGeometry(new THREE.CylinderGeometry(0.054, 0.048, 0.2, 12)),
      wristRingGeo: this.trackGeometry(new THREE.TorusGeometry(0.05, 0.011, 8, 14)),
      handGeo,
      thumbGeo: this.trackGeometry(new THREE.SphereGeometry(0.026, 8, 8)),
      hipGeo: this.trackGeometry(new THREE.SphereGeometry(0.095, 10, 10)),
      thighGeo: this.trackGeometry(new THREE.CylinderGeometry(0.082, 0.072, 0.22, 12)),
      kneeRingGeo: this.trackGeometry(new THREE.TorusGeometry(0.075, 0.014, 8, 16)),
      shinGeo: this.trackGeometry(new THREE.CylinderGeometry(0.07, 0.064, 0.18, 12)),
      bootGeo,
      soleGeo: this.trackGeometry(new THREE.BoxGeometry(0.165, 0.02, 0.24)),
    };

    const leftArmAssembly = this.createArm(
      -1,
      limbGeos,
      charcoalBodyMat,
      darkNavyTrimMat,
      this.cyanEmissive,
      this.purpleEmissive
    );
    this.leftArm = leftArmAssembly.root;
    this.leftForearmPivot = leftArmAssembly.forearmPivot;
    this.leftArm.position.set(-0.425, 0.56, 0);
    this.upperBodyGroup.add(this.leftArm);

    const rightArmAssembly = this.createArm(
      1,
      limbGeos,
      charcoalBodyMat,
      darkNavyTrimMat,
      this.cyanEmissive,
      this.purpleEmissive
    );
    this.rightArm = rightArmAssembly.root;
    this.rightForearmPivot = rightArmAssembly.forearmPivot;
    this.rightArm.position.set(0.425, 0.56, 0);
    this.upperBodyGroup.add(this.rightArm);

    this.leftLeg = this.createLeg(
      limbGeos,
      charcoalBodyMat,
      darkNavyTrimMat,
      this.cyanEmissive,
      this.purpleEmissive
    );
    this.leftLeg.position.set(-0.2, LEG_HIP_REST_Y, 0);
    this.group.add(this.leftLeg);

    this.rightLeg = this.createLeg(
      limbGeos,
      charcoalBodyMat,
      darkNavyTrimMat,
      this.cyanEmissive,
      this.purpleEmissive
    );
    this.rightLeg.position.set(0.2, LEG_HIP_REST_Y, 0);
    this.group.add(this.rightLeg);

    // ========================================================================
    // 5. Ground Contact Shadow Plane & Lightweight Tap Proxy
    // ========================================================================
    const shadowGeo = this.trackGeometry(new THREE.PlaneGeometry(1.55, 1.55));
    if (sharedContactShadowTex) {
      this.contactShadowTex = sharedContactShadowTex;
      this.ownsContactShadowTex = false;
    } else {
      this.contactShadowTex = createContactShadowTexture();
      this.ownsContactShadowTex = true;
    }
    const shadowMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        map: this.contactShadowTex,
        transparent: true,
        opacity: 0.66,
        depthWrite: false,
      })
    );
    this.shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.position.y = 0.014;
    this.group.add(this.shadowPlane);

    const hitProxyGeo = this.trackGeometry(new THREE.CylinderGeometry(0.55, 0.55, 1.95, 8));
    const hitProxyMat = this.trackMaterial(new THREE.MeshBasicMaterial({ visible: false }));
    this.hitProxyMesh = new THREE.Mesh(hitProxyGeo, hitProxyMat);
    this.hitProxyMesh.position.y = 0.98;
    this.hitProxyMesh.userData.isCompanionRobot = true;
    this.group.add(this.hitProxyMesh);
  }

  private trackGeometry<T extends THREE.BufferGeometry>(geo: T): T {
    this.ownedGeometries.push(geo);
    return geo;
  }

  private trackMaterial<T extends THREE.Material>(mat: T): T {
    this.ownedMaterials.push(mat);
    return mat;
  }

  private createArm(
    side: -1 | 1,
    geos: SharedLimbGeometries,
    hullMat: THREE.Material,
    trimMat: THREE.Material,
    cyanMat: THREE.Material,
    purpleMat: THREE.Material
  ): ArmAssembly {
    const armRoot = new THREE.Group();

    const shoulder = new THREE.Mesh(geos.shoulderGeo, trimMat);
    armRoot.add(shoulder);

    const shoulderRing = new THREE.Mesh(geos.shoulderRingGeo, purpleMat);
    shoulderRing.rotation.y = Math.PI / 2;
    shoulderRing.position.x = side * -0.02;
    armRoot.add(shoulderRing);

    const upperArm = new THREE.Mesh(geos.upperArmGeo, hullMat);
    upperArm.position.y = -0.12;
    armRoot.add(upperArm);

    const forearmPivot = new THREE.Group();
    forearmPivot.position.set(0, -0.24, 0);
    armRoot.add(forearmPivot);

    const elbow = new THREE.Mesh(geos.elbowGeo, trimMat);
    forearmPivot.add(elbow);

    const forearm = new THREE.Mesh(geos.forearmGeo, hullMat);
    forearm.position.y = -0.11;
    forearmPivot.add(forearm);

    const wristRing = new THREE.Mesh(geos.wristRingGeo, cyanMat);
    wristRing.rotation.x = Math.PI / 2;
    wristRing.position.y = -0.21;
    forearmPivot.add(wristRing);

    const hand = new THREE.Mesh(geos.handGeo, trimMat);
    hand.position.y = -0.265;
    forearmPivot.add(hand);

    const thumb = new THREE.Mesh(geos.thumbGeo, hullMat);
    thumb.position.set(side * -0.052, -0.245, 0.025);
    forearmPivot.add(thumb);

    return { root: armRoot, forearmPivot };
  }

  private createLeg(
    geos: SharedLimbGeometries,
    hullMat: THREE.Material,
    trimMat: THREE.Material,
    cyanMat: THREE.Material,
    purpleMat: THREE.Material
  ): THREE.Group {
    const legGroup = new THREE.Group();

    const hip = new THREE.Mesh(geos.hipGeo, trimMat);
    legGroup.add(hip);

    const thigh = new THREE.Mesh(geos.thighGeo, hullMat);
    thigh.position.y = -0.11;
    legGroup.add(thigh);

    const kneeRing = new THREE.Mesh(geos.kneeRingGeo, purpleMat);
    kneeRing.rotation.x = Math.PI / 2;
    kneeRing.position.y = -0.22;
    legGroup.add(kneeRing);

    const shin = new THREE.Mesh(geos.shinGeo, hullMat);
    shin.position.y = -0.31;
    legGroup.add(shin);

    // Boot shell spans -0.39 .. -0.48, forward-biased (+Z) for clear front orientation
    const boot = new THREE.Mesh(geos.bootGeo, trimMat);
    boot.position.set(0, -0.435, 0.035);
    legGroup.add(boot);

    // Sole spans -0.48 .. -0.50 -> exact world y = 0.000 when hip is at y = 0.50
    const sole = new THREE.Mesh(geos.soleGeo, cyanMat);
    sole.position.set(0, -0.49, 0.035);
    legGroup.add(sole);

    return legGroup;
  }

  public applyQuality(profile: QualityProfile, isSoftwareGl: boolean): void {
    const shadowsActive = !isSoftwareGl && profile.shadowsEnabled;
    this.torso.castShadow = shadowsActive;
    this.torso.receiveShadow = shadowsActive;
    this.headMesh.castShadow = shadowsActive;
    this.headMesh.receiveShadow = shadowsActive;

    this.heartLight.visible = profile.enableRobotHeartLight;
    // Maintain crisp accent presence on Low when dynamic PointLight is disabled
    this.cyanEmissive.emissiveIntensity = profile.enableRobotHeartLight ? 1.35 : 1.75;
    this.purpleEmissive.emissiveIntensity = profile.enableRobotHeartLight ? 1.3 : 1.65;
  }

  private mapEmotionToExpression(emotion: CompanionEmotion): FacialExpressionState {
    if (emotion === 'greeting' || emotion === 'waving') return 'greeting';
    if (emotion === 'happy' || emotion === 'excited') return 'happy';
    if (emotion === 'curious') return 'curious';
    return 'neutral';
  }

  public setFacialExpression(expression: FacialExpressionState): void {
    this.currentExpression = expression;
    this.eyeCanvas.renderFace(expression, this.isBlinking);
  }

  public setEmotion(emotion: CompanionEmotion): void {
    this.currentEmotion = emotion;
    if (!this.isWaving) {
      this.setFacialExpression(this.mapEmotionToExpression(emotion));
    }
  }

  /**
   * Starts a coordinated, frame-rate-independent greeting sequence:
   * 1. Smoothly orients toward `faceYaw` (if provided and player isn't actively steering).
   * 2. Lifts right shoulder + bends elbow clear of head while smiling (`greeting`).
   * 3. Waves forearm cleanly with a friendly head tilt and mid-wave blink.
   * 4. Briefly holds a warm smile (`happy`) before damping back to neutral/idle.
   */
  public triggerGreeting(options?: { faceYaw?: number; reducedMotion?: boolean }): void {
    this.isWaving = true;
    this.greetingElapsed = 0;
    this.greetingDuration = options?.reducedMotion ? 1.55 : GREETING_TOTAL_DURATION_SEC;
    if (typeof options?.faceYaw === 'number' && !this.isMoving) {
      this.greetingTargetYaw = options.faceYaw;
      this.targetRotationY = options.faceYaw;
    } else {
      this.greetingTargetYaw = null;
    }
    this.currentEmotion = 'greeting';
    this.isBlinking = false;
    this.blinkTimer = 3.2;
    this.setFacialExpression('greeting');
  }

  public triggerWave(faceYaw?: number): void {
    this.triggerGreeting(typeof faceYaw === 'number' ? { faceYaw } : undefined);
  }

  public update(
    dt: number,
    elapsedSec: number = performance.now() * 0.001,
    prefersReducedMotion: boolean = false
  ): void {
    // 1. Coordinated Greeting Timeline vs Natural Idle Blinking
    let desiredRightShoulderX = 0;
    let desiredRightShoulderZ = 0;
    let desiredRightForearmX = 0;
    let desiredRightForearmZ = 0;
    let desiredHeadTiltZ = 0;
    let desiredHeadYaw = 0;
    let desiredHeadPitch = 0;
    let greetingLiftY = 0;

    if (this.isWaving) {
      this.greetingElapsed += dt;
      const t = this.greetingElapsed;
      const total = this.greetingDuration;

      // Cancel automatic camera-facing turn immediately if player starts moving
      if (this.isMoving) {
        this.greetingTargetYaw = null;
      } else if (this.greetingTargetYaw !== null) {
        this.targetRotationY = this.greetingTargetYaw;
      }

      if (t >= total) {
        this.isWaving = false;
        this.greetingElapsed = 0;
        this.greetingTargetYaw = null;
        this.isBlinking = false;
        const postEmotion: CompanionEmotion = this.isMoving ? 'happy' : 'idle';
        this.currentEmotion = postEmotion;
        this.setFacialExpression(this.mapEmotionToExpression(postEmotion));
      } else if (prefersReducedMotion) {
        // Calm, low-amplitude wave for reduced-motion preference
        const env =
          t < 0.35
            ? smoothstep01(t / 0.35)
            : t > total - 0.4
            ? smoothstep01((total - t) / 0.4)
            : 1;
        desiredRightShoulderX = -0.52 * env;
        desiredRightShoulderZ = 0.56 * env;
        desiredRightForearmX = -1.55 * env;
        desiredRightForearmZ = Math.sin(t * 4.0) * 0.14 * env;
        desiredHeadTiltZ = -0.06 * env;
        this.setFacialExpression(t < total * 0.65 ? 'greeting' : 'happy');
      } else {
        // Full 4-phase coordinated greeting:
        // Phase 1 (0.00..0.35s): Smooth raise
        // Phase 2 (0.35..1.55s): Friendly 3-cycle forearm wave + mid-wave blink
        // Phase 3 (1.55..1.95s): Lower arm half-way while holding warm happy smile
        // Phase 4 (1.95..2.35s): Smooth return to neutral idle
        let armPoseWeight = 0;
        let waveOsc = 0;

        if (t < 0.35) {
          armPoseWeight = smoothstep01(t / 0.35);
          this.isBlinking = false;
          this.setFacialExpression('greeting');
        } else if (t < 1.55) {
          armPoseWeight = 1;
          const waveProgress = (t - 0.35) / 1.2;
          waveOsc = Math.sin(waveProgress * Math.PI * 6) * 0.34;
          // Single coordinated mid-greeting blink while keeping the wide smile
          this.isBlinking = t >= 0.88 && t <= 1.02;
          this.setFacialExpression('greeting');
        } else if (t < 1.95) {
          const holdProgress = smoothstep01((t - 1.55) / 0.4);
          armPoseWeight = 1 - holdProgress * 0.65;
          this.isBlinking = false;
          this.setFacialExpression('happy');
        } else {
          const settleProgress = smoothstep01((t - 1.95) / 0.4);
          armPoseWeight = 0.35 * (1 - settleProgress);
          this.isBlinking = false;
          this.setFacialExpression('happy');
        }

        // Shoulder abducts outward (+Z) & forward (-X), elbow bends upward (-X) cleanly clear of head
        desiredRightShoulderX = -0.56 * armPoseWeight;
        desiredRightShoulderZ = 0.62 * armPoseWeight;
        desiredRightForearmX = -1.66 * armPoseWeight;
        desiredRightForearmZ = waveOsc;
        desiredHeadTiltZ = (-0.11 + waveOsc * 0.14) * armPoseWeight;
        desiredHeadPitch = -0.04 * armPoseWeight;
        greetingLiftY = 0.022 * armPoseWeight;
      }
    } else {
      // Independent natural blinking in non-greeting states (preserves active mouth)
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        if (!this.isBlinking) {
          this.isBlinking = true;
          this.eyeCanvas.renderFace(this.currentExpression, true);
          this.blinkTimer = 0.13;
        } else {
          this.isBlinking = false;
          this.eyeCanvas.renderFace(this.currentExpression, false);
          this.blinkTimer = 2.8 + Math.random() * 3.2;
        }
      }

      if (!this.isMoving && !prefersReducedMotion) {
        // Subtle idle head micro-glance & pitch
        desiredHeadYaw = Math.sin(elapsedSec * 0.65) * 0.075;
        desiredHeadPitch = Math.sin(elapsedSec * 1.15) * 0.028;
      }
    }

    // 2. Smooth Root Rotation Damping
    const normalizedDiff = normalizeAngleDelta(this.targetRotationY, this.group.rotation.y);
    this.group.rotation.y += normalizedDiff * (1 - Math.exp(-11 * dt));

    // 3. Jump & Vertical Physics (applied to connected upperBodyGroup so limbs never detach)
    if (this.isJumping) {
      this.jumpVy -= 24 * dt;
      this.group.position.y += this.jumpVy * dt;

      if (this.jumpVy > 2 && !prefersReducedMotion) {
        this.upperBodyGroup.scale.set(0.95, 1.07, 0.95);
      }

      if (this.group.position.y <= 0) {
        this.group.position.y = 0;
        this.isJumping = false;
        this.jumpVy = 0;
        if (!prefersReducedMotion) {
          this.upperBodyGroup.scale.set(1.07, 0.93, 1.07);
        }
      }
    } else {
      this.upperBodyGroup.scale.lerp(VEC_ONE, 1 - Math.exp(-14 * dt));
    }

    // 4. Walk Cycle & Understated Idle Breathing (strictly grounded: feet never dip < y=0)
    if (this.isMoving && !this.isJumping) {
      this.walkPhase += dt * 10.5;
      const sinStep = Math.sin(this.walkPhase);
      const swing = sinStep * 0.4;

      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;

      // Analytical pitch clearance + stepping arc ensures soles stay >= y = 0.000 at all angles
      this.leftLeg.position.y =
        LEG_HIP_REST_Y +
        computeLegPitchClearance(this.leftLeg.rotation.x) +
        Math.max(0, sinStep) * 0.032;
      this.rightLeg.position.y =
        LEG_HIP_REST_Y +
        computeLegPitchClearance(this.rightLeg.rotation.x) +
        Math.max(0, -sinStep) * 0.032;

      this.leftArm.rotation.x = -swing * 0.65;
      this.leftForearmPivot.rotation.x = THREE.MathUtils.damp(
        this.leftForearmPivot.rotation.x,
        -0.18 - Math.max(0, -sinStep) * 0.2,
        10,
        dt
      );

      if (!this.isWaving) {
        desiredRightShoulderX = swing * 0.65;
        desiredRightForearmX = -0.18 - Math.max(0, sinStep) * 0.2;
      }

      const strideBounce = Math.abs(sinStep) * 0.036;
      this.upperBodyGroup.position.y = UPPER_BODY_REST_Y + strideBounce + greetingLiftY;
      this.upperBodyGroup.rotation.z = sinStep * 0.032;

      if (!this.isWaving && this.currentEmotion !== 'happy') {
        this.setEmotion('happy');
      }
    } else {
      const idleBreath = prefersReducedMotion ? 0 : Math.sin(elapsedSec * 1.9) * 0.014;
      this.leftLeg.rotation.x = THREE.MathUtils.damp(this.leftLeg.rotation.x, 0, 9, dt);
      this.rightLeg.rotation.x = THREE.MathUtils.damp(this.rightLeg.rotation.x, 0, 9, dt);
      this.leftLeg.position.y = THREE.MathUtils.damp(
        this.leftLeg.position.y,
        LEG_HIP_REST_Y + computeLegPitchClearance(this.leftLeg.rotation.x),
        12,
        dt
      );
      this.rightLeg.position.y = THREE.MathUtils.damp(
        this.rightLeg.position.y,
        LEG_HIP_REST_Y + computeLegPitchClearance(this.rightLeg.rotation.x),
        12,
        dt
      );

      this.leftArm.rotation.x = THREE.MathUtils.damp(this.leftArm.rotation.x, 0, 9, dt);
      this.leftArm.rotation.z = THREE.MathUtils.damp(this.leftArm.rotation.z, -0.05, 9, dt);
      this.leftForearmPivot.rotation.x = THREE.MathUtils.damp(
        this.leftForearmPivot.rotation.x,
        -0.1,
        9,
        dt
      );

      if (!this.isJumping) {
        this.upperBodyGroup.position.y = THREE.MathUtils.damp(
          this.upperBodyGroup.position.y,
          UPPER_BODY_REST_Y + idleBreath + greetingLiftY,
          10,
          dt
        );
      }
      this.upperBodyGroup.rotation.z = THREE.MathUtils.damp(
        this.upperBodyGroup.rotation.z,
        0,
        9,
        dt
      );

      if (!this.isWaving && this.currentEmotion === 'happy') {
        this.setEmotion('idle');
      }
    }

    // 5. Right Arm, Forearm & Head Damping (smoothly blends between idle, walk, and greeting)
    const armLambda = this.isWaving ? 16 : 10;
    this.rightArm.rotation.x = THREE.MathUtils.damp(
      this.rightArm.rotation.x,
      desiredRightShoulderX,
      armLambda,
      dt
    );
    this.rightArm.rotation.z = THREE.MathUtils.damp(
      this.rightArm.rotation.z,
      this.isWaving ? desiredRightShoulderZ : 0.05,
      armLambda,
      dt
    );
    this.rightForearmPivot.rotation.x = THREE.MathUtils.damp(
      this.rightForearmPivot.rotation.x,
      this.isWaving ? desiredRightForearmX : this.isMoving ? desiredRightForearmX : -0.1,
      armLambda,
      dt
    );
    this.rightForearmPivot.rotation.z = THREE.MathUtils.damp(
      this.rightForearmPivot.rotation.z,
      desiredRightForearmZ,
      18,
      dt
    );

    this.headGroup.position.y = HEAD_GROUP_REST_Y;
    this.headGroup.rotation.z = THREE.MathUtils.damp(
      this.headGroup.rotation.z,
      desiredHeadTiltZ,
      12,
      dt
    );
    this.headGroup.rotation.y = THREE.MathUtils.damp(
      this.headGroup.rotation.y,
      desiredHeadYaw,
      6,
      dt
    );
    this.headGroup.rotation.x = THREE.MathUtils.damp(
      this.headGroup.rotation.x,
      desiredHeadPitch,
      8,
      dt
    );

    // 6. Subtle Harmonic Core Pulse (only when PointLight is active on Medium/High)
    if (this.heartLight.visible && !prefersReducedMotion) {
      this.heartLight.intensity = 0.65 + Math.sin(elapsedSec * 2.6) * 0.16;
    }

    // 7. Ground Contact Shadow Scale
    const shadowScale = Math.max(0.58, 1 - this.group.position.y * 0.24);
    this.shadowPlane.scale.set(shadowScale, shadowScale, shadowScale);
  }

  public dispose(): void {
    this.eyeCanvas.dispose();
    if (this.ownsContactShadowTex) {
      this.contactShadowTex.dispose();
    }
    this.ownedGeometries.forEach((geo) => geo.dispose());
    this.ownedGeometries.length = 0;

    this.ownedMaterials.forEach((mat) => mat.dispose());
    this.ownedMaterials.length = 0;
  }
}
