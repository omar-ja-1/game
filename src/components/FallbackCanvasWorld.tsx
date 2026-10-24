/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { CameraMode, CollectibleOrbData, ExhibitData, GameState } from '../types/portfolio';
import { EXHIBITS, INITIAL_ORBS } from '../data/portfolioData';
import { clampToPlazaBounds, distanceXZ, isWithinProximity } from '../game/portfolioLogic';
import { synthAudio } from '../audio/synthAudio';

export interface FallbackWorldProps {
  onInteractExhibit: (exhibit: ExhibitData) => void;
  onOrbCollected: (orb: CollectibleOrbData, index: number, totalCollected: number) => void;
  onNearExhibitChange: (exhibit: ExhibitData | null) => void;
  onStateChange: (state: GameState) => void;
  isSimulationActive: boolean;
  cameraMode: CameraMode;
  orbsCollected: number;
  totalOrbs: number;
  isBeaconActive: boolean;
}

export interface FallbackWorldHandle {
  warpToExhibit: (exhibitId: string) => void;
  triggerRobotWave: () => void;
  setVirtualInput: (forward: number, strafe: number) => void;
  triggerJump: () => void;
  resetSimulation: () => void;
}

export const FallbackCanvasWorld = React.forwardRef<FallbackWorldHandle, FallbackWorldProps>(
  (
    {
      onInteractExhibit,
      onOrbCollected,
      onNearExhibitChange,
      onStateChange,
      isSimulationActive,
      isBeaconActive,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // State refs for animation loop
    const stateRef = useRef({
      robot: {
        x: 0,
        z: 4,
        y: 0,
        rotation: 0,
        vy: 0,
        isJumping: false,
        isMoving: false,
        isWaving: false,
        wavePhase: 0,
        blinkTimer: 2.0,
        isBlinking: false,
        emotion: 'idle' as 'idle' | 'happy' | 'waving' | 'curious',
      },
      camera: {
        x: 0,
        z: 11,
      },
      keys: new Set<string>(),
      virtualMove: { forward: 0, strafe: 0 },
      orbs: INITIAL_ORBS.map((o) => ({ ...o, collected: false })),
      nearestExhibit: null as ExhibitData | null,
      images: new Map<string, HTMLImageElement>(),
    });

    // Expose handle methods to parent
    React.useImperativeHandle(ref, () => ({
      warpToExhibit: (exhibitId: string) => {
        const ex = EXHIBITS.find((e) => e.id === exhibitId);
        if (!ex) return;
        stateRef.current.robot.x = ex.position[0];
        stateRef.current.robot.z = ex.position[2] + 4;
        stateRef.current.robot.rotation = 0;
        synthAudio.playRobotChirp('curious');
      },
      triggerRobotWave: () => {
        stateRef.current.robot.isWaving = true;
        stateRef.current.robot.wavePhase = 0;
        stateRef.current.robot.emotion = 'waving';
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
        stateRef.current.robot.x = 0;
        stateRef.current.robot.z = 4;
        stateRef.current.robot.y = 0;
        stateRef.current.robot.rotation = 0;
        stateRef.current.robot.isJumping = false;
        stateRef.current.robot.isMoving = false;
        stateRef.current.orbs = INITIAL_ORBS.map((o) => ({ ...o, collected: false }));
      },
    }));

    // Preload exhibit images
    useEffect(() => {
      EXHIBITS.forEach((ex) => {
        const img = new Image();
        img.src = ex.imageAsset;
        stateRef.current.images.set(ex.id, img);
      });
    }, []);

    // Keyboard and resize listeners
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
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
          if (stateRef.current.nearestExhibit) {
            synthAudio.playHologramScan();
            onInteractExhibit(stateRef.current.nearestExhibit);
          }
        } else if (key === 'q') {
          e.preventDefault();
          stateRef.current.robot.isWaving = true;
          stateRef.current.robot.wavePhase = 0;
          synthAudio.playRobotChirp('wave');
        } else if (key === 'm') {
          e.preventDefault();
          synthAudio.toggleMute();
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
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('blur', handleBlur);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('blur', handleBlur);
      };
    }, [onInteractExhibit, onStateChange]);

    // Main 2D Canvas rendering loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animId: number;
      let lastTime = performance.now();

      const render = () => {
        const now = performance.now();
        const dt = Math.min((now - lastTime) * 0.001, 0.05);
        lastTime = now;

        const w = (canvas.width = window.innerWidth);
        const h = (canvas.height = window.innerHeight);

        const state = stateRef.current;
        const robot = state.robot;

        // 1. Simulation update
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

            const clamped = clampToPlazaBounds({ x: robot.x, z: robot.z }, 36);
            robot.x = clamped.x;
            robot.z = clamped.z;

            robot.rotation = Math.atan2(moveX, moveZ);
            robot.isMoving = true;
            synthAudio.playFootstep();
          } else {
            robot.isMoving = false;
          }

          // Jump physics
          if (robot.isJumping) {
            robot.vy -= 24 * dt;
            robot.y += robot.vy * dt;
            if (robot.y <= 0) {
              robot.y = 0;
              robot.isJumping = false;
              robot.vy = 0;
            }
          }

          // Waving
          if (robot.isWaving) {
            robot.wavePhase += dt * 8;
            if (robot.wavePhase > Math.PI * 4) {
              robot.isWaving = false;
            }
          }

          // Blinking
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

          // Camera follow
          state.camera.x += (robot.x - state.camera.x) * (1 - Math.exp(-6 * dt));
          state.camera.z += (robot.z + 7.0 - state.camera.z) * (1 - Math.exp(-6 * dt));

          // Proximity check with exhibits
          let foundExhibit: ExhibitData | null = null;
          let minExhibitDist = Infinity;
          EXHIBITS.forEach((ex) => {
            const dist = distanceXZ({ x: robot.x, z: robot.z }, { x: ex.position[0], z: ex.position[2] });
            if (dist <= 4.5 && dist < minExhibitDist) {
              minExhibitDist = dist;
              foundExhibit = ex;
            }
          });

          if (foundExhibit !== state.nearestExhibit) {
            state.nearestExhibit = foundExhibit;
            onNearExhibitChange(foundExhibit);
          }

          // Orb collection
          state.orbs.forEach((orb, i) => {
            if (orb.collected) return;
            if (isWithinProximity({ x: robot.x, z: robot.z }, { x: orb.position[0], z: orb.position[2] }, 1.5)) {
              orb.collected = true;
              const total = state.orbs.filter((o) => o.collected).length;
              onOrbCollected(orb, i, total);
              synthAudio.playOrbCollect(i);
            }
          });
        }

        // 2. Perspective Projection Math (Pseudo-3D Isometric / 2.5D Camera)
        const centerX = w / 2;
        const centerY = h * 0.52;
        const scale = Math.min(w, h) / 18;

        const worldToScreen = (wx: number, wz: number, wy: number = 0) => {
          const relX = wx - state.camera.x;
          const relZ = wz - state.camera.z;
          // Isometric pitch
          const screenX = centerX + relX * scale;
          const screenY = centerY + relZ * scale * 0.55 - wy * scale;
          return { x: screenX, y: screenY };
        };

        // 3. Clear Background (Deep Nocturnal Navy)
        ctx.fillStyle = '#060911';
        ctx.fillRect(0, 0, w, h);

        // Radial ambient floor vignette
        const grad = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, Math.max(w, h) * 0.7);
        grad.addColorStop(0, '#0c1322');
        grad.addColorStop(0.5, '#080d17');
        grad.addColorStop(1, '#04060a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // 4. Render Glowing Cyan Floor Grid
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.12)';
        ctx.lineWidth = 1;
        for (let x = -36; x <= 36; x += 4) {
          const p1 = worldToScreen(x, -36);
          const p2 = worldToScreen(x, 36);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
        for (let z = -36; z <= 36; z += 4) {
          const p1 = worldToScreen(-36, z);
          const p2 = worldToScreen(36, z);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }

        // Central plaza boundary circle
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
          const px = Math.cos(a) * 36;
          const pz = Math.sin(a) * 36;
          const pt = worldToScreen(px, pz);
          if (a === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        // 5. Central Beacon
        const beaconPt = worldToScreen(0, 0);
        // Base ring
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(beaconPt.x, beaconPt.y, scale * 3, scale * 1.5, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Beacon skyward beam (if active)
        if (isBeaconActive) {
          const beamGrad = ctx.createLinearGradient(beaconPt.x, beaconPt.y, beaconPt.x, beaconPt.y - h);
          beamGrad.addColorStop(0, 'rgba(34, 211, 238, 0.7)');
          beamGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
          ctx.fillStyle = beamGrad;
          ctx.fillRect(beaconPt.x - 20, 0, 40, beaconPt.y);
        }

        // Central Spire Pillar
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(beaconPt.x - 12, beaconPt.y - scale * 3.5, 24, scale * 3.5);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(beaconPt.x - 12, beaconPt.y - scale * 3.5, 24, scale * 3.5);

        // 6. Holographic Billboards
        EXHIBITS.forEach((ex) => {
          if (ex.terminalType === 'beacon') return;
          const pt = worldToScreen(ex.position[0], ex.position[2]);
          const isNearby = state.nearestExhibit?.id === ex.id;

          // Pedestal base
          ctx.fillStyle = '#090d16';
          ctx.strokeStyle = ex.accentColor;
          ctx.lineWidth = isNearby ? 2 : 1;
          ctx.beginPath();
          ctx.ellipse(pt.x, pt.y, scale * 1.8, scale * 0.9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Floating Billboard Screen
          const screenW = scale * 2.8;
          const screenH = scale * 2.1;
          const screenY = pt.y - scale * 3.0 + Math.sin(now * 0.002 + ex.position[0]) * 4;

          // Holographic glow fill
          ctx.fillStyle = 'rgba(10, 18, 30, 0.85)';
          ctx.strokeStyle = ex.accentColor;
          ctx.lineWidth = isNearby ? 2.5 : 1.5;
          ctx.beginPath();
          ctx.roundRect(pt.x - screenW / 2, screenY - screenH / 2, screenW, screenH, 8);
          ctx.fill();
          ctx.stroke();

          // Render image if loaded
          const img = state.images.get(ex.id);
          if (img && img.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(pt.x - screenW / 2 + 4, screenY - screenH / 2 + 4, screenW - 8, screenH - 8, 6);
            ctx.clip();
            ctx.drawImage(img, pt.x - screenW / 2 + 4, screenY - screenH / 2 + 4, screenW - 8, screenH - 8);
            ctx.restore();
          }

          // Scanline overlay
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
          ctx.lineWidth = 1;
          for (let sy = screenY - screenH / 2; sy <= screenY + screenH / 2; sy += 6) {
            ctx.beginPath();
            ctx.moveTo(pt.x - screenW / 2, sy);
            ctx.lineTo(pt.x + screenW / 2, sy);
            ctx.stroke();
          }

          // Title tag
          ctx.fillStyle = ex.accentColor;
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(ex.title.split('//')[0].trim(), pt.x, screenY + screenH / 2 + 16);
        });

        // 7. Collectible Energy Orbs
        state.orbs.forEach((orb) => {
          if (orb.collected) return;
          const opt = worldToScreen(orb.position[0], orb.position[2], 1.2 + Math.sin(now * 0.003 + orb.position[0]) * 0.2);

          // Contact shadow on ground
          const groundPt = worldToScreen(orb.position[0], orb.position[2], 0);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.beginPath();
          ctx.ellipse(groundPt.x, groundPt.y, 14, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          // Glowing Orb
          const orbGrad = ctx.createRadialGradient(opt.x, opt.y, 2, opt.x, opt.y, 14);
          orbGrad.addColorStop(0, '#ffffff');
          orbGrad.addColorStop(0.4, orb.accentColor);
          orbGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
          ctx.fillStyle = orbGrad;
          ctx.beginPath();
          ctx.arc(opt.x, opt.y, 14, 0, Math.PI * 2);
          ctx.fill();
        });

        // 8. Companion Robot
        const rpt = worldToScreen(robot.x, robot.z, robot.y);
        const shadowPt = worldToScreen(robot.x, robot.z, 0);

        // Robot contact shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.ellipse(shadowPt.x, shadowPt.y, scale * 0.8, scale * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Robot Body (rounded dark matte charcoal torso)
        ctx.fillStyle = '#161c28';
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.5;
        const bodyW = scale * 0.85;
        const bodyH = scale * 1.0;
        ctx.beginPath();
        ctx.roundRect(rpt.x - bodyW / 2, rpt.y - bodyH, bodyW, bodyH, 10);
        ctx.fill();
        ctx.stroke();

        // Glowing cyan belt seam
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(rpt.x - bodyW / 2, rpt.y - bodyH * 0.35);
        ctx.lineTo(rpt.x + bodyW / 2, rpt.y - bodyH * 0.35);
        ctx.stroke();

        // Glowing Amber Heart Reactor
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(rpt.x, rpt.y - bodyH * 0.55, 5, 0, Math.PI * 2);
        ctx.fill();

        // Head (rounded dome)
        const headW = scale * 0.75;
        const headH = scale * 0.7;
        const headY = rpt.y - bodyH - headH * 0.8;
        ctx.fillStyle = '#161c28';
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(rpt.x - headW / 2, headY, headW, headH, 12);
        ctx.fill();
        ctx.stroke();

        // Antenna with glowing cyan bead tip
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rpt.x, headY);
        ctx.lineTo(rpt.x, headY - 14);
        ctx.stroke();

        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(rpt.x, headY - 16, 4, 0, Math.PI * 2);
        ctx.fill();

        // Robot Eyes (Visor)
        ctx.fillStyle = '#05070a';
        ctx.fillRect(rpt.x - headW * 0.38, headY + headH * 0.25, headW * 0.76, headH * 0.45);

        ctx.fillStyle = '#22d3ee';
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 3;
        if (robot.isBlinking) {
          // Closed line eyes - -
          ctx.beginPath();
          ctx.moveTo(rpt.x - 12, headY + headH * 0.48);
          ctx.lineTo(rpt.x - 4, headY + headH * 0.48);
          ctx.moveTo(rpt.x + 4, headY + headH * 0.48);
          ctx.lineTo(rpt.x + 12, headY + headH * 0.48);
          ctx.stroke();
        } else if (robot.isWaving) {
          // Happy arch eyes ^ ^
          ctx.beginPath();
          ctx.arc(rpt.x - 8, headY + headH * 0.52, 5, Math.PI, 0, false);
          ctx.arc(rpt.x + 8, headY + headH * 0.52, 5, Math.PI, 0, false);
          ctx.stroke();
        } else {
          // Open friendly glowing eye pills
          ctx.beginPath();
          ctx.roundRect(rpt.x - 12, headY + headH * 0.35, 6, 12, 3);
          ctx.roundRect(rpt.x + 6, headY + headH * 0.35, 6, 12, 3);
          ctx.fill();
        }

        // Floating Waving Arm
        if (robot.isWaving) {
          const waveAngle = Math.sin(robot.wavePhase) * 0.4;
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2;
          ctx.save();
          ctx.translate(rpt.x + bodyW * 0.6, rpt.y - bodyH * 0.7);
          ctx.rotate(-Math.PI * 0.6 + waveAngle);
          ctx.fillRect(0, -4, 20, 8);
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          ctx.arc(22, 0, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        animId = requestAnimationFrame(render);
      };

      animId = requestAnimationFrame(render);
      return () => cancelAnimationFrame(animId);
    }, [isSimulationActive, isBeaconActive, onNearExhibitChange, onOrbCollected]);

    return (
      <canvas
        ref={canvasRef}
        data-testid="fallback-canvas"
        className="absolute inset-0 z-0 w-full h-full cursor-grab active:cursor-grabbing"
      />
    );
  }
);

FallbackCanvasWorld.displayName = 'FallbackCanvasWorld';
