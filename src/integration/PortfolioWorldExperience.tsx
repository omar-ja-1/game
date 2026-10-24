/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { WorldScene } from '../three/WorldScene';
import { isWebGLSupported } from '../three/webglCheck';
import {
  isPerfDiagnosticsEnabled,
  loadQualityPreference,
  resolveQualityProfile,
  saveQualityPreference,
} from '../three/qualityConfig';
import { FallbackCanvasWorld, FallbackWorldHandle } from '../components/FallbackCanvasWorld';
import { TitleScreen } from '../components/TitleScreen';
import { PlayingHUD } from '../components/PlayingHUD';
import { PortfolioSectionModal } from '../components/PortfolioSectionModal';
import { StandardPortfolioView } from '../components/StandardPortfolioView';
import { BeaconModal } from '../components/BeaconModal';
import { PauseModal } from '../components/PauseModal';
import {
  ActiveModalView,
  CameraMode,
  GameState,
  HostNavigationEvent,
  PerfDiagnostics,
  PortfolioDataSource,
  PortfolioEntryMode,
  PortfolioOverviewData,
  QualityPreference,
  QualityTier,
  RenderActivityMode,
  VisitorSignal,
  WorldBillboardNode,
  ZoneId,
} from '../types/portfolio';
import { DEFAULT_WORLD_ORBS } from '../game/worldOrbs';
import {
  createEmptyPortfolioOverview,
  portfolioRepository,
} from '../services/portfolioRepository';
import { buildZoneLayout } from '../game/zoneLayout';
import { synthAudio } from '../audio/synthAudio';

export interface PortfolioWorldExperienceProps {
  /**
   * Replaceable portfolio data repository or adapter.
   * Defaults to `portfolioRepository` (which reads `VITE_PORTFOLIO_API_URL` or renders an
   * honest empty snapshot — never hardcoded demo records).
   */
  dataSource?: PortfolioDataSource;
  /**
   * Optional initial overview snapshot (useful for SSR/SSG hydration or standalone preview).
   */
  initialOverview?: PortfolioOverviewData;
  /**
   * Initial presentation mode: `'title'` (default), `'world'` (enter 3D immediately),
   * or `'quick-view'` (accessible HTML portfolio with option to launch 3D).
   */
  initialEntryMode?: PortfolioEntryMode;
  /**
   * Initial 3D zone when mounting (defaults to `'hub'`).
   */
  initialZone?: ZoneId;
  /**
   * Optional explicit graphics quality preference override (`'auto' | 'low' | 'medium' | 'high'`).
   */
  initialQualityPreference?: QualityPreference;
  /**
   * Optional custom title and tagline for the Title Screen overlay.
   */
  worldTitle?: string;
  worldTagline?: string;
  /**
   * Optional initial visitor guestbook signals for the Central Beacon Spire (defaults to `[]`).
   */
  initialVisitorSignals?: VisitorSignal[];
  /**
   * Optional host-website navigation hook. Return `true` to handle navigation in the host
   * router instead of opening the built-in modal or external link.
   */
  onHostNavigate?: (event: HostNavigationEvent) => boolean | void;
  /**
   * Container sizing/layout classes. Defaults to `'w-full h-full'`.
   * Mount inside a parent element with explicit width and height (e.g. `h-screen` or `h-[720px]`).
   */
  className?: string;
}

function triggerAnchorClickSafely(href: string, openInNewTab: boolean): void {
  if (typeof document === 'undefined') return;
  const anchor = document.createElement('a');
  anchor.href = href;
  if (openInNewTab) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export const PortfolioWorldExperience: React.FC<PortfolioWorldExperienceProps> = ({
  dataSource = portfolioRepository,
  initialOverview,
  initialEntryMode = 'title',
  initialZone = 'hub',
  initialQualityPreference,
  worldTitle,
  worldTagline,
  initialVisitorSignals = [],
  onHostNavigate,
  className = 'w-full h-full',
}) => {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const worldSceneRef = useRef<WorldScene | null>(null);
  const fallbackRef = useRef<FallbackWorldHandle>(null);
  const hasPlayedIntroGreetingRef = useRef<boolean>(false);

  const [useFallback, setUseFallback] = useState<boolean>(() => !isWebGLSupported());
  const [gameState, setGameState] = useState<GameState>(() =>
    initialEntryMode === 'world' ? 'playing' : 'title'
  );
  const [isQuickViewOpen, setIsQuickViewOpen] = useState<boolean>(
    () => initialEntryMode === 'quick-view'
  );

  // Portfolio Data State (loaded via replaceable PortfolioDataSource)
  const [overview, setOverview] = useState<PortfolioOverviewData>(
    () => initialOverview ?? createEmptyPortfolioOverview()
  );
  const [isLoadingData, setIsLoadingData] = useState<boolean>(() =>
    dataSource.isBackendConfigured()
  );

  // Multi-Zone & Modal State
  const [currentZone, setCurrentZone] = useState<ZoneId>(initialZone);
  const [activeModal, setActiveModal] = useState<ActiveModalView | null>(null);
  const [nearNode, setNearNode] = useState<WorldBillboardNode | null>(null);
  const [isZoneTransitioning, setIsZoneTransitioning] = useState<boolean>(false);

  // World Collectible & Companion Controls
  const [orbsCollected, setOrbsCollected] = useState<number>(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isBeaconActive, setIsBeaconActive] = useState<boolean>(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);

  // Adaptive Quality & Diagnostics
  const [qualityPreference, setQualityPreference] = useState<QualityPreference>(
    () => initialQualityPreference ?? loadQualityPreference()
  );
  const [activeQualityTier, setActiveQualityTier] = useState<QualityTier>(
    () => resolveQualityProfile(initialQualityPreference ?? loadQualityPreference()).tier
  );
  const [lowPerfSuggested, setLowPerfSuggested] = useState<boolean>(false);
  const [lowPerfDismissed, setLowPerfDismissed] = useState<boolean>(false);
  const showPerfDiagnostics = useMemo(() => isPerfDiagnosticsEnabled(), []);
  const [perfDiagnostics, setPerfDiagnostics] = useState<PerfDiagnostics | null>(null);

  const zoneLayout = useMemo(
    () => buildZoneLayout(currentZone, overview),
    [currentZone, overview]
  );

  // Refs used by stable WorldScene callbacks so UI state never recreates WebGL
  const currentZoneRef = useRef<ZoneId>(currentZone);
  currentZoneRef.current = currentZone;
  const overviewRef = useRef<PortfolioOverviewData>(overview);
  overviewRef.current = overview;
  const qualityPrefRef = useRef<QualityPreference>(qualityPreference);
  qualityPrefRef.current = qualityPreference;
  const onHostNavigateRef = useRef(onHostNavigate);
  onHostNavigateRef.current = onHostNavigate;

  const isOverlayPausing3D =
    isQuickViewOpen || gameState === 'paused' || activeModal !== null;
  const isPlaying = gameState === 'playing' && !isOverlayPausing3D;

  const renderActivityMode: RenderActivityMode = isOverlayPausing3D
    ? 'paused'
    : gameState === 'title'
    ? 'throttled'
    : 'active';

  const refreshOverview = useCallback(
    async (forceRefresh = false, signal?: AbortSignal) => {
      setIsLoadingData(true);
      try {
        const data = await dataSource.getOverview({ forceRefresh, signal });
        setOverview(data);
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          console.warn('Portfolio data refresh error:', err);
        }
      } finally {
        setIsLoadingData(false);
      }
    },
    [dataSource]
  );

  useEffect(() => {
    const controller = new AbortController();
    void refreshOverview(false, controller.signal);
    return () => controller.abort();
  }, [refreshOverview]);

  const pulseZoneScrim = useCallback(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    setIsZoneTransitioning(true);
    window.setTimeout(() => {
      setIsZoneTransitioning(false);
    }, 180);
  }, []);

  const navigateToZone = useCallback(
    (targetZone: ZoneId, options?: { restoreHubPosition?: boolean; openModal?: ActiveModalView }) => {
      if (targetZone !== 'hub' && onHostNavigateRef.current) {
        const handledByHost = onHostNavigateRef.current({ type: 'section', zone: targetZone });
        if (handledByHost === true) return;
      }

      if (targetZone === currentZoneRef.current) {
        if (options?.openModal) {
          setActiveModal(options.openModal);
        }
        return;
      }

      pulseZoneScrim();
      setNearNode(null);
      setCurrentZone(targetZone);

      const nextLayout = buildZoneLayout(targetZone, overviewRef.current);
      worldSceneRef.current?.applyZoneLayout(nextLayout, {
        restoreHubPosition: options?.restoreHubPosition,
      });

      if (options?.openModal) {
        setActiveModal(options.openModal);
      } else {
        synthAudio.playRobotChirp('curious');
      }
    },
    [pulseZoneScrim]
  );

  const handleReturnHub = useCallback(() => {
    navigateToZone('hub', { restoreHubPosition: true });
  }, [navigateToZone]);

  const handleActivateNode = useCallback(
    (node: WorldBillboardNode, meta?: { fromUserGesture?: boolean }) => {
      const { action } = node;

      if (action.type === 'enter_zone') {
        navigateToZone(action.zone, { openModal: action.openModal });
        return;
      }

      if (action.type === 'return_hub') {
        handleReturnHub();
        return;
      }

      if (action.type === 'open_modal') {
        const modal = action.modal;
        if (onHostNavigateRef.current) {
          if (modal.type === 'project') {
            const project = overviewRef.current.projects.find(
              (p) => p.id === modal.projectId
            );
            if (
              onHostNavigateRef.current({
                type: 'project',
                projectId: modal.projectId,
                project,
              }) === true
            ) {
              return;
            }
          } else if (modal.type === 'certificate') {
            const certificate = overviewRef.current.certificates.find(
              (c) => c.id === modal.certificateId
            );
            if (
              onHostNavigateRef.current({
                type: 'certificate',
                certificateId: modal.certificateId,
                certificate,
              }) === true
            ) {
              return;
            }
          }
        }
        setActiveModal(modal);
        return;
      }

      if (action.type === 'external_contact') {
        const contact = action.contact;
        if (onHostNavigateRef.current?.({ type: 'contact', contact }) === true) {
          return;
        }
        const isEmail =
          contact.kind === 'email' || contact.url.toLowerCase().startsWith('mailto:');
        if (meta?.fromUserGesture) {
          triggerAnchorClickSafely(contact.url, !isEmail);
        }
        setActiveModal({ type: 'contact', contactId: contact.id });
      }
    },
    [navigateToZone, handleReturnHub]
  );

  const handleActivateNodeRef = useRef(handleActivateNode);
  handleActivateNodeRef.current = handleActivateNode;
  const handleReturnHubRef = useRef(handleReturnHub);
  handleReturnHubRef.current = handleReturnHub;

  const handleToggleMute = useCallback(() => {
    const muted = synthAudio.toggleMute();
    setIsMuted(muted);
  }, []);

  const handleToggleDock = useCallback(() => {
    setIsDockCollapsed((prev) => !prev);
  }, []);

  // Sync simulation & render lifecycle mode without mutating global document.body
  useEffect(() => {
    worldSceneRef.current?.setSimulationActive(isPlaying);
    worldSceneRef.current?.setRenderActivityMode(renderActivityMode);
  }, [isPlaying, renderActivityMode]);

  // Trigger coordinated introductory greeting once when entering active 3D mode
  // (including when visitor starts in Quick View and later enters the 3D world)
  useEffect(() => {
    if (!isPlaying || hasPlayedIntroGreetingRef.current) return;
    hasPlayedIntroGreetingRef.current = true;

    const greetTimer = window.setTimeout(() => {
      if (useFallback) {
        fallbackRef.current?.triggerRobotGreeting();
      } else {
        worldSceneRef.current?.triggerRobotGreeting();
      }
    }, 180);

    return () => {
      window.clearTimeout(greetTimer);
    };
  }, [isPlaying, useFallback]);

  // Refresh active zone billboards in-place whenever `overview` updates asynchronously
  const prevOverviewRef = useRef<PortfolioOverviewData>(overview);
  useEffect(() => {
    if (prevOverviewRef.current === overview) return;
    prevOverviewRef.current = overview;
    if (worldSceneRef.current) {
      const refreshedLayout = buildZoneLayout(currentZoneRef.current, overview);
      worldSceneRef.current.applyZoneLayout(refreshedLayout, { preservePosition: true });
    }
  }, [overview]);

  // Mount single shared WebGL scene once per component lifecycle
  useEffect(() => {
    if (!canvasMountRef.current) return;

    if (!isWebGLSupported()) {
      setUseFallback(true);
      return;
    }

    const initialLayout = buildZoneLayout(currentZoneRef.current, overviewRef.current);

    try {
      const scene = new WorldScene(
        canvasMountRef.current,
        {
          onActivateNode: (node, meta) => {
            handleActivateNodeRef.current(node, meta);
          },
          onOrbCollected: (_orb, _index, totalCollected) => {
            setOrbsCollected(totalCollected);
            if (totalCollected >= DEFAULT_WORLD_ORBS.length) {
              setIsBeaconActive(true);
            }
          },
          onNearNodeChange: (node) => {
            setNearNode(node);
          },
          onStateChange: (state) => {
            setGameState(state);
          },
          onReturnHubShortcut: () => {
            handleReturnHubRef.current();
          },
          onCameraModeChange: (mode) => {
            setCameraMode(mode);
          },
          onToggleMute: () => {
            const muted = synthAudio.toggleMute();
            setIsMuted(muted);
          },
          onToggleDock: () => {
            setIsDockCollapsed((prev) => !prev);
          },
          onQualityResolved: (tier) => {
            setActiveQualityTier(tier);
          },
          onLowPerformanceSuggestion: () => {
            setLowPerfSuggested(true);
          },
          onPerfDiagnostics: showPerfDiagnostics
            ? (stats) => {
                setPerfDiagnostics(stats);
              }
            : undefined,
        },
        {
          initialQualityPreference: qualityPrefRef.current,
          enablePerfDiagnostics: showPerfDiagnostics,
          initialZoneLayout: initialLayout,
        }
      );

      worldSceneRef.current = scene;

      return () => {
        scene.dispose();
        worldSceneRef.current = null;
      };
    } catch (err) {
      console.warn('WebGL init failed, switching to Ambient Canvas Engine:', err);
      setUseFallback(true);
    }
  }, [showPerfDiagnostics]);

  const handleStartGame = () => {
    setIsQuickViewOpen(false);
    setGameState('playing');
  };

  const handleOpenQuickView = () => {
    setIsQuickViewOpen(true);
  };

  const handleEnter3DFromQuickView = (targetZone?: ZoneId) => {
    setIsQuickViewOpen(false);
    if (gameState !== 'playing') {
      setGameState('playing');
    }
    if (targetZone) {
      navigateToZone(targetZone);
    }
  };

  const handleCloseModal = () => {
    setActiveModal(null);
  };

  const handleWarp = (nodeId: string) => {
    if (useFallback) {
      fallbackRef.current?.warpToNode(nodeId);
    } else {
      worldSceneRef.current?.warpToNode(nodeId);
    }
  };

  const handleWave = () => {
    if (useFallback) {
      fallbackRef.current?.triggerRobotGreeting();
    } else {
      worldSceneRef.current?.triggerRobotGreeting();
    }
  };

  const handleToggleCamera = () => {
    const nextMode: CameraMode = cameraMode === 'follow' ? 'orbit' : 'follow';
    setCameraMode(nextMode);
    if (!useFallback) {
      worldSceneRef.current?.setCameraMode(nextMode);
    }
  };

  const handleChangeQuality = (preference: QualityPreference) => {
    saveQualityPreference(preference);
    setQualityPreference(preference);
    const resolved = resolveQualityProfile(preference);
    setActiveQualityTier(resolved.tier);
    if (!useFallback) {
      worldSceneRef.current?.setQualityPreference(preference);
    }
  };

  const handlePause = () => {
    setGameState('paused');
  };

  const handleResume = () => {
    setGameState('playing');
  };

  const handleRestart = () => {
    const hubLayout = buildZoneLayout('hub', overviewRef.current);
    setCurrentZone('hub');
    setNearNode(null);
    if (useFallback) {
      fallbackRef.current?.resetSimulation();
    } else {
      worldSceneRef.current?.resetSimulation(hubLayout);
    }
    setOrbsCollected(0);
    setIsBeaconActive(false);
    setActiveModal(null);
    hasPlayedIntroGreetingRef.current = false;
    setGameState('playing');
  };

  const handleReturnTitle = () => {
    const hubLayout = buildZoneLayout('hub', overviewRef.current);
    setCurrentZone('hub');
    setNearNode(null);
    if (useFallback) {
      fallbackRef.current?.resetSimulation();
    } else {
      worldSceneRef.current?.resetSimulation(hubLayout);
    }
    setOrbsCollected(0);
    setIsBeaconActive(false);
    setActiveModal(null);
    setIsQuickViewOpen(false);
    hasPlayedIntroGreetingRef.current = false;
    setGameState('title');
  };

  const handleVirtualMove = (forward: number, strafe: number) => {
    if (useFallback) {
      fallbackRef.current?.setVirtualInput(forward, strafe);
    } else {
      worldSceneRef.current?.setVirtualInput(forward, strafe);
    }
  };

  const handleJump = () => {
    if (useFallback) {
      fallbackRef.current?.triggerJump();
    } else {
      worldSceneRef.current?.triggerJump();
    }
  };

  return (
    <div
      data-portfolio-state={isQuickViewOpen ? 'quick_view' : gameState}
      data-portfolio-zone={currentZone}
      className={`relative overflow-hidden bg-[#060911] font-sans touch-none ${className}`}
    >
      {/* 3D WebGL Canvas Container or Fallback 2.5D Canvas */}
      {!useFallback ? (
        <div
          ref={canvasMountRef}
          data-testid="threejs-canvas-mount"
          className="absolute inset-0 z-0 w-full h-full touch-none"
        />
      ) : (
        <FallbackCanvasWorld
          ref={fallbackRef}
          zoneLayout={zoneLayout}
          onActivateNode={handleActivateNode}
          onOrbCollected={(_orb, _index, totalCollected) => {
            setOrbsCollected(totalCollected);
            if (totalCollected >= DEFAULT_WORLD_ORBS.length) {
              setIsBeaconActive(true);
            }
          }}
          onNearNodeChange={(node) => setNearNode(node)}
          onStateChange={(state) => setGameState(state)}
          onReturnHubShortcut={handleReturnHub}
          onToggleMute={handleToggleMute}
          onToggleDock={handleToggleDock}
          isSimulationActive={isPlaying}
          renderActivityMode={renderActivityMode}
          qualityTier={activeQualityTier}
          cameraMode={cameraMode}
          orbsCollected={orbsCollected}
          totalOrbs={DEFAULT_WORLD_ORBS.length}
          isBeaconActive={isBeaconActive}
        />
      )}

      {/* Brief Zone Transition Scrim (scoped to experience container) */}
      {isZoneTransitioning && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-20 bg-[#060911]/70 pointer-events-none transition-opacity duration-150"
        />
      )}

      {/* Accessible Standard Portfolio View (Quick View / Skip 3D) */}
      {isQuickViewOpen && (
        <StandardPortfolioView
          overview={overview}
          isLoadingData={isLoadingData}
          dataSource={dataSource}
          onEnter3DWorld={handleEnter3DFromQuickView}
          onOpenProjectModal={(modal) => setActiveModal(modal)}
          onFeedbackSaved={() => void refreshOverview(true)}
        />
      )}

      {/* Title Screen Overlay */}
      {!isQuickViewOpen && gameState === 'title' && (
        <TitleScreen
          onStart={handleStartGame}
          onOpenQuickView={handleOpenQuickView}
          isLoadingData={isLoadingData}
          profileName={overview.profile.name}
          worldTitle={worldTitle}
          worldTagline={worldTagline}
        />
      )}

      {/* Playing HUD Overlay */}
      {!isQuickViewOpen && gameState === 'playing' && (
        <PlayingHUD
          currentZone={currentZone}
          zoneTitle={zoneLayout.theme.title}
          zoneNodes={zoneLayout.nodes}
          nearNode={nearNode}
          onActivateNode={handleActivateNode}
          onOpenContactDetails={(contactId) =>
            setActiveModal({ type: 'contact', contactId })
          }
          onReturnHub={handleReturnHub}
          onOpenQuickView={handleOpenQuickView}
          onWarp={handleWarp}
          onWave={handleWave}
          onToggleCamera={handleToggleCamera}
          cameraMode={cameraMode}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          orbsCollected={orbsCollected}
          totalOrbs={DEFAULT_WORLD_ORBS.length}
          isBeaconActive={isBeaconActive}
          qualityTier={activeQualityTier}
          perfDiagnostics={showPerfDiagnostics ? perfDiagnostics : null}
          showLowPerfSuggestion={lowPerfSuggested && !lowPerfDismissed}
          onDismissLowPerfSuggestion={() => setLowPerfDismissed(true)}
          isDockCollapsed={isDockCollapsed}
          onToggleDock={handleToggleDock}
          onVirtualMove={handleVirtualMove}
          onJump={handleJump}
        />
      )}

      {/* Portfolio Section Inspection Modals (About, Project, Skills, Certificates, Contact, Reviews/Feedback) */}
      {activeModal && activeModal.type !== 'beacon' && (
        <PortfolioSectionModal
          modal={activeModal}
          overview={overview}
          currentZone={currentZone}
          dataSource={dataSource}
          onClose={handleCloseModal}
          onNavigateZone={(zone) => navigateToZone(zone)}
          onReturnHub={handleReturnHub}
          onFeedbackSaved={() => void refreshOverview(true)}
        />
      )}

      {/* Central Spire Beacon & Guestbook Modal */}
      {activeModal?.type === 'beacon' && (
        <BeaconModal
          orbsCollected={orbsCollected}
          totalOrbs={DEFAULT_WORLD_ORBS.length}
          initialSignals={initialVisitorSignals}
          onClose={handleCloseModal}
        />
      )}

      {/* Pause Modal */}
      {!isQuickViewOpen && gameState === 'paused' && (
        <PauseModal
          currentZone={currentZone}
          onResume={handleResume}
          onReturnHub={handleReturnHub}
          onOpenQuickView={handleOpenQuickView}
          onRestart={handleRestart}
          onReturnTitle={handleReturnTitle}
          orbsCollected={orbsCollected}
          totalOrbs={DEFAULT_WORLD_ORBS.length}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          qualityPreference={qualityPreference}
          activeQualityTier={activeQualityTier}
          onChangeQuality={handleChangeQuality}
        />
      )}
    </div>
  );
};
