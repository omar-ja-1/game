/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ExhibitData } from '../types/portfolio';

export class HologramBillboard {
  public group: THREE.Group;
  public data: ExhibitData;
  public hologramMesh: THREE.Mesh;
  public light: THREE.PointLight;
  public particles: THREE.Points;
  public isPlayerNearby: boolean = false;

  private particlePositions: Float32Array;
  private particleCount: number = 36;
  private scanlinePhase: number = 0;
  private promptMesh: THREE.Mesh;

  constructor(data: ExhibitData, textureLoader: THREE.TextureLoader) {
    this.data = data;
    this.group = new THREE.Group();
    this.group.name = `HologramBillboard_${data.id}`;
    this.group.position.set(...data.position);
    this.group.rotation.y = data.rotationY;

    // 1. Pedestal Base on Ground
    const baseMetal = new THREE.MeshStandardMaterial({
      color: 0x0a0e17,
      roughness: 0.6,
      metalness: 0.7,
    });

    const glowColor = data.glowColor;
    const glowMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.85,
    });

    // Outer octagonal or rounded platform
    const platformGeo = new THREE.CylinderGeometry(2.4, 2.6, 0.12, 24);
    const platform = new THREE.Mesh(platformGeo, baseMetal);
    platform.position.y = 0.06;
    platform.receiveShadow = true;
    this.group.add(platform);

    // Glowing emitter ring on floor
    const ringGeo = new THREE.TorusGeometry(2.1, 0.035, 8, 32);
    const ring = new THREE.Mesh(ringGeo, glowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.13;
    this.group.add(ring);

    // Twin Projector Emitter Pylons
    [-1.8, 1.8].forEach((xOffset) => {
      const pylonGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.5, 12);
      const pylon = new THREE.Mesh(pylonGeo, baseMetal);
      pylon.position.set(xOffset, 0.25, 0);
      this.group.add(pylon);

      const lensGeo = new THREE.SphereGeometry(0.09, 12, 12);
      const lens = new THREE.Mesh(lensGeo, glowMat);
      lens.position.set(xOffset, 0.52, 0);
      this.group.add(lens);
    });

    // 2. Holographic Display Plane
    // Load generated image
    const texture = textureLoader.load(data.imageAsset);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    const isPortrait = data.terminalType === 'profile';
    const displayWidth = isPortrait ? 3.0 : 4.0;
    const displayHeight = isPortrait ? 4.0 : 3.0;

    const holoGeo = new THREE.PlaneGeometry(displayWidth, displayHeight);
    const holoMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.hologramMesh = new THREE.Mesh(holoGeo, holoMat);
    this.hologramMesh.position.set(0, 2.6, 0);
    this.group.add(this.hologramMesh);

    // Subtle scanline overlay plane
    const scanlineMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.12,
      wireframe: true,
      depthWrite: false,
    });
    const scanlineMesh = new THREE.Mesh(new THREE.PlaneGeometry(displayWidth * 1.02, displayHeight * 1.02, 1, 32), scanlineMat);
    scanlineMesh.position.set(0, 2.6, 0.02);
    this.group.add(scanlineMesh);

    // 3. Hovering Title & Metadata Plaque
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 128;
    const ctx = labelCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(6, 10, 18, 0.75)';
      ctx.roundRect(16, 16, 480, 96, 16);
      ctx.fill();

      ctx.strokeStyle = data.accentColor;
      ctx.lineWidth = 2;
      ctx.roundRect(16, 16, 480, 96, 16);
      ctx.stroke();

      ctx.fillStyle = data.accentColor;
      ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(data.title.split('//')[0].trim(), 256, 56);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = '18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(data.category, 256, 88);
    }
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    labelTex.colorSpace = THREE.SRGBColorSpace;
    const labelPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.6),
      new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, side: THREE.DoubleSide })
    );
    labelPlane.position.set(0, 0.75, 0.2);
    this.group.add(labelPlane);

    // 4. "Press E to Inspect" Prompt Banner (floats when nearby)
    const promptCanvas = document.createElement('canvas');
    promptCanvas.width = 256;
    promptCanvas.height = 64;
    const pCtx = promptCanvas.getContext('2d');
    if (pCtx) {
      pCtx.fillStyle = 'rgba(10, 16, 26, 0.9)';
      pCtx.roundRect(8, 8, 240, 48, 8);
      pCtx.fill();

      pCtx.strokeStyle = '#22d3ee';
      pCtx.lineWidth = 1.5;
      pCtx.roundRect(8, 8, 240, 48, 8);
      pCtx.stroke();

      pCtx.fillStyle = '#22d3ee';
      pCtx.font = 'bold 20px "JetBrains Mono", monospace';
      pCtx.textAlign = 'center';
      pCtx.fillText('[E] INSPECT', 128, 38);
    }
    const promptTex = new THREE.CanvasTexture(promptCanvas);
    this.promptMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.3),
      new THREE.MeshBasicMaterial({ map: promptTex, transparent: true, side: THREE.DoubleSide })
    );
    this.promptMesh.position.set(0, 4.4, 0);
    this.promptMesh.visible = false;
    this.group.add(this.promptMesh);

    // 5. Upward Drifting Hologram Particles
    const pGeo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.particleCount * 3);
    for (let i = 0; i < this.particleCount; i++) {
      this.particlePositions[i * 3] = (Math.random() - 0.5) * displayWidth * 0.9;
      this.particlePositions[i * 3 + 1] = Math.random() * 4.0 + 0.5;
      this.particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: glowColor,
      size: 0.08,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.particles = new THREE.Points(pGeo, pMat);
    this.group.add(this.particles);

    // 6. PointLight casting atmospheric glow
    this.light = new THREE.PointLight(glowColor, 1.2, 8.0);
    this.light.position.set(0, 2.5, 0.8);
    this.group.add(this.light);
  }

  public setPlayerNearby(nearby: boolean) {
    this.isPlayerNearby = nearby;
    this.promptMesh.visible = nearby;
    // Brighten light slightly when player is in range
    this.light.intensity = nearby ? 2.0 : 1.2;
  }

  public update(dt: number) {
    // 1. Gentle floating levitation bob
    const t = performance.now() * 0.0018;
    this.hologramMesh.position.y = 2.6 + Math.sin(t + this.group.position.x) * 0.06;

    // 2. Subtle scanline flicker & opacity breathing
    this.scanlinePhase += dt * 3;
    const flicker = 0.88 + Math.sin(this.scanlinePhase * 2.5) * 0.08;
    (this.hologramMesh.material as THREE.MeshBasicMaterial).opacity = flicker;

    // 3. Prompt bobbing when visible
    if (this.promptMesh.visible) {
      this.promptMesh.position.y = 4.4 + Math.sin(t * 3) * 0.05;
    }

    // 4. Upward Drifting Particle Simulation
    const pos = this.particles.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < this.particleCount; i++) {
      pos[i * 3 + 1] += dt * 0.65;
      if (pos[i * 3 + 1] > 4.6) {
        pos[i * 3 + 1] = 0.4;
      }
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
  }
}
