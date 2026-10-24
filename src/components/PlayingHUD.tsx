/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  CameraMode,
  PerfDiagnostics,
  QualityTier,
  WorldBillboardNode,
  ZoneId,
} from '../types/portfolio';

interface PlayingHUDProps {
  currentZone: ZoneId;
  zoneTitle: string;
  zoneNodes: WorldBillboardNode[];
  nearNode: WorldBillboardNode | null;
  onActivateNode: (node: WorldBillboardNode, meta?: { fromUserGesture?: boolean }) => void;
  onOpenContactDetails: (contactId?: string) => void;
  onReturnHub: () => void;
  onOpenQuickView: () => void;
  onWarp: (nodeId: string) => void;
  onWave: () => void;
  onToggleCamera: () => void;
  cameraMode: CameraMode;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  orbsCollected: number;
  totalOrbs: number;
  isBeaconActive: boolean;
  qualityTier: QualityTier;
  perfDiagnostics?: PerfDiagnostics | null;
  showLowPerfSuggestion?: boolean;
  onDismissLowPerfSuggestion?: () => void;
  isDockCollapsed: boolean;
  onToggleDock: () => void;
  onVirtualMove?: (forward: number, strafe: number) => void;
  onJump?: () => void;
}

function getShortWarpLabel(node: WorldBillboardNode): string {
  if (node.kind === 'return_home') return '← Main Hub';
  if (node.id === 'hub-about') return 'About';
  if (node.id === 'hub-projects') return 'Projects';
  if (node.id === 'hub-skills') return 'Skills';
  if (node.id === 'hub-certificates') return 'Certificates';
  if (node.id === 'hub-contact') return 'Contact';
  if (node.id === 'hub-feedback') return 'Reviews';
  const clean = node.title.trim();
  return clean.length > 16 ? `${clean.slice(0, 15).trimEnd()}…` : clean;
}

export const PlayingHUD: React.FC<PlayingHUDProps> = ({
  currentZone,
  zoneTitle,
  zoneNodes,
  nearNode,
  onActivateNode,
  onOpenContactDetails,
  onReturnHub,
  onOpenQuickView,
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
  qualityTier,
  perfDiagnostics,
  showLowPerfSuggestion = false,
  onDismissLowPerfSuggestion,
  isDockCollapsed,
  onToggleDock,
  onVirtualMove,
  onJump,
}) => {
  const stopMove = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    onVirtualMove?.(0, 0);
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-30 flex flex-col justify-between p-3 sm:p-4 md:p-6 text-white font-sans">
      {/* 1. TOP ZONE: Perimeter Clusters */}
      <div className="flex flex-col gap-2 w-full">
        <div className="flex items-start justify-between w-full gap-2">
          {/* Top-Left Cluster: Active Zone Status, Return-to-Hub Button & Quest Readout */}
          <div className="pointer-events-auto flex flex-col gap-2 bg-[#090d16]/94 border border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-xl max-w-[260px] sm:max-w-xs">
            <div className="flex items-center justify-between gap-3 text-xs font-mono text-cyan-400">
              <span className="truncate font-semibold">{zoneTitle.toUpperCase()}</span>
              <span className="text-slate-400 shrink-0">
                {qualityTier === 'medium' ? 'MED' : qualityTier.toUpperCase()}
              </span>
            </div>

            {currentZone === 'hub' ? (
              <>
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
                    Explore 6 sectors or gather cores
                  </div>
                )}
              </>
            ) : (
              <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  data-testid="hud-return-hub"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onReturnHub();
                  }}
                  className="w-full min-h-[42px] px-3 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/50 text-amber-300 font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>← Main World</span>
                </button>
              </div>
            )}

            {/* Optional Dev-Only Performance Diagnostics (?perf=1) */}
            {perfDiagnostics && (
              <div
                data-testid="perf-diagnostics"
                className="pt-1.5 mt-0.5 border-t border-slate-800/80 text-[10px] font-mono text-slate-400 tabular-nums flex flex-wrap items-center gap-x-2 gap-y-0.5"
              >
                <span className="text-cyan-300 font-semibold">{perfDiagnostics.fps} FPS</span>
                <span aria-hidden="true">·</span>
                <span>{perfDiagnostics.drawCalls} draws</span>
                <span aria-hidden="true">·</span>
                <span>{(perfDiagnostics.triangles / 1000).toFixed(1)}k tris</span>
                <span aria-hidden="true">·</span>
                <span>DPR {perfDiagnostics.dpr}</span>
              </div>
            )}
          </div>

          {/* Top-Right Cluster: Quick View, Camera, Sound, Pause */}
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5 bg-[#090d16]/94 border border-slate-800 rounded-2xl p-1.5 shadow-xl">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenQuickView();
              }}
              tabIndex={-1}
              title="Open Accessible Standard Portfolio View"
              className="min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-mono text-cyan-300 hover:text-slate-950 hover:bg-cyan-400 bg-slate-800/70 transition-colors whitespace-nowrap cursor-pointer"
            >
              QUICK VIEW
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleCamera();
              }}
              tabIndex={-1}
              title="Toggle Camera Mode [C]"
              className="min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-mono text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors hidden sm:flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <span>CAM: {cameraMode.toUpperCase()}</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              tabIndex={-1}
              aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              title="Toggle Sound [M]"
              className="min-w-[40px] min-h-[40px] p-2 rounded-xl text-xs text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
            >
              {isMuted ? (
                <svg
                  className="w-4 h-4 text-rose-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              tabIndex={-1}
              title="Pause & Graphics Settings [Esc]"
              className="min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-mono text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              PAUSE
            </button>
          </div>
        </div>

        {/* Conservative Low-FPS Fallback Banner (shown only on sustained severe frame-time pressure) */}
        {showLowPerfSuggestion && (
          <div className="pointer-events-auto mx-auto bg-[#090d16]/95 border border-amber-500/40 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 max-w-xl shadow-xl">
            <span className="text-xs text-slate-200">
              Device GPU load is high. Switch to Quick View for instant zero-lag reading?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenQuickView}
                className="min-h-[36px] px-3 py-1 rounded-lg bg-amber-400 text-slate-950 font-mono text-xs font-bold cursor-pointer"
              >
                Open Quick View
              </button>
              <button
                type="button"
                onClick={onDismissLowPerfSuggestion}
                className="min-h-[36px] px-2.5 py-1 rounded-lg text-slate-400 hover:text-white font-mono text-xs cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. CENTER INTERACTION PROMPT */}
      {nearNode && (
        <div className="pointer-events-auto mx-auto my-auto flex flex-col items-center gap-2">
          {nearNode.externalHref ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a
                href={nearNode.externalHref}
                target={nearNode.externalNewTab ? '_blank' : undefined}
                rel={nearNode.externalNewTab ? 'noopener noreferrer' : undefined}
                className="min-h-[46px] px-5 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-xl text-xs tracking-wider font-mono shadow-2xl shadow-cyan-500/30 inline-flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
              >
                <span>[E] {nearNode.promptLabel}</span>
                <span aria-hidden="true">{nearNode.externalNewTab ? '↗' : '✉'}</span>
              </a>
              {nearNode.action.type === 'external_contact' && (
                <button
                  type="button"
                  onClick={() => onOpenContactDetails(nearNode.action.type === 'external_contact' ? nearNode.action.contact.id : undefined)}
                  className="min-h-[46px] px-3.5 py-2.5 bg-[#090d16]/95 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-mono cursor-pointer"
                >
                  Copy / Info
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onActivateNode(nearNode, { fromUserGesture: true })}
              className={`min-h-[46px] px-5 py-2.5 font-bold rounded-xl text-xs tracking-wider font-mono shadow-2xl flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
                nearNode.kind === 'return_home'
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-500/25'
                  : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-cyan-500/30'
              }`}
            >
              <span>[E] {nearNode.promptLabel}</span>
            </button>
          )}
          <span className="text-[11px] font-mono text-slate-300 bg-[#090d16]/90 px-3 py-1 rounded-lg border border-slate-800">
            Tap billboard, tap button, or press E
          </span>
        </div>
      )}

      {/* Mobile Touch Navigation Controls (>= 44x44px touch targets) */}
      <div className="pointer-events-auto flex md:hidden items-end justify-between w-full px-1 pb-1 touch-none">
        <div className="grid grid-cols-3 gap-1 p-1.5 bg-[#090d16]/95 border border-slate-800 rounded-2xl touch-none">
          <div />
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              onVirtualMove?.(1, 0);
            }}
            onTouchEnd={stopMove}
            onTouchCancel={stopMove}
            onMouseDown={() => onVirtualMove?.(1, 0)}
            onMouseUp={() => onVirtualMove?.(0, 0)}
            onMouseLeave={() => onVirtualMove?.(0, 0)}
            aria-label="Move Forward"
            className="w-11 h-11 bg-slate-800 active:bg-cyan-400 active:text-slate-950 text-slate-200 rounded-lg flex items-center justify-center font-bold text-xs touch-none"
          >
            ▲
          </button>
          <div />
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              onVirtualMove?.(0, -1);
            }}
            onTouchEnd={stopMove}
            onTouchCancel={stopMove}
            onMouseDown={() => onVirtualMove?.(0, -1)}
            onMouseUp={() => onVirtualMove?.(0, 0)}
            onMouseLeave={() => onVirtualMove?.(0, 0)}
            aria-label="Strafe Left"
            className="w-11 h-11 bg-slate-800 active:bg-cyan-400 active:text-slate-950 text-slate-200 rounded-lg flex items-center justify-center font-bold text-xs touch-none"
          >
            ◄
          </button>
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              onVirtualMove?.(-1, 0);
            }}
            onTouchEnd={stopMove}
            onTouchCancel={stopMove}
            onMouseDown={() => onVirtualMove?.(-1, 0)}
            onMouseUp={() => onVirtualMove?.(0, 0)}
            onMouseLeave={() => onVirtualMove?.(0, 0)}
            aria-label="Move Backward"
            className="w-11 h-11 bg-slate-800 active:bg-cyan-400 active:text-slate-950 text-slate-200 rounded-lg flex items-center justify-center font-bold text-xs touch-none"
          >
            ▼
          </button>
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              onVirtualMove?.(0, 1);
            }}
            onTouchEnd={stopMove}
            onTouchCancel={stopMove}
            onMouseDown={() => onVirtualMove?.(0, 1)}
            onMouseUp={() => onVirtualMove?.(0, 0)}
            onMouseLeave={() => onVirtualMove?.(0, 0)}
            aria-label="Strafe Right"
            className="w-11 h-11 bg-slate-800 active:bg-cyan-400 active:text-slate-950 text-slate-200 rounded-lg flex items-center justify-center font-bold text-xs touch-none"
          >
            ►
          </button>
        </div>

        <div className="flex items-center gap-2 touch-none">
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              onJump?.();
            }}
            onClick={onJump}
            aria-label="Jump"
            className="w-14 h-14 bg-slate-800 active:bg-cyan-400 active:text-slate-950 text-cyan-300 border border-slate-700 rounded-2xl flex flex-col items-center justify-center font-mono text-[11px] font-bold shadow-lg touch-none"
          >
            <span>JUMP</span>
          </button>
        </div>
      </div>

      {/* 3. BOTTOM COLLAPSIBLE FAST-WARP DOCK */}
      <div className="pointer-events-auto mx-auto w-full max-w-4xl flex flex-col items-center">
        <button
          type="button"
          onClick={onToggleDock}
          className="mb-1.5 min-h-[34px] px-3.5 py-1 bg-[#090d16]/94 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-t-xl text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <span>{isDockCollapsed ? '▴ Show Warp Dock' : '▾ Hide Warp Dock'}</span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">[H]</span>
        </button>

        {!isDockCollapsed && (
          <div className="w-full bg-[#090d16]/95 border border-slate-800 rounded-2xl p-2.5 md:p-3 shadow-2xl flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
              <span className="text-xs font-mono text-slate-500 mr-1 hidden sm:inline">WARP:</span>
              {zoneNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onWarp(node.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    nearNode?.id === node.id
                      ? 'bg-cyan-400 text-slate-950 font-semibold'
                      : node.kind === 'return_home'
                      ? 'bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 border border-amber-400/40'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  {getShortWarpLabel(node)}
                </button>
              ))}

              {currentZone === 'hub' && (
                <button
                  type="button"
                  onClick={() => onWarp('hub-central-beacon')}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    nearNode?.id === 'hub-central-beacon'
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-amber-300/90 hover:text-amber-200 hover:bg-slate-800/80'
                  }`}
                >
                  Spire
                </button>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2 shrink-0 ml-auto">
              <button
                type="button"
                onClick={onWave}
                className="min-h-[38px] px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 rounded-xl text-xs font-mono transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer border border-slate-700"
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
