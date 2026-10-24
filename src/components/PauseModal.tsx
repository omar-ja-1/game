/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { synthAudio } from '../audio/synthAudio';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  orbsCollected: number;
  totalOrbs: number;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onReturnTitle,
  orbsCollected,
  totalOrbs,
  isMuted,
  onToggleMute,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#04060a]/85 text-white select-none animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#090d16] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        {/* Title */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold text-cyan-400">SIMULATION PAUSED</span>
          </div>
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

        {/* Navigation / Control Cheat-sheet */}
        <div className="bg-[#070b13] border border-slate-800 p-4 rounded-xl space-y-2 text-xs font-mono text-slate-300">
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Controls Guide</div>
          <div className="flex justify-between">
            <span className="text-slate-400">Move Companion:</span>
            <span>WASD / Arrow Keys</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Jump / Hop:</span>
            <span>Space</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Inspect Hologram:</span>
            <span>E / Click Prompt</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Companion Wave:</span>
            <span>Q</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Camera Mode:</span>
            <span>C</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={() => {
              synthAudio.playButtonClick();
              onResume();
            }}
            className="w-full py-3 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-xl text-xs font-mono tracking-wider transition-colors cursor-pointer"
          >
            RESUME SIMULATION
          </button>

          <button
            onClick={() => {
              synthAudio.playButtonClick();
              onRestart();
            }}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono transition-colors cursor-pointer border border-slate-700"
          >
            RESTART EXPLORATION
          </button>

          <button
            onClick={() => {
              synthAudio.playButtonClick();
              onToggleMute();
            }}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono transition-colors cursor-pointer"
          >
            {isMuted ? 'UNMUTE AUDIO [M]' : 'MUTE AUDIO [M]'}
          </button>

          <button
            onClick={() => {
              synthAudio.playButtonClick();
              onReturnTitle();
            }}
            className="w-full py-2.5 text-slate-500 hover:text-slate-300 rounded-xl text-xs font-mono transition-colors cursor-pointer"
          >
            RETURN TO TITLE SCREEN
          </button>
        </div>
      </div>
    </div>
  );
};
