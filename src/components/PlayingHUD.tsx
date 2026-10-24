/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CameraMode, ExhibitData } from '../types/portfolio';
import { EXHIBITS } from '../data/portfolioData';

interface PlayingHUDProps {
  nearExhibit: ExhibitData | null;
  onInspect: (exhibit: ExhibitData) => void;
  onWarp: (exhibitId: string) => void;
  onWave: () => void;
  onToggleCamera: () => void;
  cameraMode: CameraMode;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  orbsCollected: number;
  totalOrbs: number;
  isBeaconActive: boolean;
  onVirtualMove?: (forward: number, strafe: number) => void;
  onJump?: () => void;
}

export const PlayingHUD: React.FC<PlayingHUDProps> = ({
  nearExhibit,
  onInspect,
  onWarp,
  onWave,
  onToggleCamera,
  cameraMode,
  isMuted,
  onToggleMute,
  onPause,
  orbsCollected,
  totalOrbs,
  isBeaconActive,
  onVirtualMove,
  onJump,
}) => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-30 flex flex-col justify-between p-4 md:p-6 text-white font-sans">
      {/* 1. TOP ZONE: Perimeter Clusters */}
      <div className="flex items-start justify-between w-full">
        {/* Top-Left Cluster: Status & Quest Readout */}
        <div className="pointer-events-auto flex flex-col gap-2 bg-[#090d16]/90 border border-slate-800 rounded-xl p-3.5 shadow-xl max-w-xs">
          <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
            <span>NOCTURNAL PLAZA</span>
            <span className="text-slate-500">60 FPS</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="text-xs text-slate-300">Energy Cores</span>
            <span className="text-sm font-mono font-bold text-amber-400 tabular-nums">
              {orbsCollected} / {totalOrbs}
            </span>
          </div>
          {isBeaconActive ? (
            <div className="text-[11px] font-mono text-cyan-300">
              Central Beacon Awakened
            </div>
          ) : (
            <div className="text-[11px] text-slate-400">
              Gather cores to power the Central Spire
            </div>
          )}
        </div>

        {/* Top-Right Cluster: Quick Utility Icon Buttons */}
        <div className="pointer-events-auto flex items-center gap-2 bg-[#090d16]/90 border border-slate-800 rounded-xl p-2 shadow-xl">
          <button
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleCamera();
            }}
            tabIndex={-1}
            title="Toggle Camera Mode [C]"
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>CAM: {cameraMode.toUpperCase()}</span>
            <span className="text-[10px] text-slate-500">[C]</span>
          </button>

          <button
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            tabIndex={-1}
            title="Toggle Sound [M]"
            className="p-2 rounded-lg text-xs text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isMuted ? (
              <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>

          <button
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            tabIndex={-1}
            title="Pause Simulation [Esc]"
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            PAUSE
          </button>
        </div>
      </div>

      {/* 2. CENTER RETICLE / INTERACTION PROMPT */}
      {nearExhibit && (
        <div className="pointer-events-auto mx-auto my-auto flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
          <button
            onClick={() => onInspect(nearExhibit)}
            className="px-5 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-xl text-xs tracking-wider font-mono shadow-2xl shadow-cyan-500/30 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span>[E] INSPECT {nearExhibit.title.split('//')[0].toUpperCase()}</span>
          </button>
          <span className="text-[11px] font-mono text-slate-400 bg-[#090d16]/80 px-2.5 py-0.5 rounded border border-slate-800">
            Click or press E to view archive
          </span>
        </div>
      )}

      {/* Mobile Touch Navigation Controls (Visible on small screens) */}
      <div className="pointer-events-auto flex md:hidden items-center justify-between w-full px-2 pb-1">
        {/* Virtual Directional D-Pad */}
        <div className="grid grid-cols-3 gap-1 p-1.5 bg-[#090d16]/95 border border-slate-800 rounded-2xl">
          <div />
          <button
            onTouchStart={(e) => { e.preventDefault(); onVirtualMove?.(1, 0); }}
            onTouchEnd={(e) => { e.preventDefault(); onVirtualMove?.(0, 0); }}
            onMouseDown={() => onVirtualMove?.(1, 0)}
            onMouseUp={() => onVirtualMove?.(0, 0)}
            aria-label="Move Forward"
            className="w-9 h-9 bg-slate-800 active:bg-cyan-400 active:text-slate-950 text-slate-200 rounded-lg flex items-center justify-center font-bold text-xs"
          >
            ▲
          </button>
          <div />
          <button
            onTouchStart={(e) => { e.preventDefault(); onVirtualMove?.(0, -1); }}
            onTouchEnd={(e) => { e.preventDefault(); onVirtualMove?.(0, 0); }}
            onMouseDown={() => onVirtualMove?.(0, -1)}
            onMouseUp={() => onVirtualMove?.(0, 0)}
            aria-label="Strafe Left"
            className="w-9 h-9 bg-slate-800 active:bg-cyan-400 active:text-slate-950 text-slate-200 rounded-lg flex items-center justify-center font-bold text-xs"
          >
            ◄
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); onVirtualMove?.(-1, 0); }}
            onTouchEnd={(e) => { e.preventDefault(); onVirtualMove?.(0, 0); }}
            onMouseDown={() => onVirtualMove?.(-1, 0)}
            onMouseUp={() => onVirtualMove?.(0, 0)}
            aria-label="Move Backward"
            className="w-9 h-9 bg-slate-800 active:bg-cyan-400 active:text-slate-950 text-slate-200 rounded-lg flex items-center justify-center font-bold text-xs"
          >
            ▼
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); onVirtualMove?.(0, 1); }}
            onTouchEnd={(e) => { e.preventDefault(); onVirtualMove?.(0, 0); }}
            onMouseDown={() => onVirtualMove?.(0, 1)}
            onMouseUp={() => onVirtualMove?.(0, 0)}
            aria-label="Strafe Right"
            className="w-9 h-9 bg-slate-800 active:bg-cyan-400 active:text-slate-950 text-slate-200 rounded-lg flex items-center justify-center font-bold text-xs"
          >
            ►
          </button>
        </div>

        {/* Action Button: Jump */}
        <div className="flex items-center gap-2">
          <button
            onClick={onJump}
            aria-label="Jump"
            className="w-12 h-12 bg-slate-800 active:bg-cyan-400 active:text-slate-950 text-cyan-300 border border-slate-700 rounded-2xl flex flex-col items-center justify-center font-mono text-[11px] font-bold shadow-lg"
          >
            <span>JUMP</span>
          </button>
        </div>
      </div>

      {/* 3. BOTTOM COLLAPSIBLE CONTROL DOCK */}
      <div className="pointer-events-auto mx-auto w-full max-w-3xl flex flex-col items-center">
        {/* Collapse / Expand Toggle Button attached to top of dock */}
        <button
          onClick={() => setIsDockCollapsed(!isDockCollapsed)}
          className="mb-1.5 px-3 py-1 bg-[#090d16]/90 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-t-lg text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <span>{isDockCollapsed ? '▴ Show Dock' : '▾ Hide Dock'}</span>
          <span className="text-[10px] text-slate-500">[H]</span>
        </button>

        {!isDockCollapsed && (
          <div className="w-full bg-[#090d16]/95 border border-slate-800 rounded-2xl p-3 shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-150">
            {/* Fast Warp Navigation Links */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <span className="text-xs font-mono text-slate-500 mr-1 hidden sm:inline">WARP:</span>
              {EXHIBITS.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => onWarp(ex.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    nearExhibit?.id === ex.id
                      ? 'bg-cyan-400 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  {ex.id === 'profile'
                    ? 'About'
                    : ex.id === 'neurogrid'
                    ? 'NeuroGrid'
                    : ex.id === 'quantum-canvas'
                    ? 'Quantum 3D'
                    : ex.id === 'orbit-companion'
                    ? 'OrbitOS'
                    : 'Beacon'}
                </button>
              ))}
            </div>

            {/* Companion Verb Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onWave}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <span>Wave</span>
                <span className="text-[10px] text-slate-400">[Q]</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
