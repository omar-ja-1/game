/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

/**
 * Generates procedural floor grid texture with glowing cyan lines
 * and subtle sub-division dots on dark reflective charcoal/navy background.
 */
export function createFloorGridTexture(anisotropy: number = 4): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Dark deep navy/charcoal base
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, size, size);

    // Subtle dark slate secondary tiles
    ctx.strokeStyle = 'rgba(20, 32, 50, 0.4)';
    ctx.lineWidth = 1;
    const subStep = size / 32;
    for (let i = 0; i <= size; i += subStep) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    // Primary glowing cyan grid lines
    const mainStep = size / 4;
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)'; // Cyan
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= size; i += mainStep) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    // Grid intersection cyan glowing dots
    ctx.fillStyle = 'rgba(34, 211, 238, 0.85)';
    for (let x = 0; x <= size; x += mainStep) {
      for (let y = 0; y <= size; y += mainStep) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Soft secondary outer glow
        ctx.fillStyle = 'rgba(34, 211, 238, 0.15)';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(34, 211, 238, 0.85)';
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(anisotropy, 8);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a soft radial contact shadow texture.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
    gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.45)');
    gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Dynamic canvas texture for the robot companion's expressive glowing eyes.
 */
export class RobotEyeCanvas {
  public canvas: HTMLCanvasElement;
  public texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D | null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 128;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.renderState('idle');
  }

  public renderState(state: 'idle' | 'happy' | 'waving' | 'curious' | 'blink' | 'excited') {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Dark visor faceplate
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, w, h);

    const leftX = w * 0.32;
    const rightX = w * 0.68;
    const centerY = h * 0.5;

    ctx.fillStyle = '#22d3ee'; // Cyan glow
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';

    if (state === 'blink') {
      // Horizontal subtle line
      ctx.beginPath();
      ctx.moveTo(leftX - 18, centerY);
      ctx.lineTo(leftX + 18, centerY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rightX - 18, centerY);
      ctx.lineTo(rightX + 18, centerY);
      ctx.stroke();
    } else if (state === 'happy' || state === 'waving' || state === 'excited') {
      // Cute arched eyes ^ ^
      ctx.beginPath();
      ctx.arc(leftX, centerY + 8, 16, Math.PI, 0, false);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(rightX, centerY + 8, 16, Math.PI, 0, false);
      ctx.stroke();
    } else if (state === 'curious') {
      // Rounded tall circular eyes o o
      ctx.beginPath();
      ctx.ellipse(leftX, centerY, 16, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(rightX, centerY, 16, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Idle: friendly rounded capsule pills with soft pupil sparkle
      ctx.beginPath();
      ctx.roundRect(leftX - 12, centerY - 18, 24, 36, 12);
      ctx.fill();

      ctx.beginPath();
      ctx.roundRect(rightX - 12, centerY - 18, 24, 36, 12);
      ctx.fill();

      // Soft light spark highlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(leftX - 3, centerY - 6, 4, 0, Math.PI * 2);
      ctx.arc(rightX - 3, centerY - 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    this.texture.needsUpdate = true;
  }

  public dispose() {
    this.texture.dispose();
  }
}

/**
 * Creates particle point glow texture.
 */
export function createGlowParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(34, 211, 238, 1)');
    gradient.addColorStop(0.3, 'rgba(34, 211, 238, 0.6)');
    gradient.addColorStop(0.7, 'rgba(34, 211, 238, 0.15)');
    gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
