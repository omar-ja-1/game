/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RobotEyeCanvas, createContactShadowTexture } from './proceduralAssets';
import { CompanionEmotion } from '../types/portfolio';
import { QualityProfile } from './qualityConfig';

const VEC_ONE = new THREE.Vector3(1, 1, 1);

interface SharedLimbGeometries {
  shoulderGeo: THREE.SphereGeometry;
  upperArmGeo: THREE.CylinderGeometry;
  elbowRingGeo: THREE.TorusGeometry;
  forearmGeo: THREE.CylinderGeometry;
  handGeo: THREE.SphereGeometry;
  hipGeo: THREE.SphereGeometry;
  thighGeo: THREE.CylinderGeometry;
  kneeGeo: THREE.TorusGeometry;
  footGeo: THREE.SphereGeometry;
  soleGeo: THREE.CylinderGeometry;
}

export class CompanionRobot {
  public group: THREE.Group;
  public headGroup: THREE.Group;
  public rightArm: THREE.Group;
  public leftArm: THREE.Group;
  public rightLeg: THREE.Group;
  public leftLeg: THREE.Group;
  public torso: THREE.Mesh;
  public antennaTip: THREE.Mesh;
  public heartCore: THREE.Mesh;
  public shadowPlane: THREE.Mesh;
  public eyeCanvas: RobotEyeCanvas;
  public eyeMaterial: THREE.MeshBasicMaterial;

  // Kinematic state
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public isMoving: boolean = false;
  public isJumping: boolean = false;
  public isWaving: boolean = false;
  public jumpVy: number = 0;
  public targetRotationY: number = 0;
  public currentEmotion: CompanionEmotion = 'idle';

  private walkPhase: number = 0;
  private wavePhase: number = 0;
  private blinkTimer: number = 2.5;
  private isBlinking: boolean = false;
  private heartLight: THREE.PointLight;
  private headMesh: THREE.Mesh;
  private amberEmissive: THREE.MeshStandardMaterial;

  private ownedGeometries: THREE.BufferGeometry[] = [];
  private ownedMaterials: THREE.Material[] = [];
  private ownsContactShadowTex: boolean = false;
  private contactShadowTex: THREE.Texture;

  constructor(sharedContactShadowTex?: THREE.Texture) {
    this.group = new THREE.Group();
    this.group.name = 'CompanionRobot';

    // Shared materials across robot parts
    const darkMattePanel = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x161c28,
        roughness: 0.72,
        metalness: 0.28,
      })
    );

    const darkAccentMetal = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x0f141d,
        roughness: 0.45,
        metalness: 0.65,
      })
    );

    const cyanEmissive = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x083344,
        emissive: 0x22d3ee,
        emissiveIntensity: 1.4,
        roughness: 0.3,
        metalness: 0.2,
      })
    );

    this.amberEmissive = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x451a03,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.8,
        roughness: 0.2,
        metalness: 0.3,
      })
    );

    // 1. Torso
    const torsoGeo = this.trackGeometry(new THREE.CylinderGeometry(0.42, 0.38, 0.82, 16));
    this.torso = new THREE.Mesh(torsoGeo, darkMattePanel);
    this.torso.position.y = 0.95;
    this.torso.castShadow = true;
    this.torso.receiveShadow = true;
    this.group.add(this.torso);

    // Cyan glowing belt seam
    const beltGeo = this.trackGeometry(new THREE.TorusGeometry(0.43, 0.025, 8, 24));
    const belt = new THREE.Mesh(beltGeo, cyanEmissive);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.82;
    this.group.add(belt);

    // Chest plate detail
    const chestPlateGeo = this.trackGeometry(new THREE.BoxGeometry(0.44, 0.32, 0.08));
    const chestPlate = new THREE.Mesh(chestPlateGeo, darkAccentMetal);
    chestPlate.position.set(0, 1.05, 0.38);
    this.group.add(chestPlate);

    // Amber glowing heart reactor / power core
    const heartGeo = this.trackGeometry(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16));
    this.heartCore = new THREE.Mesh(heartGeo, this.amberEmissive);
    this.heartCore.rotation.x = Math.PI / 2;
    this.heartCore.position.set(0, 1.05, 0.43);
    this.group.add(this.heartCore);

    // Heart light source casting subtle warm amber glow
    this.heartLight = new THREE.PointLight(0xf59e0b, 0.8, 2.5);
    this.heartLight.position.set(0, 1.05, 0.5);
    this.group.add(this.heartLight);

    // 2. Head Group (neck gimbal + rounded head + visor + antenna)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.48, 0);

    const neckGeo = this.trackGeometry(new THREE.CylinderGeometry(0.18, 0.22, 0.14, 16));
    const neck = new THREE.Mesh(neckGeo, darkAccentMetal);
    neck.position.y = -0.06;
    this.headGroup.add(neck);

    const headGeo = this.trackGeometry(new THREE.SphereGeometry(0.44, 20, 16));
    headGeo.scale(1.05, 0.95, 1.0);
    this.headMesh = new THREE.Mesh(headGeo, darkMattePanel);
    this.headMesh.castShadow = true;
    this.headGroup.add(this.headMesh);

    // Visor faceplate
    this.eyeCanvas = new RobotEyeCanvas();
    this.eyeMaterial = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        map: this.eyeCanvas.texture,
        transparent: true,
        toneMapped: false,
      })
    );
    const visorGeo = this.trackGeometry(
      new THREE.CylinderGeometry(0.445, 0.445, 0.36, 16, 1, false, -Math.PI * 0.28, Math.PI * 0.56)
    );
    const visor = new THREE.Mesh(visorGeo, this.eyeMaterial);
    visor.rotation.y = -Math.PI / 2;
    visor.position.set(0, 0.02, 0.01);
    this.headGroup.add(visor);

    // Antenna stem & bobbing tip
    const antennaStemGeo = this.trackGeometry(new THREE.CylinderGeometry(0.015, 0.025, 0.3, 8));
    const antennaStem = new THREE.Mesh(antennaStemGeo, darkAccentMetal);
    antennaStem.position.set(0, 0.56, 0);
    this.headGroup.add(antennaStem);

    const antennaTipGeo = this.trackGeometry(new THREE.SphereGeometry(0.06, 12, 12));
    this.antennaTip = new THREE.Mesh(antennaTipGeo, cyanEmissive);
    this.antennaTip.position.set(0, 0.72, 0);
    this.headGroup.add(this.antennaTip);

    // Cyan seam halo across top of head
    const headRingGeo = this.trackGeometry(new THREE.TorusGeometry(0.38, 0.018, 8, 20));
    const headRing = new THREE.Mesh(headRingGeo, cyanEmissive);
    headRing.rotation.x = Math.PI / 2;
    headRing.position.y = 0.24;
    this.headGroup.add(headRing);

    this.group.add(this.headGroup);

    // 3. Shared Geometries for Symmetric Arms & Legs (cuts 10 duplicate BufferGeometries)
    const handGeo = this.trackGeometry(new THREE.SphereGeometry(0.09, 12, 12));
    handGeo.scale(1, 0.8, 1.2);

    const footGeo = this.trackGeometry(new THREE.SphereGeometry(0.14, 14, 12));
    footGeo.scale(1, 0.7, 1.4);

    const limbGeos: SharedLimbGeometries = {
      shoulderGeo: this.trackGeometry(new THREE.SphereGeometry(0.12, 12, 12)),
      upperArmGeo: this.trackGeometry(new THREE.CylinderGeometry(0.08, 0.07, 0.28, 12)),
      elbowRingGeo: this.trackGeometry(new THREE.TorusGeometry(0.085, 0.015, 6, 16)),
      forearmGeo: this.trackGeometry(new THREE.CylinderGeometry(0.07, 0.065, 0.24, 12)),
      handGeo,
      hipGeo: this.trackGeometry(new THREE.SphereGeometry(0.11, 10, 10)),
      thighGeo: this.trackGeometry(new THREE.CylinderGeometry(0.1, 0.09, 0.26, 12)),
      kneeGeo: this.trackGeometry(new THREE.TorusGeometry(0.1, 0.018, 6, 16)),
      footGeo,
      soleGeo: this.trackGeometry(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 12)),
    };

    this.leftArm = this.createArm(limbGeos, darkMattePanel, darkAccentMetal, cyanEmissive);
    this.leftArm.position.set(-0.52, 1.15, 0);
    this.group.add(this.leftArm);

    this.rightArm = this.createArm(limbGeos, darkMattePanel, darkAccentMetal, cyanEmissive);
    this.rightArm.position.set(0.52, 1.15, 0);
    this.group.add(this.rightArm);

    this.leftLeg = this.createLeg(limbGeos, darkMattePanel, darkAccentMetal, cyanEmissive);
    this.leftLeg.position.set(-0.22, 0.52, 0);
    this.group.add(this.leftLeg);

    this.rightLeg = this.createLeg(limbGeos, darkMattePanel, darkAccentMetal, cyanEmissive);
    this.rightLeg.position.set(0.22, 0.52, 0);
    this.group.add(this.rightLeg);

    // 5. Radial Contact Shadow Plane
    const shadowGeo = this.trackGeometry(new THREE.PlaneGeometry(1.6, 1.6));
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
        opacity: 0.68,
        depthWrite: false,
      })
    );
    this.shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.position.y = 0.015;
    this.group.add(this.shadowPlane);
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
    geos: SharedLimbGeometries,
    darkMat: THREE.Material,
    metalMat: THREE.Material,
    glowMat: THREE.Material
  ): THREE.Group {
    const armGroup = new THREE.Group();

    const shoulder = new THREE.Mesh(geos.shoulderGeo, metalMat);
    armGroup.add(shoulder);

    const upper = new THREE.Mesh(geos.upperArmGeo, darkMat);
    upper.position.y = -0.16;
    armGroup.add(upper);

    const elbowRing = new THREE.Mesh(geos.elbowRingGeo, glowMat);
    elbowRing.rotation.x = Math.PI / 2;
    elbowRing.position.y = -0.3;
    armGroup.add(elbowRing);

    const fore = new THREE.Mesh(geos.forearmGeo, darkMat);
    fore.position.y = -0.42;
    armGroup.add(fore);

    const hand = new THREE.Mesh(geos.handGeo, metalMat);
    hand.position.y = -0.58;
    armGroup.add(hand);

    return armGroup;
  }

  private createLeg(
    geos: SharedLimbGeometries,
    darkMat: THREE.Material,
    metalMat: THREE.Material,
    glowMat: THREE.Material
  ): THREE.Group {
    const legGroup = new THREE.Group();

    const hip = new THREE.Mesh(geos.hipGeo, metalMat);
    legGroup.add(hip);

    const thigh = new THREE.Mesh(geos.thighGeo, darkMat);
    thigh.position.y = -0.14;
    legGroup.add(thigh);

    const knee = new THREE.Mesh(geos.kneeGeo, glowMat);
    knee.rotation.x = Math.PI / 2;
    knee.position.y = -0.26;
    legGroup.add(knee);

    const foot = new THREE.Mesh(geos.footGeo, darkMat);
    foot.position.set(0, -0.42, 0.04);
    legGroup.add(foot);

    const sole = new THREE.Mesh(geos.soleGeo, glowMat);
    sole.position.set(0, -0.5, 0.04);
    legGroup.add(sole);

    return legGroup;
  }

  public applyQuality(profile: QualityProfile, isSoftwareGl: boolean) {
    const shadowsActive = !isSoftwareGl && profile.shadowsEnabled;
    this.torso.castShadow = shadowsActive;
    this.torso.receiveShadow = shadowsActive;
    this.headMesh.castShadow = shadowsActive;

    this.heartLight.visible = profile.enableRobotHeartLight;
    // Keep amber reactor visibly radiant when dynamic PointLight is disabled on mobile
    this.amberEmissive.emissiveIntensity = profile.enableRobotHeartLight ? 1.8 : 2.3;
  }

  public setEmotion(emotion: CompanionEmotion) {
    if (this.currentEmotion !== emotion) {
      this.currentEmotion = emotion;
      this.eyeCanvas.renderState(emotion === 'waving' ? 'happy' : emotion);
    }
  }

  public triggerWave() {
    this.isWaving = true;
    this.wavePhase = 0;
    this.setEmotion('waving');
  }

  public update(dt: number, elapsedSec: number = performance.now() * 0.001) {
    // 1. Natural Blinking Cycle
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      if (!this.isBlinking) {
        this.isBlinking = true;
        this.eyeCanvas.renderState('blink');
        this.blinkTimer = 0.14;
      } else {
        this.isBlinking = false;
        this.eyeCanvas.renderState(this.isWaving ? 'happy' : this.currentEmotion);
        this.blinkTimer = 2.5 + Math.random() * 3.5;
      }
    }

    // 2. Rotation damping toward movement direction
    const rotDiff = this.targetRotationY - this.group.rotation.y;
    const normalizedDiff = Math.atan2(Math.sin(rotDiff), Math.cos(rotDiff));
    this.group.rotation.y += normalizedDiff * (1 - Math.exp(-12 * dt));

    // 3. Jump and vertical physics
    if (this.isJumping) {
      this.jumpVy -= 24 * dt;
      this.group.position.y += this.jumpVy * dt;

      if (this.jumpVy > 2) {
        this.torso.scale.set(0.92, 1.12, 0.92);
      }

      if (this.group.position.y <= 0) {
        this.group.position.y = 0;
        this.isJumping = false;
        this.jumpVy = 0;
        this.torso.scale.set(1.15, 0.85, 1.15);
      }
    } else {
      this.torso.scale.lerp(VEC_ONE, 1 - Math.exp(-14 * dt));
    }

    // 4. Walk Cycle & Idle Hover
    if (this.isMoving && !this.isJumping) {
      this.walkPhase += dt * 11;
      const swing = Math.sin(this.walkPhase) * 0.45;

      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;

      this.leftArm.rotation.x = -swing * 0.7;
      if (!this.isWaving) {
        this.rightArm.rotation.x = swing * 0.7;
      }

      const absStride = Math.abs(Math.sin(this.walkPhase));
      this.torso.position.y = 0.95 + absStride * 0.05;
      this.headGroup.position.y = 1.48 + absStride * 0.03;
      this.torso.rotation.z = Math.sin(this.walkPhase) * 0.04;
    } else {
      const idlePhase = elapsedSec * 2.0;
      const idleBob = Math.sin(idlePhase) * 0.02;
      this.leftLeg.rotation.x = THREE.MathUtils.damp(this.leftLeg.rotation.x, 0, 8, dt);
      this.rightLeg.rotation.x = THREE.MathUtils.damp(this.rightLeg.rotation.x, 0, 8, dt);
      this.leftArm.rotation.x = THREE.MathUtils.damp(this.leftArm.rotation.x, 0, 8, dt);
      if (!this.isWaving) {
        this.rightArm.rotation.x = THREE.MathUtils.damp(this.rightArm.rotation.x, 0, 8, dt);
      }

      if (!this.isJumping) {
        this.torso.position.y = 0.95 + idleBob;
        this.headGroup.position.y = 1.48 + idleBob;
      }
      this.torso.rotation.z = THREE.MathUtils.damp(this.torso.rotation.z, 0, 8, dt);
    }

    // 5. Waving Animation
    if (this.isWaving) {
      this.wavePhase += dt * 8;
      this.rightArm.rotation.x = -Math.PI * 0.75;
      this.rightArm.rotation.z = 0.4 + Math.sin(this.wavePhase) * 0.35;
      this.headGroup.rotation.z = Math.sin(this.wavePhase * 0.5) * 0.12;

      if (this.wavePhase > Math.PI * 5) {
        this.isWaving = false;
        this.setEmotion(this.isMoving ? 'happy' : 'idle');
      }
    } else {
      this.rightArm.rotation.z = THREE.MathUtils.damp(this.rightArm.rotation.z, 0, 10, dt);
      this.headGroup.rotation.z = THREE.MathUtils.damp(this.headGroup.rotation.z, 0, 10, dt);
    }

    // 6. Heart subtle light pulsing (only when light active)
    if (this.heartLight.visible) {
      this.heartLight.intensity = 0.8 + Math.sin(elapsedSec * 3.0) * 0.25;
    }

    // Shadow plane scale reflects height
    const shadowScale = Math.max(0.6, 1 - this.group.position.y * 0.25);
    this.shadowPlane.scale.set(shadowScale, shadowScale, shadowScale);
  }

  public dispose() {
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
