/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';

interface TitleScreenProps {
  onStart: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart }) => {
  useEffect(() => {
    // Autostart support via query param ?autostart=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      onStart();
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStart]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between p-8 md:p-14 bg-gradient-to-b from-[#060911]/90 via-[#060911]/60 to-[#060911]/95 text-white select-none">
      {/* Top Bar: Quiet Metadata */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs tracking-wider text-cyan-400 font-mono">
          <span>PORTFOLIO EXHIBITION 2026</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400">SECTOR 07 // NOCTURNAL PLAZA</span>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          <span>AURA KAELEN ARCHIVE</span>
        </div>
      </div>

      {/* Center Hero Lockup over calm negative space */}
      <div className="max-w-2xl my-auto space-y-6">
        {/* Bespoke inline SVG Title Emblem */}
        <div className="flex items-center gap-3">
          <svg className="w-10 h-10 text-cyan-400" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
            <polygon points="20,8 30,26 10,26" stroke="currentColor" strokeWidth="2" fill="rgba(34,211,238,0.15)" />
            <circle cx="20" cy="20" r="3" fill="#f59e0b" />
          </svg>
          <span className="text-xs font-mono tracking-widest text-amber-400">ORBITOS 3D SIMULATION</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight font-sans text-white text-balance leading-none">
          AURA <span className="text-cyan-400">//</span> 3D NOCTURNAL WORLD
        </h1>

        <p className="text-base md:text-lg text-slate-300 font-normal leading-relaxed max-w-xl">
          Step into a quiet, atmospheric nocturnal museum. Explore holographic project archives,
          gather harmonic energy cores, and interact with your friendly companion automaton.
        </p>

        {/* Primary Start Action */}
        <div className="pt-2 flex flex-wrap items-center gap-4">
          <button
            data-start="true"
            onClick={onStart}
            className="px-8 py-4 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold rounded-xl text-sm tracking-wide transition-all duration-150 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center gap-2"
          >
            <span>Enter Exhibition</span>
            <span className="text-xs opacity-75 font-mono">↵</span>
          </button>
          <span className="text-xs text-slate-400 font-mono">
            Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">Enter</kbd> or{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">Space</kbd>
          </span>
        </div>
      </div>

      {/* Bottom Flat Control Hint Line */}
      <div className="pt-6 border-t border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-mono text-slate-400">
        <div>
          <span>WASD Move · Space Jump · E Inspect · Q Wave · C Camera · Esc Pause</span>
        </div>
        <div className="text-slate-500">
          <span>Three.js PBR Engine · Procedural Web Audio</span>
        </div>
      </div>
    </div>
  );
};
