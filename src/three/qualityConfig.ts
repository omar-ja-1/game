/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QualityPreference, QualityTier } from '../types/portfolio';

export interface QualityProfile {
  tier: QualityTier;
  label: string;
  maxPixelRatio: number;
  antialias: boolean;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  shadowMapType: 'pcf-soft' | 'pcf';
  useLightweightFloor: boolean;
  enableScanlineOverlay: boolean;
  enableBillboardLights: boolean;
  enableOrbLights: boolean;
  enablePlazaFillLight: boolean;
  enableRobotHeartLight: boolean;
  billboardParticleCount: number;
  ambientDustCount: number;
  floorTextureSize: number;
  summaryCardWidth: number;
  maxAnisotropyCap: number;
  maxHologramTextureSize: number;
  scanlineSegments: number;
  decorativeUpdateStride: number;
  decorativeCullDistance: number;
  lazyImageLoadDistance: number;
  maxActiveBillboardUpdates: number;
  titleTargetFps: number;
  fallbackGridStep: number;
}

export interface DeviceCapabilitySignals {
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  coarsePointer: boolean;
  maxTouchPoints: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  prefersReducedMotion: boolean;
}

export const MAX_BILLBOARD_PARTICLES = 36;
export const MAX_AMBIENT_DUST_PARTICLES = 120;

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  high: {
    tier: 'high',
    label: 'High',
    maxPixelRatio: 2.0,
    antialias: true,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    shadowMapType: 'pcf-soft',
    useLightweightFloor: false,
    enableScanlineOverlay: true,
    enableBillboardLights: true,
    enableOrbLights: true,
    enablePlazaFillLight: true,
    enableRobotHeartLight: true,
    billboardParticleCount: 36,
    ambientDustCount: 120,
    floorTextureSize: 1024,
    summaryCardWidth: 768,
    maxAnisotropyCap: 8,
    maxHologramTextureSize: 1024,
    scanlineSegments: 28,
    decorativeUpdateStride: 1,
    decorativeCullDistance: 46,
    lazyImageLoadDistance: 28,
    maxActiveBillboardUpdates: 14,
    titleTargetFps: 30,
    fallbackGridStep: 4,
  },
  medium: {
    tier: 'medium',
    label: 'Medium',
    maxPixelRatio: 1.3,
    antialias: true,
    shadowsEnabled: true,
    shadowMapSize: 512,
    shadowMapType: 'pcf',
    useLightweightFloor: false,
    enableScanlineOverlay: true,
    enableBillboardLights: true,
    enableOrbLights: false,
    enablePlazaFillLight: true,
    enableRobotHeartLight: true,
    billboardParticleCount: 18,
    ambientDustCount: 64,
    floorTextureSize: 512,
    summaryCardWidth: 512,
    maxAnisotropyCap: 4,
    maxHologramTextureSize: 768,
    scanlineSegments: 14,
    decorativeUpdateStride: 2,
    decorativeCullDistance: 32,
    lazyImageLoadDistance: 22,
    maxActiveBillboardUpdates: 10,
    titleTargetFps: 24,
    fallbackGridStep: 4,
  },
  low: {
    tier: 'low',
    label: 'Low',
    maxPixelRatio: 1.0,
    antialias: false,
    shadowsEnabled: false,
    shadowMapSize: 512,
    shadowMapType: 'pcf',
    useLightweightFloor: true,
    enableScanlineOverlay: false,
    enableBillboardLights: false,
    enableOrbLights: false,
    enablePlazaFillLight: false,
    enableRobotHeartLight: false,
    billboardParticleCount: 6,
    ambientDustCount: 28,
    floorTextureSize: 512,
    summaryCardWidth: 512,
    maxAnisotropyCap: 1,
    maxHologramTextureSize: 512,
    scanlineSegments: 6,
    decorativeUpdateStride: 3,
    decorativeCullDistance: 22,
    lazyImageLoadDistance: 16,
    maxActiveBillboardUpdates: 6,
    titleTargetFps: 18,
    fallbackGridStep: 6,
  },
};

const QUALITY_STORAGE_KEY = 'aura_graphics_quality_preference';

/**
 * Pure, deterministic quality tier resolver from device signals.
 * Combines pointer precision, viewport geometry, CPU concurrency, deviceMemory (3–4 GB mobile tier),
 * and motion preferences without relying solely on user-agent strings.
 */
export function resolveQualityTierFromSignals(signals: DeviceCapabilitySignals): QualityTier {
  const shortestSide = Math.min(signals.viewportWidth, signals.viewportHeight);
  const longestSide = Math.max(signals.viewportWidth, signals.viewportHeight);
  const isTouchPrimary = signals.coarsePointer || (signals.maxTouchPoints > 0 && shortestSide < 900);

  // Very constrained RAM (<= 3 GB) or CPU cores (<= 2) -> Low
  if (
    (typeof signals.deviceMemory === 'number' && signals.deviceMemory <= 3) ||
    (typeof signals.hardwareConcurrency === 'number' && signals.hardwareConcurrency <= 2)
  ) {
    return 'low';
  }

  // Budget/mid mobile phones (touch + compact viewport or 3–4 GB RAM touch devices) -> Low
  if (
    isTouchPrimary &&
    (shortestSide < 600 ||
      longestSide < 960 ||
      (typeof signals.deviceMemory === 'number' && signals.deviceMemory <= 4))
  ) {
    return 'low';
  }

  // Ultra-compact viewport even without touch -> Low
  if (shortestSide < 480) {
    return 'low';
  }

  if (signals.prefersReducedMotion && isTouchPrimary) {
    return 'low';
  }

  // Tablets or 4-GB / 4-core desktop systems -> Medium
  if (
    isTouchPrimary ||
    signals.prefersReducedMotion ||
    (typeof signals.deviceMemory === 'number' && signals.deviceMemory <= 4) ||
    (typeof signals.hardwareConcurrency === 'number' && signals.hardwareConcurrency <= 4)
  ) {
    return 'medium';
  }

  return 'high';
}

/**
 * Computes effective device pixel ratio for Low/Medium/High, allowing 0.75–0.85 DPR
 * on very weak devices (<= 2 GB RAM / <= 2 cores or runtime adaptive step-down).
 */
export function computeEffectivePixelRatio(
  profile: QualityProfile,
  signals: DeviceCapabilitySignals,
  adaptiveDprScale: number = 1.0,
  isSoftwareGl: boolean = false
): number {
  if (isSoftwareGl) return 1.0;

  const rawDpr = Math.max(0.75, signals.devicePixelRatio || 1);
  if (profile.tier === 'low') {
    const isVeryWeakHardware =
      (typeof signals.deviceMemory === 'number' && signals.deviceMemory <= 2) ||
      (typeof signals.hardwareConcurrency === 'number' && signals.hardwareConcurrency <= 2);
    const baseCap = isVeryWeakHardware ? 0.8 : profile.maxPixelRatio; // <= 1.0
    const scaled = Math.min(rawDpr, baseCap) * adaptiveDprScale;
    return Number(Math.max(0.75, Math.min(1.0, scaled)).toFixed(2));
  }

  return Number(Math.min(rawDpr, profile.maxPixelRatio).toFixed(2));
}

export function gatherDeviceCapabilitySignals(): DeviceCapabilitySignals {
  if (typeof window === 'undefined') {
    return {
      viewportWidth: 1440,
      viewportHeight: 900,
      devicePixelRatio: 1,
      coarsePointer: false,
      maxTouchPoints: 0,
      hardwareConcurrency: 8,
      deviceMemory: 8,
      prefersReducedMotion: false,
    };
  }

  const nav = navigator as Navigator & { deviceMemory?: number };
  let coarsePointer = false;
  let prefersReducedMotion = false;

  try {
    coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    // matchMedia unavailable
  }

  return {
    viewportWidth: window.innerWidth || 1024,
    viewportHeight: window.innerHeight || 768,
    devicePixelRatio: window.devicePixelRatio || 1,
    coarsePointer,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    prefersReducedMotion,
  };
}

export function detectRecommendedQualityTier(): QualityTier {
  return resolveQualityTierFromSignals(gatherDeviceCapabilitySignals());
}

export function resolveQualityProfile(preference: QualityPreference): QualityProfile {
  const tier: QualityTier = preference === 'auto' ? detectRecommendedQualityTier() : preference;
  return QUALITY_PROFILES[tier];
}

export function loadQualityPreference(): QualityPreference {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(QUALITY_STORAGE_KEY);
    if (saved === 'auto' || saved === 'low' || saved === 'medium' || saved === 'high') {
      return saved;
    }
  } catch {
    // localStorage blocked
  }
  return 'auto';
}

export function saveQualityPreference(preference: QualityPreference): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUALITY_STORAGE_KEY, preference);
  } catch {
    // localStorage blocked
  }
}

export function isPerfDiagnosticsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('perf') === '1';
  } catch {
    return false;
  }
}

// ============================================================================
// Conservative Runtime Frame-Time Adaptation (Hysteresis & Cooldown Protected)
// ============================================================================

export interface GovernorStepOutcome {
  changed: boolean;
  tier: QualityTier;
  dprScale: number;
  recommendFallbackView: boolean;
}

/**
 * Monitors active gameplay frame times with zero per-frame object allocations.
 * - Ignores isolated spikes (> 250ms tab switches or one-off stalls).
 * - Requires 2 consecutive slow 2.5s windows (< ~26 FPS / > 38ms avg) + 8s cooldown to step down.
 * - Steps down High -> Medium -> Low (1.0 DPR) -> Low (0.75 DPR).
 * - Suggests lightweight Quick View if Low @ 0.75 DPR still averages > 62ms (< 16 FPS) for 3 windows.
 * - Restores quality up to `ceilingTier` only after 4 consecutive fast windows (> 54 FPS) + 20s cooldown.
 */
export class RuntimeQualityGovernor {
  private ceilingTier: QualityTier;
  private currentTier: QualityTier;
  private dprScale: number = 1.0;

  private windowElapsedMs: number = 0;
  private frameCount: number = 0;
  private slowStreak: number = 0;
  private criticalStreak: number = 0;
  private fastStreak: number = 0;
  private lastChangeAtMs: number = -Infinity;
  private fallbackSuggested: boolean = false;

  private static readonly WINDOW_DURATION_MS = 2500;
  private static readonly MIN_WINDOW_FRAMES = 25;
  private static readonly DOWNGRADE_COOLDOWN_MS = 8000;
  private static readonly UPGRADE_COOLDOWN_MS = 20000;
  private static readonly SLOW_FRAME_MS = 38.5; // ~26 FPS
  private static readonly CRITICAL_FRAME_MS = 62.5; // ~16 FPS
  private static readonly FAST_FRAME_MS = 18.5; // ~54 FPS

  constructor(initialTier: QualityTier) {
    this.ceilingTier = initialTier;
    this.currentTier = initialTier;
  }

  public reset(ceilingTier: QualityTier): void {
    this.ceilingTier = ceilingTier;
    this.currentTier = ceilingTier;
    this.dprScale = 1.0;
    this.windowElapsedMs = 0;
    this.frameCount = 0;
    this.slowStreak = 0;
    this.criticalStreak = 0;
    this.fastStreak = 0;
    this.fallbackSuggested = false;
  }

  public getState(): { tier: QualityTier; dprScale: number; recommendFallbackView: boolean } {
    return {
      tier: this.currentTier,
      dprScale: this.dprScale,
      recommendFallbackView: this.fallbackSuggested,
    };
  }

  public recordFrame(frameMs: number, nowMs: number): GovernorStepOutcome | null {
    // Reject single huge spikes (tab unfocus, shader compile, GC hiccup)
    if (frameMs <= 0 || frameMs > 250) {
      return null;
    }

    this.windowElapsedMs += frameMs;
    this.frameCount += 1;

    if (
      this.windowElapsedMs < RuntimeQualityGovernor.WINDOW_DURATION_MS ||
      this.frameCount < RuntimeQualityGovernor.MIN_WINDOW_FRAMES
    ) {
      return null;
    }

    const avgFrameMs = this.windowElapsedMs / this.frameCount;
    this.windowElapsedMs = 0;
    this.frameCount = 0;

    if (avgFrameMs > RuntimeQualityGovernor.SLOW_FRAME_MS) {
      this.slowStreak += 1;
      this.fastStreak = 0;

      if (this.currentTier === 'low' && this.dprScale <= 0.76 && avgFrameMs > RuntimeQualityGovernor.CRITICAL_FRAME_MS) {
        this.criticalStreak += 1;
        if (this.criticalStreak >= 3 && !this.fallbackSuggested) {
          this.fallbackSuggested = true;
          return {
            changed: false,
            tier: this.currentTier,
            dprScale: this.dprScale,
            recommendFallbackView: true,
          };
        }
      } else {
        this.criticalStreak = 0;
      }

      if (
        this.slowStreak >= 2 &&
        nowMs - this.lastChangeAtMs >= RuntimeQualityGovernor.DOWNGRADE_COOLDOWN_MS
      ) {
        this.slowStreak = 0;
        if (this.currentTier === 'high') {
          this.currentTier = 'medium';
          this.lastChangeAtMs = nowMs;
          return {
            changed: true,
            tier: this.currentTier,
            dprScale: this.dprScale,
            recommendFallbackView: this.fallbackSuggested,
          };
        }
        if (this.currentTier === 'medium') {
          this.currentTier = 'low';
          this.dprScale = 1.0;
          this.lastChangeAtMs = nowMs;
          return {
            changed: true,
            tier: this.currentTier,
            dprScale: this.dprScale,
            recommendFallbackView: this.fallbackSuggested,
          };
        }
        if (this.currentTier === 'low' && this.dprScale > 0.76) {
          this.dprScale = 0.75;
          this.lastChangeAtMs = nowMs;
          return {
            changed: true,
            tier: this.currentTier,
            dprScale: this.dprScale,
            recommendFallbackView: this.fallbackSuggested,
          };
        }
      }
      return null;
    }

    if (avgFrameMs < RuntimeQualityGovernor.FAST_FRAME_MS) {
      this.fastStreak += 1;
      this.slowStreak = 0;
      this.criticalStreak = 0;

      if (
        this.fastStreak >= 4 &&
        nowMs - this.lastChangeAtMs >= RuntimeQualityGovernor.UPGRADE_COOLDOWN_MS
      ) {
        this.fastStreak = 0;
        const rank: Record<QualityTier, number> = { low: 0, medium: 1, high: 2 };

        if (this.currentTier === 'low' && this.dprScale < 1.0) {
          this.dprScale = 1.0;
          this.lastChangeAtMs = nowMs;
          return {
            changed: true,
            tier: this.currentTier,
            dprScale: this.dprScale,
            recommendFallbackView: this.fallbackSuggested,
          };
        }

        if (rank[this.currentTier] < rank[this.ceilingTier]) {
          this.currentTier = this.currentTier === 'low' ? 'medium' : 'high';
          this.lastChangeAtMs = nowMs;
          return {
            changed: true,
            tier: this.currentTier,
            dprScale: this.dprScale,
            recommendFallbackView: this.fallbackSuggested,
          };
        }
      }
      return null;
    }

    // Healthy middle band (18.5ms–38.5ms): decay streaks without oscillating
    this.slowStreak = 0;
    this.criticalStreak = 0;
    this.fastStreak = 0;
    return null;
  }
}
