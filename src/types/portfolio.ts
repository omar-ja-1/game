/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MetricItem {
  label: string;
  value: string;
}

export interface ExhibitData {
  id: string;
  title: string;
  category: string;
  subtitle: string;
  role: string;
  year: string;
  summary: string;
  fullDescription: string[];
  metrics: MetricItem[];
  techStack: string[];
  highlights: string[];
  imageAsset: string;
  accentColor: string; // e.g. '#22d3ee' (cyan) or '#f59e0b' (amber)
  glowColor: number;
  position: [number, number, number];
  rotationY: number;
  terminalType: 'profile' | 'project' | 'interactive' | 'beacon';
  githubUrl?: string;
  liveUrl?: string;
}

export interface CollectibleOrbData {
  id: string;
  title: string;
  clue: string;
  position: [number, number, number];
  accentColor: string;
  collected: boolean;
}

export interface VisitorSignal {
  id: string;
  author: string;
  organization: string;
  message: string;
  timestamp: string;
  color: string;
}

export type GameState = 'title' | 'playing' | 'paused' | 'inspecting' | 'beacon_activated';
export type CameraMode = 'follow' | 'orbit' | 'firstperson';
export type CompanionEmotion = 'idle' | 'happy' | 'waving' | 'curious' | 'excited';
