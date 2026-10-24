/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { synthAudio } from '../audio/synthAudio';
import { QualityPreference, QualityTier, ZoneId } from '../types/portfolio';

interface PauseModalProps {
  currentZone: ZoneId;
  onResume: () => void;
  onReturnHub: () => void;
  onOpenQuickView: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  orbsCollected: number;
  totalOrbs: number;
  isMuted: boolean;
  onToggleMute: () => void;
  qualityPreference: QualityPreference;
  activeQualityTier: QualityTier;
  onChangeQuality: (preference: QualityPreference) => void;
}

const QUALITY_OPTIONS: { value: QualityPreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
];

export const PauseModal: React.FC<PauseModalProps> = ({
  currentZone,
  onResume,
  onReturnHub,
  onOpenQuickView,
  onRestart,
  onReturnTitle,
  orbsCollected,
  totalOrbs,
  isMuted,
  onToggleMute,
  qualityPreference,
  activeQualityTier,
  onChangeQuality,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        synthAudio.playButtonClick();
        onResume();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onResume]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#04060a]/88 text-white select-none touch-auto overflow-y-auto">
      <div className="w-full max-w-md bg-[#090d16] border border-slate-800 rounded-3xl p-6 md:p-7 shadow-2xl space-y-5 my-auto">
        {/* Title */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <span className="text-sm font-mono font-bold text-cyan-400">SIMULATION PAUSED</span>
          <span className="text-xs font-mono text-slate-500">[ESC]</span>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0c121d] border border-slate-800 p-3 rounded-xl">
            <div className="text-[11px] text-slate-400 font-mono">ENERGY CORES</div>
            <div className="text-lg font-bold font-mono text-amber-400 tabular-nums">
              {orbsCollected} / {totalOrbs}
            </div>
          </div>
          <div className="bg-[#0c121d] border border-slate-800 p-3 rounded-xl">
            <div className="text-[11px] text-slate-400 font-mono">AUDIO ENGINE</div>
            <div className="text-lg font-bold font-mono text-cyan-300">
              {isMuted ? 'MUTED' : 'ACTIVE'}
            </div>
          </div>
        </div>

        {/* Adaptive Graphics Quality Selector (Auto / Low / Medium / High) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">GRAPHICS QUALITY</span>
            <span className="text-cyan-300">
              {qualityPreference === 'auto'
                ? `AUTO · ${activeQualityTier.toUpperCase()}`
                : activeQualityTier.toUpperCase()}
            </span>
          </div>
          <div
            role="group"
            aria-label="Graphics Quality"
            className="grid grid-cols-4 gap-1.5 p-1 bg-[#070b13] border border-slate-800 rounded-xl"
          >
            {QUALITY_OPTIONS.map((opt) => {
              const isSelected = qualityPreference === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    synthAudio.playButtonClick();
                    onChangeQuality(opt.value);
                  }}
                  className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Controls Cheat-sheet */}
        <div className="bg-[#070b13] border border-slate-800 p-4 rounded-xl space-y-2 text-xs font-mono text-slate-300">
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">
            Controls Guide
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Move Companion:</span>
            <span>WASD / Touch D-Pad</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Interact / Enter:</span>
            <span>E / Tap Board</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Return Main Hub:</span>
            <span>Backspace / Portal</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Camera &amp; Wave:</span>
            <span>C / Q</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => {
              synthAudio.playButtonClick();
              onResume();
            }}
            className="w-full min-h-[44px] py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-xl text-xs font-mono tracking-wider transition-colors cursor-pointer"
          >
            RESUME 3D WORLD
          </button>

          {currentZone !== 'hub' && (
            <button
              type="button"
              onClick={() => {
                synthAudio.playButtonClick();
                onResume();
                onReturnHub();
              }}
              className="w-full min-h-[42px] py-2 bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/50 text-amber-300 rounded-xl text-xs font-mono transition-colors cursor-pointer"
            >
              ← RETURN TO MAIN WORLD
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              synthAudio.playButtonClick();
              onOpenQuickView();
            }}
            className="w-full min-h-[42px] py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 rounded-xl text-xs font-mono transition-colors cursor-pointer border border-slate-700"
          >
            OPEN QUICK VIEW (STANDARD PORTFOLIO)
          </button>

          <button
            type="button"
            onClick={() => {
              synthAudio.playButtonClick();
              onToggleMute();
            }}
            className="w-full min-h-[42px] py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono transition-colors cursor-pointer"
          >
            {isMuted ? 'UNMUTE AUDIO [M]' : 'MUTE AUDIO [M]'}
          </button>

          <button
            type="button"
            onClick={() => {
              synthAudio.playButtonClick();
              onRestart();
            }}
            className="w-full min-h-[40px] py-2 bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono transition-colors cursor-pointer"
          >
            RESET WORLD EXPLORATION
          </button>

          <button
            type="button"
            onClick={() => {
              synthAudio.playButtonClick();
              onReturnTitle();
            }}
            className="w-full min-h-[38px] py-1.5 text-slate-500 hover:text-slate-300 rounded-xl text-xs font-mono transition-colors cursor-pointer"
          >
            RETURN TO TITLE SCREEN
          </button>
        </div>
      </div>
    </div>
  );
};
