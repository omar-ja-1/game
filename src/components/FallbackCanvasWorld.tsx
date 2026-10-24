/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import {
  CameraMode,
  CollectibleOrbData,
  GameState,
  QualityTier,
  RenderActivityMode,
  WorldBillboardNode,
} from '../types/portfolio';
import { DEFAULT_WORLD_ORBS } from '../game/worldOrbs';
import { clampToPlazaBounds, distanceXZ, isWithinProximity } from '../game/portfolioLogic';
import { ZoneLayoutResult } from '../game/zoneLayout';
import { synthAudio } from '../audio/synthAudio';
import { QUALITY_PROFILES } from '../three/qualityConfig';

export interface FallbackWorldProps {
  zoneLayout: ZoneLayoutResult;
  onActivateNode: (node: WorldBillboardNode, meta?: { fromUserGesture?: boolean }) => void;
  onOrbCollected: (orb: CollectibleOrbData, index: number, totalCollected: number) => void;
  onNearNodeChange: (node: WorldBillboardNode | null) => void;
  onStateChange: (state: GameState) => void;
  onReturnHubShortcut?: () => void;
  onToggleMute?: () => void;
  onToggleDock?: () => void;
  isSimulationActive: boolean;
  renderActivityMode: RenderActivityMode;
  qualityTier: QualityTier;
  cameraMode: CameraMode;
  orbsCollected: number;
  totalOrbs: number;
  isBeaconActive: boolean;
}

export interface FallbackWorldHandle {
  warpToNode: (nodeId: string) => void;
  triggerRobotWave: () => void;
  triggerRobotGreeting: () => void;
  setVirtualInput: (forward: number, strafe: number) => void;
  triggerJump: () => void;
  resetSimulation: () => void;
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

export const FallbackCanvasWorld = React.forwardRef<FallbackWorldHandle, FallbackWorldProps>(
  (
    {
      zoneLayout,
      onActivateNode,
      onOrbCollected,
      onNearNodeChange,
      onStateChange,
      onReturnHubShortcut,
      onToggleMute,
      onToggleDock,
      isSimulationActive,
      renderActivityMode,
      qualityTier,
      isBeaconActive,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const stateRef = useRef({
      robot: {
        x: 0,
        z: 6.5,
        y: 0,
        rotation: Math.PI,
        vy: 0,
        isJumping: false,
        isMoving: false,
        isWaving: false,
        wavePhase: 0,
        blinkTimer: 2.0,
        isBlinking: false,
      },
      savedHubPos: null as { x: number; z: number } | null,
      lastZone: zoneLayout.zone,
      camera: {
        x: 0,
        z: 13.5,
      },
      keys: new Set<string>(),
      virtualMove: { forward: 0, strafe: 0 },
      orbs: DEFAULT_WORLD_ORBS.map((o) => ({ ...o, collected: false })),
      collectedCount: 0,
      nearestNode: null as WorldBillboardNode | null,
      images: new Map<string, HTMLImageElement>(),
      requestedImageUrls: new Set<string>(),
    });

    // Reposition smoothly on zone change while preserving hub coordinates
    useEffect(() => {
      const s = stateRef.current;
      if (s.lastZone === zoneLayout.zone) return;

      if (s.lastZone === 'hub' && zoneLayout.zone !== 'hub') {
        s.savedHubPos = { x: s.robot.x, z: s.robot.z };
      }

      s.lastZone = zoneLayout.zone;
      s.keys.clear();
      s.virtualMove = { forward: 0, strafe: 0 };
      s.nearestNode = null;
      onNearNodeChange(null);

      if (zoneLayout.zone === 'hub' && s.savedHubPos) {
        s.robot.x = s.savedHubPos.x;
        s.robot.z = s.savedHubPos.z;
      } else {
        s.robot.x = zoneLayout.spawnPosition[0];
        s.robot.z = zoneLayout.spawnPosition[2];
      }
      s.camera.x = s.robot.x;
      s.camera.z = s.robot.z + 7.0;
    }, [zoneLayout, onNearNodeChange]);

    React.useImperativeHandle(ref, () => ({
      warpToNode: (nodeId: string) => {
        if (nodeId === 'hub-central-beacon' && zoneLayout.zone === 'hub') {
          stateRef.current.robot.x = 0;
          stateRef.current.robot.z = 3.8;
          synthAudio.playRobotChirp('curious');
          return;
        }
        const node = zoneLayout.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        const offsetX = Math.sin(node.rotationY) * 3.2;
        const offsetZ = Math.cos(node.rotationY) * 3.2;
        stateRef.current.robot.x = node.position[0] + offsetX;
        stateRef.current.robot.z = node.position[2] + offsetZ;
        synthAudio.playRobotChirp('curious');
      },
      triggerRobotWave: () => {
        stateRef.current.robot.isWaving = true;
        stateRef.current.robot.wavePhase = 0;
        synthAudio.playRobotChirp('wave');
      },
      triggerRobotGreeting: () => {
        stateRef.current.robot.isWaving = true;
        stateRef.current.robot.wavePhase = 0;
        synthAudio.playRobotChirp('wave');
      },
      setVirtualInput: (forward: number, strafe: number) => {
        stateRef.current.virtualMove = { forward, strafe };
      },
      triggerJump: () => {
        if (!stateRef.current.robot.isJumping) {
          stateRef.current.robot.isJumping = true;
          stateRef.current.robot.vy = 8.5;
          synthAudio.playJump();
        }
      },
      resetSimulation: () => {
        stateRef.current.savedHubPos = null;
        stateRef.current.robot.x = 0;
        stateRef.current.robot.z = 6.5;
        stateRef.current.robot.y = 0;
        stateRef.current.robot.isJumping = false;
        stateRef.current.robot.isMoving = false;
        stateRef.current.collectedCount = 0;
        stateRef.current.orbs = DEFAULT_WORLD_ORBS.map((o) => ({ ...o, collected: false }));
      },
    }));

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return;
        }
        if (!isSimulationActive) return;

        const key = e.key.toLowerCase();
        stateRef.current.keys.add(key);

        if (e.code === 'Space') {
          e.preventDefault();
          if (!stateRef.current.robot.isJumping) {
            stateRef.current.robot.isJumping = true;
            stateRef.current.robot.vy = 8.5;
            synthAudio.playJump();
          }
        } else if (key === 'e') {
          e.preventDefault();
          if (stateRef.current.nearestNode) {
            synthAudio.playHologramScan();
            onActivateNode(stateRef.current.nearestNode, { fromUserGesture: true });
          }
        } else if (key === 'backspace' && zoneLayout.zone !== 'hub') {
          e.preventDefault();
          onReturnHubShortcut?.();
        } else if (key === 'q') {
          e.preventDefault();
          stateRef.current.robot.isWaving = true;
          stateRef.current.robot.wavePhase = 0;
          synthAudio.playRobotChirp('wave');
        } else if (key === 'm') {
          e.preventDefault();
          if (onToggleMute) onToggleMute();
          else synthAudio.toggleMute();
        } else if (key === 'h') {
          e.preventDefault();
          onToggleDock?.();
        } else if (key === 'escape' || key === 'p') {
          e.preventDefault();
          onStateChange('paused');
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        stateRef.current.keys.delete(e.key.toLowerCase());
      };

      const handleBlur = () => {
        stateRef.current.keys.clear();
        stateRef.current.virtualMove = { forward: 0, strafe: 0 };
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('blur', handleBlur);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('blur', handleBlur);
      };
    }, [
      isSimulationActive,
      zoneLayout.zone,
      onActivateNode,
      onReturnHubShortcut,
      onStateChange,
      onToggleDock,
      onToggleMute,
    ]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const profile = QUALITY_PROFILES[qualityTier];
      let animId = 0;
      let throttleTimer = 0;
      let lastTime = performance.now();
      let cachedCssW = 0;
      let cachedCssH = 0;
      let cachedDpr = 0;

      const syncCanvasSize = () => {
        const parent = canvas.parentElement;
        const cssW = Math.max(1, parent?.clientWidth ?? window.innerWidth);
        const cssH = Math.max(1, parent?.clientHeight ?? window.innerHeight);
        const dpr = Math.min(window.devicePixelRatio || 1, profile.maxPixelRatio);
        if (cssW !== cachedCssW || cssH !== cachedCssH || dpr !== cachedDpr) {
          cachedCssW = cssW;
          cachedCssH = cssH;
          cachedDpr = dpr;
          canvas.width = Math.round(cssW * dpr);
          canvas.height = Math.round(cssH * dpr);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      };

      const ensureLazyImage = (url?: string) => {
        if (!url) return undefined;
        const s = stateRef.current;
        if (!s.requestedImageUrls.has(url)) {
          s.requestedImageUrls.add(url);
          const img = new Image();
          img.decoding = 'async';
          img.src = url;
          s.images.set(url, img);
        }
        return s.images.get(url);
      };

      const drawFrame = (now: number, dt: number) => {
        syncCanvasSize();
        const w = cachedCssW;
        const h = cachedCssH;

        const state = stateRef.current;
        const robot = state.robot;
        const boundsR = zoneLayout.boundsRadius;
        const isHub = zoneLayout.zone === 'hub';

        if (isSimulationActive) {
          let moveX = 0;
          let moveZ = 0;

          const keys = state.keys;
          if (keys.has('w') || keys.has('arrowup')) moveZ -= 1;
          if (keys.has('s') || keys.has('arrowdown')) moveZ += 1;
          if (keys.has('a') || keys.has('arrowleft')) moveX -= 1;
          if (keys.has('d') || keys.has('arrowright')) moveX += 1;

          if (state.virtualMove.forward !== 0) moveZ -= state.virtualMove.forward;
          if (state.virtualMove.strafe !== 0) moveX += state.virtualMove.strafe;

          const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
          if (len > 0.01) {
            moveX /= len;
            moveZ /= len;
            const speed = keys.has('shift') ? 8.5 : 5.0;
            robot.x += moveX * speed * dt;
            robot.z += moveZ * speed * dt;

            const clamped = clampToPlazaBounds({ x: robot.x, z: robot.z }, boundsR);
            robot.x = clamped.x;
            robot.z = clamped.z;
            robot.rotation = Math.atan2(moveX, moveZ);
            robot.isMoving = true;
            synthAudio.playFootstep();
          } else {
            robot.isMoving = false;
          }

          if (robot.isJumping) {
            robot.vy -= 24 * dt;
            robot.y += robot.vy * dt;
            if (robot.y <= 0) {
              robot.y = 0;
              robot.isJumping = false;
              robot.vy = 0;
            }
          }

          if (robot.isWaving) {
            robot.wavePhase += dt * 8;
            if (robot.wavePhase > Math.PI * 4) {
              robot.isWaving = false;
            }
          }

          robot.blinkTimer -= dt;
          if (robot.blinkTimer <= 0) {
            if (!robot.isBlinking) {
              robot.isBlinking = true;
              robot.blinkTimer = 0.15;
            } else {
              robot.isBlinking = false;
              robot.blinkTimer = 2.5 + Math.random() * 3.0;
            }
          }

          state.camera.x += (robot.x - state.camera.x) * (1 - Math.exp(-6 * dt));
          state.camera.z += (robot.z + 7.0 - state.camera.z) * (1 - Math.exp(-6 * dt));

          let foundNode: WorldBillboardNode | null = null;
          let minNodeDist = Infinity;
          for (let i = 0; i < zoneLayout.nodes.length; i++) {
            const node = zoneLayout.nodes[i];
            const dist = distanceXZ(
              { x: robot.x, z: robot.z },
              { x: node.position[0], z: node.position[2] }
            );
            if (dist <= 4.4 && dist < minNodeDist) {
              minNodeDist = dist;
              foundNode = node;
            }
          }

          if (isHub) {
            const bDist = Math.hypot(robot.x, robot.z);
            if (bDist <= 4.5 && bDist < minNodeDist) {
              foundNode = HUB_BEACON_NODE;
            }
          }

          if (foundNode?.id !== state.nearestNode?.id) {
            state.nearestNode = foundNode;
            onNearNodeChange(foundNode);
          }

          if (isHub) {
            for (let i = 0; i < state.orbs.length; i++) {
              const orb = state.orbs[i];
              if (orb.collected) continue;
              if (
                isWithinProximity(
                  { x: robot.x, z: robot.z },
                  { x: orb.position[0], z: orb.position[2] },
                  1.5
                )
              ) {
                orb.collected = true;
                state.collectedCount += 1;
                onOrbCollected(orb, i, state.collectedCount);
                synthAudio.playOrbCollect(i);
              }
            }
          }
        }

        const centerX = w / 2;
        const centerY = h * 0.54;
        const scale = Math.min(w, h) / 18;

        const worldToScreen = (wx: number, wz: number, wy: number = 0) => {
          const relX = wx - state.camera.x;
          const relZ = wz - state.camera.z;
          return {
            x: centerX + relX * scale,
            y: centerY + relZ * scale * 0.55 - wy * scale,
          };
        };

        ctx.fillStyle = '#060911';
        ctx.fillRect(0, 0, w, h);

        const grad = ctx.createRadialGradient(
          centerX,
          centerY,
          50,
          centerX,
          centerY,
          Math.max(w, h) * 0.72
        );
        grad.addColorStop(0, '#0c1322');
        grad.addColorStop(0.55, '#080d17');
        grad.addColorStop(1, '#04060a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        const gridStep = profile.fallbackGridStep;
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.11)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = -boundsR; x <= boundsR; x += gridStep) {
          const p1 = worldToScreen(x, -boundsR);
          const p2 = worldToScreen(x, boundsR);
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
        }
        for (let z = -boundsR; z <= boundsR; z += gridStep) {
          const p1 = worldToScreen(-boundsR, z);
          const p2 = worldToScreen(boundsR, z);
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
        }
        ctx.stroke();

        ctx.strokeStyle = zoneLayout.theme.accentHex;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.12; a += 0.15) {
          const pt = worldToScreen(Math.cos(a) * boundsR, Math.sin(a) * boundsR);
          if (a === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (isHub) {
          const beaconPt = worldToScreen(0, 0);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(beaconPt.x, beaconPt.y, scale * 2.8, scale * 1.4, 0, 0, Math.PI * 2);
          ctx.stroke();

          if (isBeaconActive) {
            const beamGrad = ctx.createLinearGradient(
              beaconPt.x,
              beaconPt.y,
              beaconPt.x,
              beaconPt.y - h
            );
            beamGrad.addColorStop(0, 'rgba(34, 211, 238, 0.7)');
            beamGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
            ctx.fillStyle = beamGrad;
            ctx.fillRect(beaconPt.x - 18, 0, 36, beaconPt.y);
          }

          ctx.fillStyle = '#0f172a';
          ctx.fillRect(beaconPt.x - 10, beaconPt.y - scale * 3.2, 20, scale * 3.2);
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(beaconPt.x - 10, beaconPt.y - scale * 3.2, 20, scale * 3.2);
        }

        // Sort billboards back-to-front by Z for clean 2.5D painter's order
        const sortedNodes = [...zoneLayout.nodes].sort((a, b) => a.position[2] - b.position[2]);

        for (let i = 0; i < sortedNodes.length; i++) {
          const node = sortedNodes[i];
          const pt = worldToScreen(node.position[0], node.position[2]);
          const distToRobot = distanceXZ(
            { x: robot.x, z: robot.z },
            { x: node.position[0], z: node.position[2] }
          );
          const isNearby = state.nearestNode?.id === node.id;

          ctx.fillStyle = '#090d16';
          ctx.strokeStyle = node.accentColor;
          ctx.lineWidth = isNearby ? 2.5 : 1.2;
          ctx.beginPath();
          ctx.ellipse(pt.x, pt.y, scale * 1.7, scale * 0.85, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          const screenW = Math.max(96, scale * 3.1);
          const screenH = Math.max(68, scale * 2.2);
          const screenY = pt.y - scale * 2.8 + Math.sin(now * 0.002 + node.position[0]) * 3;

          ctx.fillStyle = 'rgba(8, 14, 26, 0.94)';
          ctx.strokeStyle = node.accentColor;
          ctx.lineWidth = isNearby ? 2.5 : 1.5;
          ctx.beginPath();
          ctx.roundRect(pt.x - screenW / 2, screenY - screenH / 2, screenW, screenH, 8);
          ctx.fill();
          ctx.stroke();

          if (node.imageUrl && distToRobot <= 20) {
            const img = ensureLazyImage(node.imageUrl);
            if (img && img.complete && img.naturalWidth > 0) {
              ctx.save();
              ctx.globalAlpha = 0.35;
              ctx.beginPath();
              ctx.roundRect(
                pt.x - screenW / 2 + 3,
                screenY - screenH / 2 + 3,
                screenW - 6,
                screenH - 6,
                6
              );
              ctx.clip();
              ctx.drawImage(
                img,
                pt.x - screenW / 2 + 3,
                screenY - screenH / 2 + 3,
                screenW - 6,
                screenH - 6
              );
              ctx.restore();
            }
          }

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.title.slice(0, 22), pt.x, screenY - 6);

          ctx.fillStyle = node.accentColor;
          ctx.font = '10px monospace';
          ctx.fillText(node.subtitle.slice(0, 26), pt.x, screenY + 12);
        }

        if (isHub) {
          for (let i = 0; i < state.orbs.length; i++) {
            const orb = state.orbs[i];
            if (orb.collected) continue;
            const opt = worldToScreen(
              orb.position[0],
              orb.position[2],
              1.2 + Math.sin(now * 0.003 + orb.position[0]) * 0.2
            );
            const orbGrad = ctx.createRadialGradient(opt.x, opt.y, 2, opt.x, opt.y, 13);
            orbGrad.addColorStop(0, '#ffffff');
            orbGrad.addColorStop(0.4, orb.accentColor);
            orbGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
            ctx.fillStyle = orbGrad;
            ctx.beginPath();
            ctx.arc(opt.x, opt.y, 13, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Draw companion robot (charcoal/navy chassis, cyan/purple accents, symmetrical eyes + mouth)
        const rpt = worldToScreen(robot.x, robot.z, robot.y);
        const shadowPt = worldToScreen(robot.x, robot.z, 0);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.ellipse(shadowPt.x, shadowPt.y, scale * 0.8, scale * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        const bodyW = scale * 0.82;
        const bodyH = scale * 0.96;

        // Left & right arms (right arm lifts and waves during greeting)
        ctx.strokeStyle = '#0d1526';
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(4, scale * 0.14);
        ctx.beginPath();
        ctx.moveTo(rpt.x - bodyW * 0.52, rpt.y - bodyH * 0.78);
        ctx.lineTo(rpt.x - bodyW * 0.68, rpt.y - bodyH * 0.34);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(rpt.x + bodyW * 0.52, rpt.y - bodyH * 0.78);
        if (robot.isWaving) {
          const waveOffset = Math.sin(robot.wavePhase) * scale * 0.22;
          ctx.lineTo(rpt.x + bodyW * 0.78 + waveOffset, rpt.y - bodyH * 1.28);
        } else {
          ctx.lineTo(rpt.x + bodyW * 0.68, rpt.y - bodyH * 0.34);
        }
        ctx.stroke();

        // Charcoal torso + navy trim
        ctx.fillStyle = '#1b2230';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(rpt.x - bodyW / 2, rpt.y - bodyH, bodyW, bodyH, 10);
        ctx.fill();
        ctx.stroke();

        // Cyan chest core
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(rpt.x, rpt.y - bodyH * 0.55, 4.2, 0, Math.PI * 2);
        ctx.fill();

        // Head shell
        const headW = scale * 0.8;
        const headH = scale * 0.66;
        const headY = rpt.y - bodyH - headH * 0.88;
        ctx.fillStyle = '#1b2230';
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(rpt.x - headW / 2, headY, headW, headH, 11);
        ctx.fill();
        ctx.stroke();

        // Visor screen
        const screenX = rpt.x - headW * 0.38;
        const screenY = headY + headH * 0.16;
        const screenW = headW * 0.76;
        const screenH = headH * 0.68;
        ctx.fillStyle = '#050811';
        ctx.beginPath();
        ctx.roundRect(screenX, screenY, screenW, screenH, 6);
        ctx.fill();

        // Eyes & Mouth
        const eyeY = screenY + screenH * 0.38;
        const eyeOffsetX = Math.max(5, screenW * 0.22);
        ctx.fillStyle = '#22d3ee';
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        if (robot.isBlinking) {
          ctx.beginPath();
          ctx.moveTo(rpt.x - eyeOffsetX - 4, eyeY);
          ctx.lineTo(rpt.x - eyeOffsetX + 4, eyeY);
          ctx.moveTo(rpt.x + eyeOffsetX - 4, eyeY);
          ctx.lineTo(rpt.x + eyeOffsetX + 4, eyeY);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.roundRect(rpt.x - eyeOffsetX - 3, eyeY - 5, 6, 9, 3);
          ctx.roundRect(rpt.x + eyeOffsetX - 3, eyeY - 5, 6, 9, 3);
          ctx.fill();
        }

        // Distinct mouth curve (wide smile when waving/moving vs gentle neutral smile)
        const mouthY = screenY + screenH * 0.72;
        ctx.beginPath();
        if (robot.isWaving || robot.isMoving) {
          ctx.arc(rpt.x, mouthY - 2, Math.max(5, screenW * 0.22), 0.1 * Math.PI, 0.9 * Math.PI);
          ctx.stroke();
        } else {
          ctx.moveTo(rpt.x - 5, mouthY);
          ctx.quadraticCurveTo(rpt.x, mouthY + 3, rpt.x + 5, mouthY);
          ctx.stroke();
        }
      };

      let stopped = false;

      const scheduleNext = () => {
        if (stopped || document.hidden || renderActivityMode === 'paused') return;
        if (renderActivityMode === 'throttled') {
          throttleTimer = window.setTimeout(() => {
            if (!stopped && !document.hidden) {
              animId = requestAnimationFrame(step);
            }
          }, Math.round(1000 / profile.titleTargetFps));
        } else {
          animId = requestAnimationFrame(step);
        }
      };

      const step = () => {
        if (stopped) return;
        const now = performance.now();
        const dt = Math.min(Math.max(0, (now - lastTime) * 0.001), 0.05);
        lastTime = now;
        drawFrame(now, dt);
        scheduleNext();
      };

      const handleResize = () => {
        cachedCssW = 0;
        if (!document.hidden && renderActivityMode === 'paused') {
          drawFrame(performance.now(), 0);
        }
      };

      const handleVisibility = () => {
        if (document.hidden) {
          cancelAnimationFrame(animId);
          clearTimeout(throttleTimer);
        } else {
          lastTime = performance.now();
          if (renderActivityMode === 'paused') {
            drawFrame(lastTime, 0);
          } else {
            scheduleNext();
          }
        }
      };

      const resizeObserver =
        typeof ResizeObserver !== 'undefined' && canvas.parentElement
          ? new ResizeObserver(handleResize)
          : null;
      if (resizeObserver && canvas.parentElement) {
        resizeObserver.observe(canvas.parentElement);
      }

      window.addEventListener('resize', handleResize);
      document.addEventListener('visibilitychange', handleVisibility);

      drawFrame(performance.now(), 0.016);
      scheduleNext();

      return () => {
        stopped = true;
        cancelAnimationFrame(animId);
        clearTimeout(throttleTimer);
        resizeObserver?.disconnect();
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }, [
      zoneLayout,
      isSimulationActive,
      renderActivityMode,
      qualityTier,
      isBeaconActive,
      onNearNodeChange,
      onOrbCollected,
    ]);

    return (
      <canvas
        ref={canvasRef}
        data-testid="fallback-canvas"
        className="absolute inset-0 z-0 w-full h-full touch-none cursor-grab active:cursor-grabbing"
      />
    );
  }
);

FallbackCanvasWorld.displayName = 'FallbackCanvasWorld';
