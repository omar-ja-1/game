/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { WorldBillboardNode } from '../types/portfolio';
import { MAX_BILLBOARD_PARTICLES, QualityProfile } from './qualityConfig';
import { SharedTexturePool, drawBillboardSummaryCard } from './proceduralAssets';

export interface BillboardSharedResources {
  baseMetal: THREE.MeshStandardMaterial;
  platformGeo: THREE.CylinderGeometry;
  ringGeo: THREE.TorusGeometry;
  pylonGeo: THREE.CylinderGeometry;
  lensGeo: THREE.SphereGeometry;
  labelGeo: THREE.PlaneGeometry;
  promptGeo: THREE.PlaneGeometry;
  floorGlowGeo: THREE.PlaneGeometry;
  hitProxyGeo: THREE.BoxGeometry;
  hitProxyMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export class HologramBillboard {
  public static createSharedResources(_texturePool: SharedTexturePool): BillboardSharedResources {
    const baseMetal = new THREE.MeshStandardMaterial({
      color: 0x0a0e17,
      roughness: 0.6,
      metalness: 0.7,
    });
    const platformGeo = new THREE.CylinderGeometry(2.3, 2.5, 0.12, 18);
    const ringGeo = new THREE.TorusGeometry(2.05, 0.035, 8, 26);
    const pylonGeo = new THREE.CylinderGeometry(0.11, 0.15, 0.5, 8);
    const lensGeo = new THREE.SphereGeometry(0.085, 8, 8);
    const labelGeo = new THREE.PlaneGeometry(2.6, 0.55);
    const promptGeo = new THREE.PlaneGeometry(2.3, 0.4);
    const floorGlowGeo = new THREE.PlaneGeometry(6.4, 6.4);
    const hitProxyGeo = new THREE.BoxGeometry(4.4, 4.4, 1.4);
    const hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });

    return {
      baseMetal,
      platformGeo,
      ringGeo,
      pylonGeo,
      lensGeo,
      labelGeo,
      promptGeo,
      floorGlowGeo,
      hitProxyGeo,
      hitProxyMat,
      dispose: () => {
        baseMetal.dispose();
        platformGeo.dispose();
        ringGeo.dispose();
        pylonGeo.dispose();
        lensGeo.dispose();
        labelGeo.dispose();
        promptGeo.dispose();
        floorGlowGeo.dispose();
        hitProxyGeo.dispose();
        hitProxyMat.dispose();
      },
    };
  }

  public group: THREE.Group;
  public node: WorldBillboardNode;
  public hologramMesh: THREE.Mesh;
  public hitProxyMesh: THREE.Mesh;
  public light: THREE.PointLight;
  public particles: THREE.Points;
  public isPlayerNearby: boolean = false;

  private billboardIndex: number;
  private texturePool: SharedTexturePool;
  private onTextureReady?: () => void;
  private displayWidth: number;
  private displayHeight: number;
  private platformMesh: THREE.Mesh;
  private holoGeo: THREE.PlaneGeometry;
  private holoMat: THREE.MeshBasicMaterial;
  private cardCanvas: HTMLCanvasElement;
  private cardTex: THREE.CanvasTexture;
  private currentCardWidth: number;
  private loadedImg: HTMLImageElement | null = null;
  private imageRequested: boolean = false;
  private isDisposed: boolean = false;

  private glowMat: THREE.MeshBasicMaterial;
  private scanlineMesh: THREE.Mesh;
  private scanlineGeo: THREE.PlaneGeometry;
  private scanlineMat: THREE.MeshBasicMaterial;
  private currentScanlineSegments: number;
  private labelTex: THREE.CanvasTexture;
  private labelMat: THREE.MeshBasicMaterial;
  private promptMesh: THREE.Mesh;
  private promptMat: THREE.MeshBasicMaterial;
  private floorGlowMesh: THREE.Mesh;
  private floorGlowMat: THREE.MeshBasicMaterial;
  private particleGeo: THREE.BufferGeometry;
  private particleMat: THREE.PointsMaterial;
  private particlePositions: Float32Array;
  private activeParticleCount: number;
  private enablePointLight: boolean = false;
  private scanlinePhase: number = 0;

  constructor(
    node: WorldBillboardNode,
    billboardIndex: number,
    shared: BillboardSharedResources,
    texturePool: SharedTexturePool,
    initialProfile: QualityProfile,
    maxRendererAnisotropy: number,
    isSoftwareGl: boolean,
    onTextureReady?: () => void
  ) {
    this.node = node;
    this.billboardIndex = billboardIndex;
    this.texturePool = texturePool;
    this.onTextureReady = onTextureReady;

    this.group = new THREE.Group();
    this.group.name = `HologramBillboard_${node.id}`;
    this.group.position.set(...node.position);
    this.group.rotation.y = node.rotationY;

    const glowColor = node.glowColor;
    this.glowMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.88,
    });

    // 1. Pedestal Base on Ground
    this.platformMesh = new THREE.Mesh(shared.platformGeo, shared.baseMetal);
    this.platformMesh.position.y = 0.06;
    this.platformMesh.receiveShadow = !isSoftwareGl && initialProfile.shadowsEnabled;
    this.group.add(this.platformMesh);

    const ring = new THREE.Mesh(shared.ringGeo, this.glowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.13;
    this.group.add(ring);

    // Twin Projector Emitter Pylons
    [-1.75, 1.75].forEach((xOffset) => {
      const pylon = new THREE.Mesh(shared.pylonGeo, shared.baseMetal);
      pylon.position.set(xOffset, 0.25, 0);
      this.group.add(pylon);

      const lens = new THREE.Mesh(shared.lensGeo, this.glowMat);
      lens.position.set(xOffset, 0.52, 0);
      this.group.add(lens);
    });

    // Lightweight Floor Glow Decal
    this.floorGlowMat = new THREE.MeshBasicMaterial({
      map: texturePool.getRadialGlowTexture(node.accentColor),
      transparent: true,
      opacity: initialProfile.enableBillboardLights ? 0.24 : 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.floorGlowMesh = new THREE.Mesh(shared.floorGlowGeo, this.floorGlowMat);
    this.floorGlowMesh.rotation.x = -Math.PI / 2;
    this.floorGlowMesh.position.y = 0.018;
    this.group.add(this.floorGlowMesh);

    // 2. Data-Driven Holographic Summary Card (instant procedural render; artwork loaded lazily on proximity)
    this.displayWidth = node.isPortrait ? 3.2 : 4.2;
    this.displayHeight = node.isPortrait ? 3.95 : 3.2;

    this.currentCardWidth = initialProfile.summaryCardWidth;
    this.cardCanvas = document.createElement('canvas');
    drawBillboardSummaryCard(this.cardCanvas, node, this.currentCardWidth, null);

    const anisotropy = Math.min(maxRendererAnisotropy, initialProfile.maxAnisotropyCap);
    this.cardTex = new THREE.CanvasTexture(this.cardCanvas);
    this.cardTex.colorSpace = THREE.SRGBColorSpace;
    this.cardTex.anisotropy = anisotropy;
    this.cardTex.generateMipmaps = initialProfile.tier !== 'low';
    this.cardTex.minFilter =
      initialProfile.tier === 'low' ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
    this.cardTex.needsUpdate = true;

    this.holoGeo = new THREE.PlaneGeometry(this.displayWidth, this.displayHeight);
    this.holoMat = new THREE.MeshBasicMaterial({
      map: this.cardTex,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
    });

    this.hologramMesh = new THREE.Mesh(this.holoGeo, this.holoMat);
    this.hologramMesh.position.set(0, 2.65, 0);
    this.group.add(this.hologramMesh);

    // Invisible simplified raycast proxy box for touch/click targeting
    this.hitProxyMesh = new THREE.Mesh(shared.hitProxyGeo, shared.hitProxyMat);
    this.hitProxyMesh.position.set(0, 2.3, 0);
    this.hitProxyMesh.userData.billboardNode = node;
    this.group.add(this.hitProxyMesh);

    // Optional scanline overlay (disabled on Low to eliminate extra transparent wireframe pass)
    this.currentScanlineSegments = initialProfile.scanlineSegments;
    this.scanlineGeo = new THREE.PlaneGeometry(
      this.displayWidth * 1.01,
      this.displayHeight * 1.01,
      1,
      this.currentScanlineSegments
    );
    this.scanlineMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.08,
      wireframe: true,
      depthWrite: false,
    });
    this.scanlineMesh = new THREE.Mesh(this.scanlineGeo, this.scanlineMat);
    this.scanlineMesh.position.set(0, 2.65, 0.02);
    this.scanlineMesh.visible = initialProfile.enableScanlineOverlay;
    this.group.add(this.scanlineMesh);

    // 3. Lower Pedestal Identification Plaque
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 112;
    const ctx = labelCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(6, 10, 18, 0.9)';
      ctx.beginPath();
      ctx.roundRect(12, 12, 488, 88, 14);
      ctx.fill();

      ctx.strokeStyle = node.accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(12, 12, 488, 88, 14);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.title.slice(0, 28), 256, 52);

      ctx.fillStyle = node.accentColor;
      ctx.font = '500 16px "JetBrains Mono", monospace';
      ctx.fillText(node.kicker.slice(0, 34), 256, 82);
    }
    this.labelTex = new THREE.CanvasTexture(labelCanvas);
    this.labelTex.colorSpace = THREE.SRGBColorSpace;
    this.labelTex.anisotropy = anisotropy;
    this.labelTex.generateMipmaps = false;
    this.labelTex.minFilter = THREE.LinearFilter;
    this.labelMat = new THREE.MeshBasicMaterial({
      map: this.labelTex,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const labelPlane = new THREE.Mesh(shared.labelGeo, this.labelMat);
    labelPlane.position.set(0, 0.68, 0.24);
    this.group.add(labelPlane);

    // 4. Contextual Action Prompt Banner (shared via texturePool)
    this.promptMat = new THREE.MeshBasicMaterial({
      map: texturePool.getPromptTexture(node.promptLabel, node.accentColor),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.promptMesh = new THREE.Mesh(shared.promptGeo, this.promptMat);
    this.promptMesh.position.set(0, node.isPortrait ? 4.85 : 4.5, 0);
    this.promptMesh.visible = false;
    this.group.add(this.promptMesh);

    // 5. Upward Drifting Hologram Particles
    this.particleGeo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(MAX_BILLBOARD_PARTICLES * 3);
    for (let i = 0; i < MAX_BILLBOARD_PARTICLES; i++) {
      this.particlePositions[i * 3] = (Math.random() - 0.5) * this.displayWidth * 0.9;
      this.particlePositions[i * 3 + 1] = Math.random() * 4.0 + 0.5;
      this.particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    this.particleGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.particlePositions, 3)
    );
    this.activeParticleCount = initialProfile.billboardParticleCount;
    this.particleGeo.setDrawRange(0, this.activeParticleCount);

    this.particleMat = new THREE.PointsMaterial({
      color: glowColor,
      size: 0.075,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.particles = new THREE.Points(this.particleGeo, this.particleMat);
    this.particles.visible = this.activeParticleCount > 0;
    this.group.add(this.particles);

    // 6. Optional PointLight (capped by WorldScene so large zones never spawn unbounded lights)
    this.enablePointLight = initialProfile.enableBillboardLights && billboardIndex < 6;
    this.light = new THREE.PointLight(glowColor, 1.15, 7.5);
    this.light.position.set(0, 2.5, 0.8);
    this.light.visible = this.enablePointLight;
    this.group.add(this.light);
  }

  private maybeRequestLazyImage() {
    if (this.imageRequested || !this.node.imageUrl || this.isDisposed) return;
    this.imageRequested = true;

    this.texturePool
      .loadImageShared(this.node.imageUrl)
      .then((img) => {
        if (this.isDisposed) return;
        this.loadedImg = img;
        drawBillboardSummaryCard(this.cardCanvas, this.node, this.currentCardWidth, img);
        this.cardTex.needsUpdate = true;
        this.onTextureReady?.();
      })
      .catch(() => {
        // Keep clean procedural summary card on image error
      });
  }

  public applyQuality(
    profile: QualityProfile,
    maxRendererAnisotropy: number,
    isSoftwareGl: boolean
  ) {
    this.platformMesh.receiveShadow = !isSoftwareGl && profile.shadowsEnabled;

    // Never allow more than 6 active billboard PointLights even in large project zones
    this.enablePointLight = profile.enableBillboardLights && this.billboardIndex < 6;
    this.light.visible = this.enablePointLight;
    this.syncGlowIntensity();

    this.activeParticleCount = profile.billboardParticleCount;
    this.particleGeo.setDrawRange(0, this.activeParticleCount);
    this.particles.visible = this.activeParticleCount > 0;

    this.scanlineMesh.visible = profile.enableScanlineOverlay;

    const anisotropy = Math.min(maxRendererAnisotropy, profile.maxAnisotropyCap);
    this.labelTex.anisotropy = anisotropy;
    this.cardTex.anisotropy = anisotropy;

    if (this.currentCardWidth !== profile.summaryCardWidth) {
      this.currentCardWidth = profile.summaryCardWidth;
      drawBillboardSummaryCard(
        this.cardCanvas,
        this.node,
        this.currentCardWidth,
        this.loadedImg
      );
      this.cardTex.needsUpdate = true;
    }

    if (
      profile.enableScanlineOverlay &&
      this.currentScanlineSegments !== profile.scanlineSegments
    ) {
      this.currentScanlineSegments = profile.scanlineSegments;
      this.scanlineGeo.dispose();
      this.scanlineGeo = new THREE.PlaneGeometry(
        this.displayWidth * 1.01,
        this.displayHeight * 1.01,
        1,
        this.currentScanlineSegments
      );
      this.scanlineMesh.geometry = this.scanlineGeo;
    }
  }

  private syncGlowIntensity() {
    if (this.enablePointLight) {
      this.light.intensity = this.isPlayerNearby ? 2.0 : 1.15;
      this.floorGlowMat.opacity = this.isPlayerNearby ? 0.42 : 0.24;
    } else {
      this.floorGlowMat.opacity = this.isPlayerNearby ? 0.85 : 0.6;
    }
    this.glowMat.opacity = this.isPlayerNearby ? 1.0 : 0.85;
  }

  public setPlayerNearby(nearby: boolean) {
    if (this.isPlayerNearby === nearby) return;
    this.isPlayerNearby = nearby;
    this.promptMesh.visible = nearby;
    this.syncGlowIntensity();
  }

  public update(
    dt: number,
    elapsedSec: number,
    frameIndex: number,
    distSqToPlayer: number,
    profile: QualityProfile,
    reducedMotion: boolean = false
  ) {
    // Lazy-load image only when player approaches within profile's lazyImageLoadDistance
    const lazyDist = profile.lazyImageLoadDistance;
    if (!this.imageRequested && this.node.imageUrl && distSqToPlayer <= lazyDist * lazyDist) {
      this.maybeRequestLazyImage();
    }

    const basePromptY = this.node.isPortrait ? 4.85 : 4.5;
    if (reducedMotion) {
      this.hologramMesh.position.y = 2.65;
      if (this.promptMesh.visible) {
        this.promptMesh.position.y = basePromptY;
      }
      return;
    }

    const t = elapsedSec * 1.8;

    if (this.promptMesh.visible) {
      this.promptMesh.position.y = basePromptY + Math.sin(t * 3) * 0.05;
    }

    const maxDist = profile.decorativeCullDistance;
    if (!this.isPlayerNearby && maxDist < Infinity && distSqToPlayer > maxDist * maxDist) {
      return;
    }

    this.hologramMesh.position.y = 2.65 + Math.sin(t + this.group.position.x * 0.4) * 0.055;
    if (this.scanlineMesh.visible) {
      this.scanlineMesh.position.y = this.hologramMesh.position.y;
    }

    this.scanlinePhase += dt * 2.5;
    this.holoMat.opacity = 0.94 + Math.sin(this.scanlinePhase * 2.0) * 0.04;

    if (this.activeParticleCount > 0) {
      const stride = profile.decorativeUpdateStride;
      if (stride <= 1 || (frameIndex + this.billboardIndex) % stride === 0) {
        const effectiveDt = dt * stride;
        const pos = this.particlePositions;
        const count = this.activeParticleCount;
        for (let i = 0; i < count; i++) {
          const yIdx = i * 3 + 1;
          pos[yIdx] += effectiveDt * 0.6;
          if (pos[yIdx] > 4.6) {
            pos[yIdx] = 0.4;
          }
        }
        this.particleGeo.attributes.position.needsUpdate = true;
      }
    }
  }

  public dispose() {
    this.isDisposed = true;
    this.holoGeo.dispose();
    this.holoMat.dispose();
    this.cardTex.dispose();
    this.glowMat.dispose();
    this.scanlineGeo.dispose();
    this.scanlineMat.dispose();
    this.labelTex.dispose();
    this.labelMat.dispose();
    this.promptMat.dispose();
    this.floorGlowMat.dispose();
    this.particleGeo.dispose();
    this.particleMat.dispose();
  }
}
