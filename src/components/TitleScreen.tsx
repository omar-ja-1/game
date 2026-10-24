/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';

interface TitleScreenProps {
  onStart: () => void;
  onOpenQuickView: () => void;
  isLoadingData?: boolean;
  profileName?: string;
  worldTitle?: string;
  worldTagline?: string;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  onOpenQuickView,
  isLoadingData = false,
  profileName,
  worldTitle,
  worldTagline,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStart]);

  const resolvedProfileName = profileName?.trim();

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-between p-6 sm:p-8 md:p-14 bg-gradient-to-b from-[#060911]/92 via-[#060911]/68 to-[#060911]/96 text-white select-none touch-auto overflow-y-auto">
      {/* Top Bar: Quiet Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-xs tracking-wider text-cyan-400 font-mono">
          <span>INTERACTIVE 3D PORTFOLIO</span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="text-slate-300">
            {isLoadingData ? 'SYNCHRONIZING DATA' : '6 SECTORS READY'}
          </span>
        </div>
        {resolvedProfileName && (
          <div className="text-xs text-slate-400 font-mono uppercase">
            <span>{resolvedProfileName}</span>
          </div>
        )}
      </div>

      {/* Center Hero Lockup */}
      <div className="max-w-2xl my-auto py-8 space-y-6">
        <div className="flex items-center gap-3">
          <svg
            className="w-10 h-10 text-cyan-400 shrink-0"
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="20"
              cy="20"
              r="18"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <polygon
              points="20,8 30,26 10,26"
              stroke="currentColor"
              strokeWidth="2"
              fill="rgba(34,211,238,0.15)"
            />
            <circle cx="20" cy="20" r="3" fill="#f59e0b" />
          </svg>
          <span className="text-xs font-mono tracking-widest text-amber-400">
            NOCTURNAL MUSEUM &amp; ARCHIVE
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-sans text-white text-balance leading-none">
          {worldTitle ? (
            worldTitle
          ) : (
            <>
              AURA <span className="text-cyan-400">·</span> 3D PORTFOLIO WORLD
            </>
          )}
        </h1>

        <p className="text-base md:text-lg text-slate-300 font-normal leading-relaxed max-w-xl">
          {worldTagline ||
            'Navigate a calm futuristic plaza with your companion automaton to explore About Me, Projects, Skills, Certificates, Contact Channels, and Visitor Reviews — or open Quick View for an instant standard portfolio.'}
        </p>

        {/* Primary & Accessible Quick-View Actions */}
        <div className="pt-2 flex flex-wrap items-center gap-3.5">
          <button
            data-start="true"
            type="button"
            onClick={onStart}
            className="min-h-[48px] px-7 py-3.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold rounded-xl text-sm tracking-wide transition-all duration-150 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center gap-2"
          >
            <span>Enter 3D World</span>
            <span className="text-xs opacity-75 font-mono">↵</span>
          </button>

          <button
            data-testid="quick-view-trigger"
            type="button"
            onClick={onOpenQuickView}
            className="min-h-[48px] px-6 py-3.5 bg-[#0c121e] hover:bg-slate-800 border border-slate-700 hover:border-cyan-400/60 text-slate-100 font-medium rounded-xl text-sm transition-colors cursor-pointer"
          >
            Quick View (Skip 3D)
          </button>
        </div>

        <div className="text-xs text-slate-400 font-mono hidden sm:block">
          Press{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">
            Enter
          </kbd>{' '}
          or{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">
            Space
          </kbd>{' '}
          to launch 3D exploration
        </div>
      </div>

      {/* Bottom Control Summary */}
      <div className="pt-5 border-t border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs font-mono text-slate-400">
        <div>
          <span>
            Desktop: WASD Move · E Interact · Drag Orbit · Esc Pause | Mobile: D-Pad · Tap Board
          </span>
        </div>
        <div className="text-slate-500">
          <span>Adaptive Mobile Rendering · Accessible HTML Fallback</span>
        </div>
      </div>
    </div>
  );
};
