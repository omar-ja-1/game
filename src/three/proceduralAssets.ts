/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { WorldBillboardNode } from '../types/portfolio';

export type EyeRenderState = 'idle' | 'happy' | 'waving' | 'curious' | 'blink' | 'excited';

/**
 * Generates procedural floor grid texture with glowing accent lines
 * and subtle sub-division dots on dark charcoal/navy background.
 */
export function createFloorGridTexture(
  anisotropy: number = 4,
  size: number = 1024,
  maxAnisotropyCap: number = 8
): THREE.CanvasTexture {
  const scale = size / 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(20, 32, 50, 0.42)';
    ctx.lineWidth = Math.max(0.75, 1 * scale);
    const subStep = size / 32;
    ctx.beginPath();
    for (let i = 0; i <= size; i += subStep) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
    }
    ctx.stroke();

    const mainStep = size / 4;
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.lineWidth = Math.max(1.25, 2.5 * scale);
    ctx.beginPath();
    for (let i = 0; i <= size; i += mainStep) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
    }
    ctx.stroke();

    const innerDotRadius = Math.max(2, 4 * scale);
    const outerDotRadius = Math.max(5, 10 * scale);
    for (let x = 0; x <= size; x += mainStep) {
      for (let y = 0; y <= size; y += mainStep) {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.85)';
        ctx.beginPath();
        ctx.arc(x, y, innerDotRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(34, 211, 238, 0.15)';
        ctx.beginPath();
        ctx.arc(x, y, outerDotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(anisotropy, maxAnisotropyCap);
  texture.needsUpdate = true;
  return texture;
}

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

export function createRadialGlowTexture(
  accentColor: string,
  size: number = 128
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const c = new THREE.Color(accentColor);
    const r = Math.round(c.r * 255);
    const g = Math.round(c.g * 255);
    const b = Math.round(c.b * 255);

    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.65)`);
    gradient.addColorStop(0.32, `rgba(${r}, ${g}, ${b}, 0.28)`);
    gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.06)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createActionPromptTexture(
  promptLabel: string = 'INSPECT',
  accentColor: string = '#22d3ee'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 88;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(6, 11, 20, 0.94)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 68, 14);
    ctx.fill();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 68, 14);
    ctx.stroke();

    const text = `[E] ${promptLabel}`.slice(0, 34);
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 45);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function wrapCanvasParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length >= maxLines - 1) {
        const rest = [current, ...words.slice(i + 1)].join(' ');
        let trimmed = rest;
        while (trimmed.length > 4 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
          trimmed = trimmed.slice(0, -2).trimEnd();
        }
        lines.push(trimmed === rest ? rest : `${trimmed}…`);
        return lines;
      }
    }
  }
  lines.push(current);
  return lines.slice(0, maxLines);
}

/**
 * Draws a high-contrast, legible holographic summary card onto `canvas` for any WorldBillboardNode.
 * Supports both pure typographic summary cards (zero image load cost) and composited lazy-loaded artwork.
 */
export function drawBillboardSummaryCard(
  canvas: HTMLCanvasElement,
  node: WorldBillboardNode,
  cardWidth: number,
  loadedImage?: HTMLImageElement | null
): void {
  const width = cardWidth;
  const height = node.isPortrait ? Math.round(width * 1.24) : Math.round(width * 0.76);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const s = width / 640;
  const pad = Math.round(28 * s);
  const innerW = width - pad * 2;
  const c = new THREE.Color(node.accentColor);
  const cr = Math.round(c.r * 255);
  const cg = Math.round(c.g * 255);
  const cb = Math.round(c.b * 255);

  ctx.clearRect(0, 0, width, height);

  // Outer card surface
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(6 * s, 6 * s, width - 12 * s, height - 12 * s, 22 * s);
  ctx.clip();

  ctx.fillStyle = '#070c17';
  ctx.fillRect(0, 0, width, height);

  // Subtle ambient corner radial glow
  const glow = ctx.createRadialGradient(
    width * 0.82,
    height * 0.14,
    8 * s,
    width * 0.82,
    height * 0.14,
    width * 0.72
  );
  glow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0.24)`);
  glow.addColorStop(0.55, `rgba(${cr}, ${cg}, ${cb}, 0.06)`);
  glow.addColorStop(1, 'rgba(7, 12, 23, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  let cursorY = pad + 8 * s;

  // Optional lazy-loaded artwork banner
  if (loadedImage && loadedImage.naturalWidth > 0 && loadedImage.naturalHeight > 0) {
    const imgBoxH = Math.round(height * (node.isPortrait ? 0.42 : 0.38));
    const imgX = pad;
    const imgY = pad;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(imgX, imgY, innerW, imgBoxH, 14 * s);
    ctx.clip();

    // Aspect-fill cover crop
    const srcRatio = loadedImage.naturalWidth / loadedImage.naturalHeight;
    const dstRatio = innerW / imgBoxH;
    let drawW = innerW;
    let drawH = imgBoxH;
    let offsetX = imgX;
    let offsetY = imgY;

    if (srcRatio > dstRatio) {
      drawW = imgBoxH * srcRatio;
      offsetX = imgX - (drawW - innerW) * 0.5;
    } else {
      drawH = innerW / srcRatio;
      offsetY = imgY - (drawH - imgBoxH) * 0.35;
    }

    ctx.drawImage(loadedImage, offsetX, offsetY, drawW, drawH);

    const scrim = ctx.createLinearGradient(0, imgY, 0, imgY + imgBoxH);
    scrim.addColorStop(0, 'rgba(7, 12, 23, 0.08)');
    scrim.addColorStop(1, 'rgba(7, 12, 23, 0.78)');
    ctx.fillStyle = scrim;
    ctx.fillRect(imgX, imgY, innerW, imgBoxH);
    ctx.restore();

    ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, 0.45)`;
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.beginPath();
    ctx.roundRect(imgX, imgY, innerW, imgBoxH, 14 * s);
    ctx.stroke();

    cursorY = imgY + imgBoxH + Math.round(24 * s);
  } else {
    // Sleek architectural header bar for pure-data or not-yet-loaded boards
    ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.16)`;
    ctx.beginPath();
    ctx.roundRect(pad, pad, innerW, Math.round(8 * s), 4 * s);
    ctx.fill();

    ctx.fillStyle = node.accentColor;
    ctx.beginPath();
    ctx.roundRect(pad, pad, Math.round(innerW * 0.32), Math.round(8 * s), 4 * s);
    ctx.fill();

    cursorY = pad + Math.round(34 * s);
  }

  // 1. Kicker
  ctx.fillStyle = node.accentColor;
  ctx.font = `600 ${Math.round(17 * s)}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(node.kicker, pad, cursorY);
  cursorY += Math.round(28 * s);

  // 2. Primary Title (wrapped up to 2 lines)
  ctx.fillStyle = '#f8fafc';
  ctx.font = `800 ${Math.round(34 * s)}px "Outfit", "Plus Jakarta Sans", sans-serif`;
  const titleLines = wrapCanvasParagraph(ctx, node.title, innerW, 2);
  for (const line of titleLines) {
    ctx.fillText(line, pad, cursorY);
    cursorY += Math.round(39 * s);
  }

  // 3. Subtitle
  if (node.subtitle) {
    cursorY += Math.round(2 * s);
    ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.95)`;
    ctx.font = `600 ${Math.round(20 * s)}px "Plus Jakarta Sans", sans-serif`;
    const subLines = wrapCanvasParagraph(ctx, node.subtitle, innerW, 1);
    for (const line of subLines) {
      ctx.fillText(line, pad, cursorY);
      cursorY += Math.round(28 * s);
    }
  }

  // Hairline separator
  cursorY += Math.round(8 * s);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = Math.max(1, 1 * s);
  ctx.beginPath();
  ctx.moveTo(pad, cursorY);
  ctx.lineTo(width - pad, cursorY);
  ctx.stroke();
  cursorY += Math.round(14 * s);

  // 4. Real Data Summary Lines
  ctx.fillStyle = 'rgba(226, 232, 240, 0.92)';
  ctx.font = `500 ${Math.round(19 * s)}px "Plus Jakarta Sans", sans-serif`;
  const footerReserve = height - Math.round(58 * s);
  for (const paragraph of node.summaryLines) {
    if (cursorY > footerReserve - Math.round(24 * s)) break;
    const wrapped = wrapCanvasParagraph(ctx, paragraph, innerW, 2);
    for (const wLine of wrapped) {
      if (cursorY > footerReserve - Math.round(22 * s)) break;
      ctx.fillText(wLine, pad, cursorY);
      cursorY += Math.round(25 * s);
    }
    cursorY += Math.round(6 * s);
  }

  // 5. Unboxed Footer Metadata Line
  const footerY = height - Math.round(44 * s);
  ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, 0.28)`;
  ctx.beginPath();
  ctx.moveTo(pad, footerY - Math.round(12 * s));
  ctx.lineTo(width - pad, footerY - Math.round(12 * s));
  ctx.stroke();

  ctx.fillStyle = 'rgba(148, 163, 184, 0.92)';
  ctx.font = `500 ${Math.round(16 * s)}px "JetBrains Mono", monospace`;
  const footerLines = wrapCanvasParagraph(ctx, node.footerMeta, innerW, 1);
  if (footerLines[0]) {
    ctx.fillText(footerLines[0], pad, footerY);
  }

  ctx.restore();

  // Crisp glowing outer frame
  ctx.strokeStyle = node.accentColor;
  ctx.lineWidth = Math.max(1.5, 2.5 * s);
  ctx.beginPath();
  ctx.roundRect(6 * s, 6 * s, width - 12 * s, height - 12 * s, 22 * s);
  ctx.stroke();
}

export class RobotEyeCanvas {
  public canvas: HTMLCanvasElement;
  public texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D | null;
  private lastState: EyeRenderState | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 128;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.renderState('idle');
  }

  public renderState(state: EyeRenderState) {
    const normalized: EyeRenderState =
      state === 'waving' || state === 'excited' ? 'happy' : state;
    if (this.lastState === normalized || !this.ctx) return;
    this.lastState = normalized;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, w, h);

    const leftX = w * 0.32;
    const rightX = w * 0.68;
    const centerY = h * 0.5;

    ctx.fillStyle = '#22d3ee';
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';

    if (normalized === 'blink') {
      ctx.beginPath();
      ctx.moveTo(leftX - 18, centerY);
      ctx.lineTo(leftX + 18, centerY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rightX - 18, centerY);
      ctx.lineTo(rightX + 18, centerY);
      ctx.stroke();
    } else if (normalized === 'happy') {
      ctx.beginPath();
      ctx.arc(leftX, centerY + 8, 16, Math.PI, 0, false);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(rightX, centerY + 8, 16, Math.PI, 0, false);
      ctx.stroke();
    } else if (normalized === 'curious') {
      ctx.beginPath();
      ctx.ellipse(leftX, centerY, 16, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(rightX, centerY, 16, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.roundRect(leftX - 12, centerY - 18, 24, 36, 12);
      ctx.fill();

      ctx.beginPath();
      ctx.roundRect(rightX - 12, centerY - 18, 24, 36, 12);
      ctx.fill();

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

export class SharedTexturePool {
  private contactShadowTex: THREE.CanvasTexture | null = null;
  private promptCache = new Map<string, THREE.CanvasTexture>();
  private radialGlowCache = new Map<string, THREE.CanvasTexture>();
  private imageCache = new Map<string, Promise<HTMLImageElement>>();
  private isDisposed = false;

  public getContactShadowTexture(): THREE.CanvasTexture {
    if (!this.contactShadowTex) {
      this.contactShadowTex = createContactShadowTexture();
    }
    return this.contactShadowTex;
  }

  public getPromptTexture(promptLabel: string, accentColor: string): THREE.CanvasTexture {
    const key = `${promptLabel}::${accentColor.toLowerCase()}`;
    let tex = this.promptCache.get(key);
    if (!tex) {
      tex = createActionPromptTexture(promptLabel, accentColor);
      this.promptCache.set(key, tex);
    }
    return tex;
  }

  public getRadialGlowTexture(accentColor: string): THREE.CanvasTexture {
    const key = accentColor.toLowerCase();
    let tex = this.radialGlowCache.get(key);
    if (!tex) {
      tex = createRadialGlowTexture(accentColor, 128);
      this.radialGlowCache.set(key, tex);
    }
    return tex;
  }

  public loadImageShared(url: string): Promise<HTMLImageElement> {
    const existing = this.imageCache.get(url);
    if (existing) return existing;

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      if (this.isDisposed) {
        reject(new Error('Disposed'));
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = url;
    });

    this.imageCache.set(url, promise);
    return promise;
  }

  public dispose() {
    this.isDisposed = true;
    this.contactShadowTex?.dispose();
    this.contactShadowTex = null;

    this.promptCache.forEach((tex) => tex.dispose());
    this.promptCache.clear();

    this.radialGlowCache.forEach((tex) => tex.dispose());
    this.radialGlowCache.clear();

    this.imageCache.clear();
  }
}
