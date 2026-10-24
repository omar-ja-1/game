/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { VisitorSignal } from '../types/portfolio';
import { synthAudio } from '../audio/synthAudio';

interface BeaconModalProps {
  orbsCollected: number;
  totalOrbs: number;
  initialSignals?: VisitorSignal[];
  onClose: () => void;
}

export const BeaconModal: React.FC<BeaconModalProps> = ({
  orbsCollected,
  totalOrbs,
  initialSignals = [],
  onClose,
}) => {
  const isComplete = orbsCollected >= totalOrbs;

  const [signals, setSignals] = useState<VisitorSignal[]>(() => {
    try {
      const saved = localStorage.getItem('portfolio_visitor_signals');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return initialSignals;
  });

  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [message, setMessage] = useState('');
  const [transmitted, setTransmitted] = useState(false);

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

  const handleSubmitSignal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    const newSignal: VisitorSignal = {
      id: `sig-${Date.now()}`,
      author: name.trim(),
      organization: org.trim() || 'Independent Visitor',
      message: message.trim(),
      timestamp: 'Just now',
      color: '#22d3ee',
    };

    const updated = [newSignal, ...signals];
    setSignals(updated);
    try {
      localStorage.setItem('portfolio_visitor_signals', JSON.stringify(updated));
    } catch {}

    synthAudio.playBeaconActivated();
    setTransmitted(true);
    setName('');
    setOrg('');
    setMessage('');
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-[#04060a]/85 text-white select-none touch-auto animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90%] bg-[#090d16] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0c121d]">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <span>CENTRAL RESONANCE SPIRE</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>GUESTBOOK FREQUENCY</span>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Status Banner */}
          <div className={`p-4 rounded-2xl border ${isComplete ? 'bg-cyan-950/40 border-cyan-500/50' : 'bg-slate-900/60 border-slate-800'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-cyan-400">SPIRE POWER HARMONICS</span>
              <span className="text-sm font-bold font-mono text-amber-400 tabular-nums">
                {orbsCollected} / {totalOrbs} CORES
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-2">
              {isComplete
                ? 'Beacon Resonance Synchronized! The skyward beam is active. Transmit your coordinates into the eternal archive.'
                : `Beacon operates at partial capacity. Discover and gather all ${totalOrbs} energy cores throughout the plaza to unlock full transmission.`}
            </p>
          </div>

          {/* Guestbook Form */}
          <form onSubmit={handleSubmitSignal} className="space-y-4 bg-[#070b13] border border-slate-800 p-5 rounded-2xl">
            <h3 className="text-sm font-semibold text-white flex items-center justify-between">
              <span>Transmit Visitor Signal</span>
              {transmitted && <span className="text-xs font-mono text-cyan-400">Signal Logged Successfully</span>}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">YOUR NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Rivera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0d1422] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">AFFILIATION / LAB</label>
                <input
                  type="text"
                  placeholder="e.g. Stanford AI / Studio"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  className="w-full bg-[#0d1422] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">TRANSMISSION MESSAGE</label>
              <textarea
                required
                rows={2}
                placeholder="Leave an impression, collaboration note, or hello..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-[#0d1422] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 resize-none"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-lg text-xs font-mono transition-colors cursor-pointer"
            >
              Broadcast Signal to Beacon
            </button>
          </form>

          {/* Visitor Signals Feed */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Active Visitor Frequencies ({signals.length})
            </h4>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {signals.map((sig) => (
                <div key={sig.id} className="bg-[#0b101c] border border-slate-800/80 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-cyan-300">{sig.author}</span>
                    <span className="text-[10px] font-mono text-slate-500">{sig.timestamp}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">{sig.organization}</div>
                  <p className="text-xs text-slate-300 pt-0.5">{sig.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-800 bg-[#0c121d]">
          <button
            onClick={() => {
              synthAudio.playButtonClick();
              onClose();
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-colors cursor-pointer"
          >
            Return to Plaza
          </button>
        </div>
      </div>
    </div>
  );
};
