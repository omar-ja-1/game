/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ExhibitData } from '../types/portfolio';
import { synthAudio } from '../audio/synthAudio';

interface ExhibitModalProps {
  exhibit: ExhibitData;
  onClose: () => void;
}

export const ExhibitModal: React.FC<ExhibitModalProps> = ({ exhibit, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'architecture' | 'stack' | 'interactive'>('overview');

  // Interactive playground states
  const [simNodes, setSimNodes] = useState<number>(32);
  const [simFreq, setSimFreq] = useState<number>(432);
  const [testedLatency, setTestedLatency] = useState<string>('11.2ms');
  const [companionMood, setCompanionMood] = useState<'happy' | 'curious' | 'wave'>('happy');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        synthAudio.playButtonClick();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleTabChange = (tab: 'overview' | 'architecture' | 'stack' | 'interactive') => {
    synthAudio.playButtonClick();
    setActiveTab(tab);
  };

  const [imageError, setImageError] = useState<boolean>(false);

  useEffect(() => {
    setImageError(false);
  }, [exhibit.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-[#04060a]/85 text-white select-none touch-auto animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#090d16] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0c121d]">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <span>TERMINAL ARCHIVE</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{exhibit.category.toUpperCase()}</span>
          </div>

          <button
            onClick={() => {
              synthAudio.playButtonClick();
              onClose();
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            CLOSE [ESC]
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Top Split: Hologram Image Card + Title Block */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Hologram Artwork Frame */}
            <div className="md:col-span-5 relative rounded-2xl overflow-hidden border border-slate-800 bg-[#060a12] aspect-[4/3] flex items-center justify-center group">
              {!imageError ? (
                <img
                  src={exhibit.imageAsset}
                  alt={exhibit.title}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#081221] to-[#050811]">
                  <span className="text-xs font-mono text-cyan-400">{exhibit.category}</span>
                  <span className="text-sm font-semibold text-slate-200 mt-1">
                    {exhibit.title.split('//')[0].trim()}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#090d16] via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 text-[11px] font-mono text-cyan-300">
                PROJECTION ACTIVE
              </div>
            </div>

            {/* Title & Metadata */}
            <div className="md:col-span-7 space-y-3">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                {exhibit.title}
              </h2>

              <p className="text-sm font-medium text-cyan-400">
                {exhibit.subtitle}
              </p>

              {/* Clean unboxed metadata with dot separators */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-sans">
                <span>{exhibit.role}</span>
                <span aria-hidden="true">·</span>
                <span>{exhibit.year}</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-400 font-mono">Status: Verified</span>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed pt-1">
                {exhibit.summary}
              </p>

              {/* Metric Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                {exhibit.metrics.map((m, i) => (
                  <div key={i} className="bg-[#0e1524] border border-slate-800/80 rounded-xl p-2.5">
                    <div className="text-[11px] text-slate-400">{m.label}</div>
                    <div className="text-sm font-bold font-mono text-cyan-300 tabular-nums">{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pt-2 pb-1">
            <button
              onClick={() => handleTabChange('overview')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-cyan-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => handleTabChange('architecture')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'architecture'
                  ? 'bg-cyan-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Architecture & Details
            </button>
            <button
              onClick={() => handleTabChange('stack')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'stack'
                  ? 'bg-cyan-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Tech Stack
            </button>
            <button
              onClick={() => handleTabChange('interactive')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'interactive'
                  ? 'bg-cyan-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Interactive Laboratory
            </button>
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                {exhibit.fullDescription.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>

              <div className="pt-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-cyan-400 mb-2">Key Engineering Highlights</h4>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {exhibit.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-cyan-400 font-mono">▸</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Tab 2: Architecture & Details */}
          {activeTab === 'architecture' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#070b13] border border-slate-800 rounded-2xl p-5 space-y-4 font-mono text-xs">
                <div className="text-cyan-400 flex items-center justify-between">
                  <span>TOPOLOGICAL FLOW DIAGRAM</span>
                  <span className="text-slate-500">RESILIENT PIPELINE</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="bg-[#0d1422] p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">INGRESS</div>
                    <div className="text-white font-bold mt-1">Zero-Copy WebGL Stream</div>
                  </div>
                  <div className="bg-[#0d1422] p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">EXECUTION</div>
                    <div className="text-cyan-400 font-bold mt-1">Rust WASM Ring Buffer</div>
                  </div>
                  <div className="bg-[#0d1422] p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">EGRESS</div>
                    <div className="text-amber-400 font-bold mt-1">Sub-16ms Spatial HUD</div>
                  </div>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed font-sans pt-2">
                  Constructed with non-blocking concurrency invariants. Thread workers communicate
                  across SharedArrayBuffers, ensuring that rendering framerates never drop during
                  heavy algorithmic recalculations.
                </p>
              </div>
            </div>
          )}

          {/* Tab 3: Tech Stack */}
          {activeTab === 'stack' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <p className="text-xs text-slate-400">
                Core technologies and production libraries powering this architecture:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {exhibit.techStack.map((tech, i) => (
                  <div key={i} className="bg-[#0b101c] border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">{tech}</span>
                    <span className="text-[10px] font-mono text-cyan-400">v2026</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Interactive Laboratory */}
          {activeTab === 'interactive' && (
            <div className="space-y-4 bg-[#070b13] border border-slate-800 rounded-2xl p-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
                <span>ACTIVE SIMULATION CHAMBER</span>
                <span className="text-slate-500">LIVE COMPUTATION</span>
              </div>

              {exhibit.id === 'neurogrid' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Active Topology Nodes: {simNodes}</span>
                      <span className="font-mono text-cyan-300">Estimated Latency: {testedLatency}</span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={128}
                      value={simNodes}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSimNodes(val);
                        setTestedLatency(`${(8 + (128 - val) * 0.05).toFixed(1)}ms`);
                      }}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>
                  <button
                    onClick={() => {
                      synthAudio.playHologramScan();
                      setTestedLatency(`${(9.8 + Math.random() * 2).toFixed(1)}ms`);
                    }}
                    className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-lg text-xs font-mono transition-colors cursor-pointer"
                  >
                    Benchmark Topology Ring
                  </button>
                </div>
              )}

              {exhibit.id === 'quantum-canvas' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Resonant Carrier Frequency: {simFreq} Hz</span>
                      <span className="font-mono text-amber-300">Phase Angle: {(simFreq / 432).toFixed(2)}π</span>
                    </div>
                    <input
                      type="range"
                      min={200}
                      max={880}
                      value={simFreq}
                      onChange={(e) => setSimFreq(Number(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>
                  <button
                    onClick={() => {
                      synthAudio.playOrbCollect(3);
                    }}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs font-mono transition-colors cursor-pointer"
                  >
                    Pulse Crystal Harmonic
                  </button>
                </div>
              )}

              {exhibit.id === 'orbit-companion' && (
                <div className="space-y-4">
                  <div className="text-xs text-slate-400">
                    Test Companion Emotion Synthesizer:
                  </div>
                  <div className="flex items-center gap-2">
                    {(['happy', 'curious', 'wave'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setCompanionMood(m);
                          synthAudio.playRobotChirp(m);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                          companionMood === m ? 'bg-cyan-400 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {exhibit.id === 'profile' && (
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="font-mono text-cyan-300">AVAILABILITY // Q4 2026</div>
                  <p>
                    Open for select advisory engagements, spatial system architecture, and keynote
                    workshops on calm human-machine interfaces.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#0c121d]">
          <div className="text-xs text-slate-400 font-mono hidden sm:inline">
            AURA ARCHIVE // ID: {exhibit.id}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                synthAudio.playButtonClick();
                onClose();
              }}
              className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold rounded-lg text-xs font-mono transition-colors cursor-pointer"
            >
              Resume World Exploration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
