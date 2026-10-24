/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { WorldScene } from './three/WorldScene';
import { isWebGLSupported } from './three/webglCheck';
import {
  isPerfDiagnosticsEnabled,
  loadQualityPreference,
  resolveQualityProfile,
  saveQualityPreference,
} from './three/qualityConfig';
import { FallbackCanvasWorld, FallbackWorldHandle } from './components/FallbackCanvasWorld';
import { TitleScreen } from './components/TitleScreen';
import { PlayingHUD } from './components/PlayingHUD';
import { PortfolioSectionModal } from './components/PortfolioSectionModal';
import { StandardPortfolioView } from './components/StandardPortfolioView';
import { BeaconModal } from './components/BeaconModal';
import { PauseModal } from './components/PauseModal';
import {
  ActiveModalView,
  CameraMode,
  GameState,
  PerfDiagnostics,
  PortfolioOverviewData,
  QualityPreference,
  QualityTier,
  RenderActivityMode,
  WorldBillboardNode,
  ZoneId,
} from './types/portfolio';
import {
  INITIAL_ORBS,
  LOCAL_CERTIFICATES_DATA,
  LOCAL_PROFILE_DATA,
  LOCAL_PROJECTS_DATA,
  LOCAL_SKILL_CATEGORIES,
  readConfiguredEnvContacts,
} from './data/portfolioData';
import {
  REVIEWS_PER_PAGE,
  paginateReviewsCollection,
  portfolioRepository,
} from './services/portfolioRepository';
import { buildZoneLayout } from './game/zoneLayout';
import { synthAudio } from './audio/synthAudio';

function createInitialLocalOverview(): PortfolioOverviewData {
  return {
    profile: LOCAL_PROFILE_DATA,
    projects: LOCAL_PROJECTS_DATA,
    skillCategories: LOCAL_SKILL_CATEGORIES,
    certificates: LOCAL_CERTIFICATES_DATA,
    contacts: readConfiguredEnvContacts(),
    reviewsPreview: paginateReviewsCollection([], 1, REVIEWS_PER_PAGE, 'unconfigured'),
    backendConnected: false,
    dataSourceLabel: 'Local Repository Snapshot',
  };
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

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const worldSceneRef = useRef<WorldScene | null>(null);
  const fallbackRef = useRef<FallbackWorldHandle>(null);

  const [useFallback, setUseFallback] = useState<boolean>(() => !isWebGLSupported());
  const [gameState, setGameState] = useState<GameState>('title');
  const [isQuickViewOpen, setIsQuickViewOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'standard' || params.get('quick') === '1';
  });

  // Portfolio Data State (loaded via shared PortfolioRepository)
  const [overview, setOverview] = useState<PortfolioOverviewData>(() =>
    createInitialLocalOverview()
  );
  const [isLoadingData, setIsLoadingData] = useState<boolean>(() =>
    portfolioRepository.isBackendConfigured()
  );

  // Multi-Zone & Modal State
  const [currentZone, setCurrentZone] = useState<ZoneId>('hub');
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
  const [qualityPreference, setQualityPreference] = useState<QualityPreference>(() =>
    loadQualityPreference()
  );
  const [activeQualityTier, setActiveQualityTier] = useState<QualityTier>(
    () => resolveQualityProfile(loadQualityPreference()).tier
  );
  const [lowPerfSuggested, setLowPerfSuggested] = useState<boolean>(false);
  const [lowPerfDismissed, setLowPerfDismissed] = useState<boolean>(false);
  const showPerfDiagnostics = useMemo(() => isPerfDiagnosticsEnabled(), []);
  const [perfDiagnostics, setPerfDiagnostics] = useState<PerfDiagnostics | null>(null);

  const zoneLayout = useMemo(
    () => buildZoneLayout(currentZone, overview),
    [currentZone, overview]
  );

  // Refs used by stable WorldScene callbacks
  const currentZoneRef = useRef<ZoneId>(currentZone);
  currentZoneRef.current = currentZone;
  const overviewRef = useRef<PortfolioOverviewData>(overview);
  overviewRef.current = overview;

  const isOverlayPausing3D =
    isQuickViewOpen || gameState === 'paused' || activeModal !== null;
  const isPlaying = gameState === 'playing' && !isOverlayPausing3D;

  const renderActivityMode: RenderActivityMode = isOverlayPausing3D
    ? 'paused'
    : gameState === 'title'
    ? 'throttled'
    : 'active';

  const refreshOverview = useCallback(async (forceRefresh = false, signal?: AbortSignal) => {
    setIsLoadingData(true);
    try {
      const data = await portfolioRepository.getOverview({ forceRefresh, signal });
      setOverview(data);
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        console.warn('Portfolio data refresh error:', err);
      }
    } finally {
      setIsLoadingData(false);
    }
  }, []);

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
        setActiveModal(action.modal);
        return;
      }

      if (action.type === 'external_contact') {
        const contact = action.contact;
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

  // Sync simulation & render lifecycle mode with overlays and Quick View
  useEffect(() => {
    document.body.dataset.state = isQuickViewOpen ? 'quick_view' : gameState;
    document.body.dataset.zone = currentZone;
    worldSceneRef.current?.setSimulationActive(isPlaying);
    worldSceneRef.current?.setRenderActivityMode(renderActivityMode);
  }, [gameState, currentZone, isQuickViewOpen, isPlaying, renderActivityMode]);

  // Refresh active zone billboards in-place whenever `overview` updates asynchronously from backend
  const prevOverviewRef = useRef<PortfolioOverviewData>(overview);
  useEffect(() => {
    if (prevOverviewRef.current === overview) return;
    prevOverviewRef.current = overview;
    if (worldSceneRef.current) {
      const refreshedLayout = buildZoneLayout(currentZoneRef.current, overview);
      worldSceneRef.current.applyZoneLayout(refreshedLayout, { preservePosition: true });
    }
  }, [overview]);

  // Mount single shared WebGL scene once
  useEffect(() => {
    if (!canvasMountRef.current) return;

    if (!isWebGLSupported()) {
      setUseFallback(true);
      return;
    }

    const initialPref = loadQualityPreference();
    const initialHubLayout = buildZoneLayout(currentZoneRef.current, overviewRef.current);

    try {
      const scene = new WorldScene(
        canvasMountRef.current,
        {
          onActivateNode: (node, meta) => {
            handleActivateNodeRef.current(node, meta);
          },
          onOrbCollected: (_orb, _index, totalCollected) => {
            setOrbsCollected(totalCollected);
            if (totalCollected >= INITIAL_ORBS.length) {
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
          initialQualityPreference: initialPref,
          enablePerfDiagnostics: showPerfDiagnostics,
          initialZoneLayout: initialHubLayout,
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
    synthAudio.playRobotChirp('happy');
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
    } else {
      synthAudio.playRobotChirp('happy');
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
      fallbackRef.current?.triggerRobotWave();
    } else {
      worldSceneRef.current?.triggerRobotWave();
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
    setGameState('playing');
    synthAudio.playRobotChirp('happy');
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
    <div className="relative w-screen h-screen overflow-hidden bg-[#060911] font-sans touch-none">
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
            if (totalCollected >= INITIAL_ORBS.length) {
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
          totalOrbs={INITIAL_ORBS.length}
          isBeaconActive={isBeaconActive}
        />
      )}

      {/* Brief Zone Transition Scrim */}
      {isZoneTransitioning && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-20 bg-[#060911]/70 pointer-events-none transition-opacity duration-150"
        />
      )}

      {/* Accessible Standard Portfolio View (Quick View / Skip 3D) */}
      {isQuickViewOpen && (
        <StandardPortfolioView
          overview={overview}
          isLoadingData={isLoadingData}
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
          totalOrbs={INITIAL_ORBS.length}
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
          totalOrbs={INITIAL_ORBS.length}
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
          totalOrbs={INITIAL_ORBS.length}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          qualityPreference={qualityPreference}
          activeQualityTier={activeQualityTier}
          onChangeQuality={handleChangeQuality}
        />
      )}
    </div>
  );
}
