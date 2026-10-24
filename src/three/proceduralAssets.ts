/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { FacialExpressionState, WorldBillboardNode } from '../types/portfolio';

export type EyeRenderState =
  | 'idle'
  | 'neutral'
  | 'happy'
  | 'greeting'
  | 'waving'
  | 'curious'
  | 'blink'
  | 'excited';

/**
 * Shared calibrated nocturnal floor palette used by High/Medium (MeshStandardMaterial)
 * and Low (MeshLambertMaterial) so every quality tier preserves the same recognizable
 * dark navy / charcoal / blue-gray surface identity without needing extra dynamic lights.
 */
export const FLOOR_VISUAL_CONFIG = {
  tileBaseHex: '#0f172a',
  tileInsetHex: '#131d33',
  tileSeamHex: '#0b1120',
  subGridStroke: 'rgba(56, 78, 114, 0.44)',
  mainGridStroke: 'rgba(34, 211, 238, 0.42)',
  standardBaseColor: 0xd8e2f2,
  standardEmissiveColor: 0x070e1b,
  standardEmissiveIntensity: 0.28,
  standardRoughnessHigh: 0.36,
  standardRoughnessMedium: 0.48,
  standardMetalness: 0.38,
  standardEnvIntensityHigh: 0.55,
  standardEnvIntensityMedium: 0.42,
  lowBaseColor: 0xe2e8f0,
  lowEmissiveColor: 0x0b1324,
  lowEmissiveIntensity: 0.52,
} as const;

/**
 * Generates procedural floor grid texture with subtle architectural tile panels,
 * blue-gray sub-divisions, and restrained cyan navigation lines on a dark navy/charcoal base.
 */
export function createFloorGridTexture(
  anisotropy: number = 4,
  size: number = 1024,
  maxAnisotropyCap: number = 8
): THREE.CanvasTexture {
  const scale = size / 1024;
  const canvas = createCanvasElementSafe(size, size);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // 1. Base nocturnal navy-charcoal surface
    ctx.fillStyle = FLOOR_VISUAL_CONFIG.tileBaseHex;
    ctx.fillRect(0, 0, size, size);

    // 2. Subtle inset architectural floor panels for spatial depth without specular cost
    const mainStep = size / 4;
    const insetPad = Math.max(3, Math.round(10 * scale));
    ctx.fillStyle = FLOOR_VISUAL_CONFIG.tileInsetHex;
    for (let gx = 0; gx < 4; gx++) {
      for (let gy = 0; gy < 4; gy++) {
        ctx.fillRect(
          gx * mainStep + insetPad,
          gy * mainStep + insetPad,
          mainStep - insetPad * 2,
          mainStep - insetPad * 2
        );
      }
    }

    // 3. Fine blue-gray sub-grid
    ctx.strokeStyle = FLOOR_VISUAL_CONFIG.subGridStroke;
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

    // 4. Subtle dark seam bevel beside main grid lines
    ctx.strokeStyle = FLOOR_VISUAL_CONFIG.tileSeamHex;
    ctx.lineWidth = Math.max(2, 5 * scale);
    ctx.beginPath();
    for (let i = 0; i <= size; i += mainStep) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
    }
    ctx.stroke();

    // 5. Primary cyan navigation grid
    ctx.strokeStyle = FLOOR_VISUAL_CONFIG.mainGridStroke;
    ctx.lineWidth = Math.max(1.25, 2.4 * scale);
    ctx.beginPath();
    for (let i = 0; i <= size; i += mainStep) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
    }
    ctx.stroke();

    // 6. Intersection survey markers
    const innerDotRadius = Math.max(2, 4 * scale);
    const outerDotRadius = Math.max(5, 10 * scale);
    for (let x = 0; x <= size; x += mainStep) {
      for (let y = 0; y <= size; y += mainStep) {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.86)';
        ctx.beginPath();
        ctx.arc(x, y, innerDotRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
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
  const canvas = createCanvasElementSafe(size, size);
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
  const canvas = createCanvasElementSafe(size, size);
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
  const canvas = createCanvasElementSafe(512, 88);
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

function createCanvasElementSafe(width: number, height: number): HTMLCanvasElement {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const el = document.createElement('canvas');
    el.width = width;
    el.height = height;
    return el;
  }
  return {
    width,
    height,
    getContext: () => null,
  } as unknown as HTMLCanvasElement;
}

/**
 * Reusable digital face display texture for the Companion Robot.
 * Renders two symmetrical eyes AND a distinct expressive mouth (`neutral`, `happy`, `greeting`, `curious`),
 * plus independent eyelid blinking that preserves the active mouth expression.
 * Redraws the 2D canvas ONLY when `(expression, isBlinking)` changes.
 */
export class RobotEyeCanvas {
  public canvas: HTMLCanvasElement;
  public texture: THREE.CanvasTexture;
  public redrawCount: number = 0;

  private ctx: CanvasRenderingContext2D | null;
  private lastExpression: FacialExpressionState | null = null;
  private lastBlinking: boolean | null = null;

  constructor() {
    this.canvas = createCanvasElementSafe(256, 168);
    this.ctx = typeof this.canvas.getContext === 'function' ? this.canvas.getContext('2d') : null;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.renderFace('neutral', false);
  }

  public getLastRenderedFace(): { expression: FacialExpressionState; isBlinking: boolean } {
    return {
      expression: this.lastExpression ?? 'neutral',
      isBlinking: this.lastBlinking ?? false,
    };
  }

  public renderFace(expression: FacialExpressionState, isBlinking: boolean = false): void {
    if (this.lastExpression === expression && this.lastBlinking === isBlinking) {
      return;
    }
    this.lastExpression = expression;
    this.lastBlinking = isBlinking;
    this.redrawCount += 1;

    if (!this.ctx) {
      this.texture.needsUpdate = true;
      return;
    }

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Deep obsidian OLED faceplate background
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, w, h);

    // Subtle inner screen border
    ctx.strokeStyle =
      expression === 'greeting'
        ? 'rgba(168, 85, 247, 0.42)'
        : 'rgba(34, 211, 238, 0.24)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, 22);
    ctx.stroke();

    const leftX = w * 0.31;
    const rightX = w * 0.69;
    const eyeY = h * 0.41;

    // Soft restrained purple cheek glow in smiling states
    if (expression === 'happy' || expression === 'greeting') {
      const cheekAlpha = expression === 'greeting' ? 0.58 : 0.44;
      ctx.fillStyle = `rgba(168, 85, 247, ${cheekAlpha})`;
      ctx.beginPath();
      ctx.ellipse(w * 0.19, h * 0.63, 13, 7.5, 0, 0, Math.PI * 2);
      ctx.ellipse(w * 0.81, h * 0.63, 13, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 1. Symmetrical Eyes (or closed eyelids during blink)
    ctx.fillStyle = '#22d3ee';
    ctx.strokeStyle = '#22d3ee';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isBlinking) {
      ctx.lineWidth = 6.5;
      if (expression === 'happy' || expression === 'greeting') {
        // Warm curved closed-eye arcs when blinking mid-smile
        ctx.beginPath();
        ctx.arc(leftX, eyeY + 6, 17, Math.PI * 1.12, Math.PI * 1.88, false);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(rightX, eyeY + 6, 17, Math.PI * 1.12, Math.PI * 1.88, false);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(leftX - 18, eyeY + 2);
        ctx.quadraticCurveTo(leftX, eyeY + 6, leftX + 18, eyeY + 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(rightX - 18, eyeY + 2);
        ctx.quadraticCurveTo(rightX, eyeY + 6, rightX + 18, eyeY + 2);
        ctx.stroke();
      }
    } else if (expression === 'happy') {
      // Joyful upward-curved crescent eyes
      ctx.lineWidth = 7.5;
      ctx.beginPath();
      ctx.arc(leftX, eyeY + 9, 17, Math.PI * 1.08, Math.PI * 1.92, false);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(rightX, eyeY + 9, 17, Math.PI * 1.08, Math.PI * 1.92, false);
      ctx.stroke();
    } else if (expression === 'greeting') {
      // Welcoming bright eyes + uplifted purple friendly brow accents
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(leftX, eyeY - 6, 22, Math.PI * 1.2, Math.PI * 1.75, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rightX, eyeY - 6, 22, Math.PI * 1.25, Math.PI * 1.8, false);
      ctx.stroke();

      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.roundRect(leftX - 15, eyeY - 19, 30, 38, 15);
      ctx.roundRect(rightX - 15, eyeY - 19, 30, 38, 15);
      ctx.fill();

      // Dual bright catchlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(leftX - 5, eyeY - 8, 5, 0, Math.PI * 2);
      ctx.arc(rightX - 5, eyeY - 8, 5, 0, Math.PI * 2);
      ctx.arc(leftX + 5, eyeY + 5, 2.4, 0, Math.PI * 2);
      ctx.arc(rightX + 5, eyeY + 5, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (expression === 'curious') {
      // Inquisitive rounded eyes + subtle raised brow on right eye
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(rightX - 15, eyeY - 27);
      ctx.quadraticCurveTo(rightX, eyeY - 33, rightX + 15, eyeY - 25);
      ctx.stroke();

      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.ellipse(leftX, eyeY + 1, 15, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(rightX, eyeY - 1, 16, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(leftX - 4, eyeY - 6, 4.2, 0, Math.PI * 2);
      ctx.arc(rightX - 4, eyeY - 8, 4.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Neutral: warm, symmetrical rounded eyes with lively catchlights
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.roundRect(leftX - 14, eyeY - 19, 28, 38, 14);
      ctx.roundRect(rightX - 14, eyeY - 19, 28, 38, 14);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(leftX - 4, eyeY - 7, 4.4, 0, Math.PI * 2);
      ctx.arc(rightX - 4, eyeY - 7, 4.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Readable Digital Mouth (distinct geometry per state, never simulated by eye brightness alone)
    ctx.fillStyle = '#22d3ee';
    ctx.strokeStyle = '#22d3ee';

    if (expression === 'happy' || expression === 'greeting') {
      // Unmistakable open smiling crescent mouth
      const halfSpan = expression === 'greeting' ? 40 : 35;
      const topY = h * 0.68;
      const bottomCtrlY = expression === 'greeting' ? h * 0.9 : h * 0.87;

      ctx.beginPath();
      ctx.moveTo(w * 0.5 - halfSpan, topY);
      ctx.quadraticCurveTo(w * 0.5, topY + 6, w * 0.5 + halfSpan, topY);
      ctx.quadraticCurveTo(w * 0.5, bottomCtrlY, w * 0.5 - halfSpan, topY);
      ctx.closePath();
      ctx.fill();

      // Soft inner mouth highlight for crisp legibility at camera distance
      ctx.fillStyle = '#a5f3fc';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, topY + 11, halfSpan * 0.42, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (expression === 'curious') {
      // Small inquisitive rounded mouth
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.75, 10, 7.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Pleasant, friendly neutral smile curve
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - 24, h * 0.72);
      ctx.quadraticCurveTo(w * 0.5, h * 0.8, w * 0.5 + 24, h * 0.72);
      ctx.stroke();
    }

    this.texture.needsUpdate = true;
  }

  /**
   * Backward-compatible state mapper delegating to `renderFace`.
   */
  public renderState(state: EyeRenderState): void {
    if (state === 'blink') {
      this.renderFace(this.lastExpression ?? 'neutral', true);
      return;
    }
    if (state === 'greeting' || state === 'waving') {
      this.renderFace('greeting', false);
      return;
    }
    if (state === 'happy' || state === 'excited') {
      this.renderFace('happy', false);
      return;
    }
    if (state === 'curious') {
      this.renderFace('curious', false);
      return;
    }
    this.renderFace('neutral', false);
  }

  public dispose(): void {
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

  public dispose(): void {
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
