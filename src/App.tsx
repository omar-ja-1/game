/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { WorldScene } from './three/WorldScene';
import { isWebGLSupported } from './three/webglCheck';
import { FallbackCanvasWorld, FallbackWorldHandle } from './components/FallbackCanvasWorld';
import { TitleScreen } from './components/TitleScreen';
import { PlayingHUD } from './components/PlayingHUD';
import { ExhibitModal } from './components/ExhibitModal';
import { BeaconModal } from './components/BeaconModal';
import { PauseModal } from './components/PauseModal';
import { CameraMode, ExhibitData, GameState } from './types/portfolio';
import { INITIAL_ORBS } from './data/portfolioData';
import { synthAudio } from './audio/synthAudio';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const worldSceneRef = useRef<WorldScene | null>(null);
  const fallbackRef = useRef<FallbackWorldHandle>(null);

  const [useFallback, setUseFallback] = useState<boolean>(() => !isWebGLSupported());
  const [gameState, setGameState] = useState<GameState>('title');
  const [activeExhibit, setActiveExhibit] = useState<ExhibitData | null>(null);
  const [nearExhibit, setNearExhibit] = useState<ExhibitData | null>(null);
  const [isBeaconModalOpen, setIsBeaconModalOpen] = useState<boolean>(false);
  const [orbsCollected, setOrbsCollected] = useState<number>(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isBeaconActive, setIsBeaconActive] = useState<boolean>(false);

  // Sync state to body attribute for testability & CSS state hooks
  useEffect(() => {
    document.body.dataset.state = gameState;
    const isPlaying = gameState === 'playing' && !activeExhibit && !isBeaconModalOpen;
    worldSceneRef.current?.setSimulationActive(isPlaying);
  }, [gameState, activeExhibit, isBeaconModalOpen]);

  // Mount 3D Scene safely
  useEffect(() => {
    if (!canvasMountRef.current) return;

    if (!isWebGLSupported()) {
      setUseFallback(true);
      return;
    }

    try {
      const scene = new WorldScene(canvasMountRef.current, {
        onInteractExhibit: (exhibit) => {
          if (exhibit.id === 'beacon') {
            setIsBeaconModalOpen(true);
          } else {
            setActiveExhibit(exhibit);
          }
        },
        onOrbCollected: (_orb, _index, totalCollected) => {
          setOrbsCollected(totalCollected);
          if (totalCollected >= INITIAL_ORBS.length) {
            setIsBeaconActive(true);
          }
        },
        onNearExhibitChange: (exhibit) => {
          setNearExhibit(exhibit);
        },
        onStateChange: (state) => {
          setGameState(state);
        },
      });

      worldSceneRef.current = scene;

      return () => {
        scene.dispose();
        worldSceneRef.current = null;
      };
    } catch (err) {
      console.warn('WebGL init failed, switching to Ambient Canvas Engine:', err);
      setUseFallback(true);
    }
  }, []);

  const handleStartGame = () => {
    setGameState('playing');
    synthAudio.playRobotChirp('happy');
  };

  const handleInspect = (exhibit: ExhibitData) => {
    synthAudio.playHologramScan();
    if (exhibit.id === 'beacon') {
      setIsBeaconModalOpen(true);
    } else {
      setActiveExhibit(exhibit);
    }
  };

  const handleCloseModal = () => {
    setActiveExhibit(null);
    setIsBeaconModalOpen(false);
  };

  const handleWarp = (exhibitId: string) => {
    if (useFallback) {
      fallbackRef.current?.warpToExhibit(exhibitId);
    } else {
      worldSceneRef.current?.warpToExhibit(exhibitId);
    }
  };

  const handleWave = () => {
    if (useFallback) {
      fallbackRef.current?.triggerRobotWave();
    } else {
      worldSceneRef.current?.triggerRobotWave();
    }
  };

  const handleToggleCamera = () => {
    const nextMode = cameraMode === 'follow' ? 'orbit' : 'follow';
    setCameraMode(nextMode);
    if (!useFallback) {
      worldSceneRef.current?.setCameraMode(nextMode);
    }
  };

  const handleToggleMute = () => {
    const muted = synthAudio.toggleMute();
    setIsMuted(muted);
  };

  const handlePause = () => {
    setGameState('paused');
  };

  const handleResume = () => {
    setGameState('playing');
  };

  const handleRestart = () => {
    if (useFallback) {
      fallbackRef.current?.resetSimulation();
    } else {
      worldSceneRef.current?.resetSimulation();
    }
    setOrbsCollected(0);
    setIsBeaconActive(false);
    setActiveExhibit(null);
    setIsBeaconModalOpen(false);
    setGameState('playing');
    synthAudio.playRobotChirp('happy');
  };

  const handleReturnTitle = () => {
    if (useFallback) {
      fallbackRef.current?.resetSimulation();
    } else {
      worldSceneRef.current?.resetSimulation();
    }
    setOrbsCollected(0);
    setIsBeaconActive(false);
    setActiveExhibit(null);
    setIsBeaconModalOpen(false);
    setGameState('title');
  };

  const handleVirtualMove = (forward: number, strafe: number) => {
    if (useFallback) {
      fallbackRef.current?.setVirtualInput(forward, strafe);
    } else {
      worldSceneRef.current?.setVirtualInput(forward, strafe);
    }
  };

  const handleJump = () => {
    if (useFallback) {
      fallbackRef.current?.triggerJump();
    } else {
      worldSceneRef.current?.triggerJump();
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#060911] font-sans">
      {/* 3D WebGL Canvas Container or Fallback 2.5D Canvas */}
      {!useFallback ? (
        <div
          ref={canvasMountRef}
          data-testid="threejs-canvas-mount"
          className="absolute inset-0 z-0 w-full h-full"
        />
      ) : (
        <FallbackCanvasWorld
          ref={fallbackRef}
          onInteractExhibit={handleInspect}
          onOrbCollected={(_orb, _index, totalCollected) => {
            setOrbsCollected(totalCollected);
            if (totalCollected >= INITIAL_ORBS.length) {
              setIsBeaconActive(true);
            }
          }}
          onNearExhibitChange={(exhibit) => setNearExhibit(exhibit)}
          onStateChange={(state) => setGameState(state)}
          isSimulationActive={gameState === 'playing' && !activeExhibit && !isBeaconModalOpen}
          cameraMode={cameraMode}
          orbsCollected={orbsCollected}
          totalOrbs={INITIAL_ORBS.length}
          isBeaconActive={isBeaconActive}
        />
      )}

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <TitleScreen onStart={handleStartGame} />
      )}

      {/* Playing HUD Overlay */}
      {gameState === 'playing' && (
        <PlayingHUD
          nearExhibit={nearExhibit}
          onInspect={handleInspect}
          onWarp={handleWarp}
          onWave={handleWave}
          onToggleCamera={handleToggleCamera}
          cameraMode={cameraMode}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          orbsCollected={orbsCollected}
          totalOrbs={INITIAL_ORBS.length}
          isBeaconActive={isBeaconActive}
          onVirtualMove={handleVirtualMove}
          onJump={handleJump}
        />
      )}

      {/* Exhibit Inspection Modal */}
      {activeExhibit && (
        <ExhibitModal
          exhibit={activeExhibit}
          onClose={handleCloseModal}
        />
      )}

      {/* Central Spire Beacon & Guestbook Modal */}
      {isBeaconModalOpen && (
        <BeaconModal
          orbsCollected={orbsCollected}
          totalOrbs={INITIAL_ORBS.length}
          onClose={handleCloseModal}
        />
      )}

      {/* Pause Modal */}
      {gameState === 'paused' && (
        <PauseModal
          onResume={handleResume}
          onRestart={handleRestart}
          onReturnTitle={handleReturnTitle}
          orbsCollected={orbsCollected}
          totalOrbs={INITIAL_ORBS.length}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}
    </div>
  );
}
