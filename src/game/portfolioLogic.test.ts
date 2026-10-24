/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceXZ,
  isWithinProximity,
  clampToPlazaBounds,
  calculateQuestProgress,
  findNearestInteractable,
  resolveCompanionEmotion,
  type CollectibleOrb,
  type ExhibitLocation,
} from './portfolioLogic';
import {
  QUALITY_PROFILES,
  RuntimeQualityGovernor,
  computeEffectivePixelRatio,
  resolveQualityProfile,
  resolveQualityTierFromSignals,
} from '../three/qualityConfig';
import { buildZoneLayout, computeDynamicBoardPlacements } from './zoneLayout';
import {
  REVIEWS_PER_PAGE,
  createPortfolioRepository,
  normalizeValidContactLinks,
  paginateReviewsCollection,
  validateFeedbackPayload,
} from '../services/portfolioRepository';
import {
  LOCAL_CERTIFICATES_DATA,
  LOCAL_PROFILE_DATA,
  LOCAL_PROJECTS_DATA,
  LOCAL_SKILL_CATEGORIES,
} from '../data/portfolioData';
import {
  buildTestCertificates,
  buildTestContacts,
  buildTestProjects,
  buildTestReviews,
} from '../data/devFixtures';
import { PortfolioOverviewData, ZoneId } from '../types/portfolio';

test('distanceXZ calculates Euclidean distance correctly', () => {
  const p1 = { x: 0, z: 0 };
  const p2 = { x: 3, z: 4 };
  assert.equal(distanceXZ(p1, p2), 5);
});

test('isWithinProximity detects threshold boundary', () => {
  const player = { x: 10, z: 10 };
  const target = { x: 12, z: 10 };
  assert.equal(isWithinProximity(player, target, 2.5), true);
  assert.equal(isWithinProximity(player, target, 1.5), false);
});

test('clampToPlazaBounds constrains player within radius', () => {
  const inside = clampToPlazaBounds({ x: 10, z: 10 }, 40);
  assert.equal(inside.x, 10);
  assert.equal(inside.z, 10);

  const outside = clampToPlazaBounds({ x: 50, z: 0 }, 40);
  assert.equal(Math.round(outside.x), 40);
  assert.equal(outside.z, 0);

  const outsideDiag = clampToPlazaBounds({ x: 30, z: 40 }, 25);
  assert.equal(Math.round(outsideDiag.x), 15);
  assert.equal(Math.round(outsideDiag.z), 20);
});

test('calculateQuestProgress accurately tracks orb collection percentage', () => {
  const orbs: CollectibleOrb[] = [
    { id: '1', x: 0, z: 0, collected: true, title: 'Orb 1' },
    { id: '2', x: 5, z: 5, collected: true, title: 'Orb 2' },
    { id: '3', x: 10, z: 10, collected: false, title: 'Orb 3' },
    { id: '4', x: 15, z: 15, collected: false, title: 'Orb 4' },
  ];

  const progress = calculateQuestProgress(orbs);
  assert.equal(progress.total, 4);
  assert.equal(progress.collectedCount, 2);
  assert.equal(progress.percent, 50);
  assert.equal(progress.isComplete, false);

  const allDone = calculateQuestProgress(orbs.map((o) => ({ ...o, collected: true })));
  assert.equal(allDone.percent, 100);
  assert.equal(allDone.isComplete, true);
});

test('findNearestInteractable returns closest within range or null', () => {
  const exhibits: ExhibitLocation[] = [
    { id: 'about', title: 'About Exhibit', x: 0, z: -15, interactRadius: 4 },
    { id: 'ai', title: 'AI Project', x: 15, z: 0, interactRadius: 4 },
  ];

  const playerNearAi = { x: 14, z: 1 };
  const nearest = findNearestInteractable(playerNearAi, exhibits);
  assert.notEqual(nearest, null);
  assert.equal(nearest?.id, 'ai');

  const playerFar = { x: 0, z: 0 };
  const none = findNearestInteractable(playerFar, exhibits);
  assert.equal(none, null);
});

test('resolveCompanionEmotion resolves appropriate posture', () => {
  assert.equal(
    resolveCompanionEmotion({
      isMoving: false,
      isWaving: true,
      isJumping: false,
      nearExhibitId: null,
      allOrbsCollected: false,
    }),
    'waving'
  );

  assert.equal(
    resolveCompanionEmotion({
      isMoving: true,
      isWaving: false,
      isJumping: false,
      nearExhibitId: null,
      allOrbsCollected: false,
    }),
    'happy'
  );

  assert.equal(
    resolveCompanionEmotion({
      isMoving: false,
      isWaving: false,
      isJumping: false,
      nearExhibitId: 'ai',
      allOrbsCollected: false,
    }),
    'curious'
  );
});

test('resolveQualityTierFromSignals classifies mobile phones, tablets, and desktops accurately', () => {
  // Smartphone with coarse pointer -> low
  assert.equal(
    resolveQualityTierFromSignals({
      viewportWidth: 390,
      viewportHeight: 844,
      devicePixelRatio: 3,
      coarsePointer: true,
      maxTouchPoints: 5,
      hardwareConcurrency: 6,
      deviceMemory: 4,
      prefersReducedMotion: false,
    }),
    'low'
  );

  // Tablet with larger touch screen and good specs -> medium
  assert.equal(
    resolveQualityTierFromSignals({
      viewportWidth: 820,
      viewportHeight: 1180,
      devicePixelRatio: 2,
      coarsePointer: true,
      maxTouchPoints: 5,
      hardwareConcurrency: 8,
      deviceMemory: 8,
      prefersReducedMotion: false,
    }),
    'medium'
  );

  // Desktop / Laptop with fine pointer and >= 8 cores -> high
  assert.equal(
    resolveQualityTierFromSignals({
      viewportWidth: 1440,
      viewportHeight: 900,
      devicePixelRatio: 2,
      coarsePointer: false,
      maxTouchPoints: 0,
      hardwareConcurrency: 8,
      deviceMemory: 16,
      prefersReducedMotion: false,
    }),
    'high'
  );

  // Low deviceMemory even on larger display -> low
  assert.equal(
    resolveQualityTierFromSignals({
      viewportWidth: 1280,
      viewportHeight: 720,
      devicePixelRatio: 1.5,
      coarsePointer: false,
      maxTouchPoints: 0,
      hardwareConcurrency: 4,
      deviceMemory: 2,
      prefersReducedMotion: false,
    }),
    'low'
  );
});

test('QUALITY_PROFILES and computeEffectivePixelRatio enforce Low <= 1.0 DPR and ultra-weak 0.75-0.80 step-down', () => {
  assert.equal(QUALITY_PROFILES.low.maxPixelRatio, 1.0);
  assert.equal(QUALITY_PROFILES.low.shadowsEnabled, false);
  assert.equal(QUALITY_PROFILES.low.useLightweightFloor, true);
  assert.equal(QUALITY_PROFILES.low.enableScanlineOverlay, false);
  assert.equal(QUALITY_PROFILES.low.enableBillboardLights, false);
  assert.equal(QUALITY_PROFILES.low.enableOrbLights, false);

  assert.equal(QUALITY_PROFILES.medium.enableBillboardLights, true);
  assert.equal(QUALITY_PROFILES.medium.enableOrbLights, false);

  assert.equal(QUALITY_PROFILES.high.maxPixelRatio, 2.0);
  assert.equal(QUALITY_PROFILES.high.shadowsEnabled, true);
  assert.equal(QUALITY_PROFILES.high.enableBillboardLights, true);
  assert.equal(QUALITY_PROFILES.high.enableOrbLights, true);

  assert.equal(resolveQualityProfile('low').tier, 'low');
  assert.equal(resolveQualityProfile('medium').tier, 'medium');
  assert.equal(resolveQualityProfile('high').tier, 'high');

  // Standard mobile phone on Low caps DPR at 1.0 even when devicePixelRatio is 3
  const phoneDpr = computeEffectivePixelRatio(QUALITY_PROFILES.low, {
    viewportWidth: 390,
    viewportHeight: 844,
    devicePixelRatio: 3,
    coarsePointer: true,
    maxTouchPoints: 5,
    hardwareConcurrency: 6,
    deviceMemory: 4,
    prefersReducedMotion: false,
  });
  assert.equal(phoneDpr, 1.0);

  // Ultra-weak <= 2 GB RAM device steps down to 0.80 DPR
  const ultraWeakDpr = computeEffectivePixelRatio(QUALITY_PROFILES.low, {
    viewportWidth: 360,
    viewportHeight: 740,
    devicePixelRatio: 2,
    coarsePointer: true,
    maxTouchPoints: 5,
    hardwareConcurrency: 2,
    deviceMemory: 2,
    prefersReducedMotion: false,
  });
  assert.equal(ultraWeakDpr, 0.8);
});

test('RuntimeQualityGovernor rejects isolated frame spikes and downgrades conservatively under sustained load', () => {
  const governor = new RuntimeQualityGovernor('high');
  let now = 1000;

  // Single 400ms spike (tab switch / shader compile) is ignored
  assert.equal(governor.recordFrame(400, now), null);
  assert.equal(governor.getState().tier, 'high');

  // Sustained slow frames (~45ms -> ~22 FPS) across two 2.5s windows -> downgrades High -> Medium
  now = 5000;
  let outcome = null;
  for (let i = 0; i < 130; i++) {
    now += 45;
    const step = governor.recordFrame(45, now);
    if (step) outcome = step;
  }
  assert.notEqual(outcome, null);
  assert.equal(outcome?.tier, 'medium');
});

test('computeDynamicBoardPlacements generates non-overlapping layouts for 0, 1, 2, 5, 10, and 16 items', () => {
  assert.equal(computeDynamicBoardPlacements(0).placements.length, 0);
  assert.equal(computeDynamicBoardPlacements(1).placements.length, 1);

  for (const count of [2, 5, 10, 16]) {
    const { placements, recommendedBoundsRadius } = computeDynamicBoardPlacements(count);
    assert.equal(placements.length, count);
    assert.ok(recommendedBoundsRadius >= 24);

    // Every pair of generated billboards must keep >= 7.5 units clearance (width is ~5.2)
    for (let i = 0; i < placements.length; i++) {
      const a = placements[i].position;
      // Also verify clear separation from the Return-to-Home portal at [0, 0, 8.5]
      const distFromReturnPortal = distanceXZ({ x: a[0], z: a[2] }, { x: 0, z: 8.5 });
      assert.ok(
        distFromReturnPortal >= 9.0,
        `Board ${i} in count=${count} is too close to Return portal (${distFromReturnPortal})`
      );

      for (let j = i + 1; j < placements.length; j++) {
        const b = placements[j].position;
        const dist = distanceXZ({ x: a[0], z: a[2] }, { x: b[0], z: b[2] });
        assert.ok(
          dist >= 7.5,
          `Boards ${i} and ${j} overlap or crowd in count=${count} (dist=${dist})`
        );
      }
    }
  }
});

test('buildZoneLayout builds all 6 Main Hub billboards and dedicated section zones with Return-to-Home portals', () => {
  const baseOverview: PortfolioOverviewData = {
    profile: LOCAL_PROFILE_DATA,
    projects: LOCAL_PROJECTS_DATA,
    skillCategories: LOCAL_SKILL_CATEGORIES,
    certificates: LOCAL_CERTIFICATES_DATA,
    contacts: normalizeValidContactLinks(buildTestContacts()),
    reviewsPreview: paginateReviewsCollection([], 1, REVIEWS_PER_PAGE, 'unconfigured'),
    backendConnected: false,
    dataSourceLabel: 'Unit Test Snapshot',
  };

  // Main Hub has exactly the 6 required portfolio section billboards
  const hubLayout = buildZoneLayout('hub', baseOverview);
  assert.equal(hubLayout.nodes.length, 6);
  const hubTitles = hubLayout.nodes.map((n) => n.title);
  assert.deepEqual(hubTitles, [
    'About Me',
    'Projects',
    'Skills',
    'Certificates',
    'Contact & Social Links',
    'Feedback & Reviews',
  ]);

  // Every dedicated sub-zone includes a Return-to-Home portal
  const subZones: ZoneId[] = [
    'about',
    'projects',
    'skills',
    'certificates',
    'contact',
    'feedback',
  ];
  for (const zone of subZones) {
    const layout = buildZoneLayout(zone, baseOverview);
    const hasReturnPortal = layout.nodes.some(
      (n) => n.kind === 'return_home' && n.action.type === 'return_hub'
    );
    assert.equal(hasReturnPortal, true, `Zone ${zone} must contain a Return-to-Main-World board`);
  }

  // Variable project counts (2, 5, 10) generate 1 distinct board per project + 1 Return Home board
  for (const projCount of [2, 5, 10]) {
    const projLayout = buildZoneLayout('projects', {
      ...baseOverview,
      projects: buildTestProjects(projCount),
    });
    assert.equal(projLayout.nodes.length, projCount + 1);
  }

  // Variable certificate counts (0 vs 4)
  const emptyCertLayout = buildZoneLayout('certificates', baseOverview);
  assert.equal(emptyCertLayout.nodes[0].kind, 'empty_notice');

  const populatedCertLayout = buildZoneLayout('certificates', {
    ...baseOverview,
    certificates: buildTestCertificates(4),
  });
  assert.equal(populatedCertLayout.nodes.length, 4 + 1);

  // Contact links: buildTestContacts() has 2 valid links (GitHub + Email) and 1 blank invalid link
  const contactLayout = buildZoneLayout('contact', baseOverview);
  assert.equal(contactLayout.nodes.length, 2 + 1);
  assert.equal(contactLayout.nodes[0].externalHref, 'https://github.com/example-handle');
  assert.equal(contactLayout.nodes[0].externalNewTab, true);
  assert.equal(contactLayout.nodes[1].externalHref, 'mailto:hello@example.org');
  assert.equal(contactLayout.nodes[1].externalNewTab, false);

  // Verify production skills data contains zero invented proficiency percentages or years
  for (const group of LOCAL_SKILL_CATEGORIES) {
    for (const skill of group.skills) {
      assert.equal(skill.proficiencyLabel, undefined);
      assert.equal(skill.yearsOfExperience, undefined);
    }
  }
});

test('paginateReviewsCollection strictly enforces 3 reviews per page across 0, 1, 2, 3, and 9 items', () => {
  assert.equal(REVIEWS_PER_PAGE, 3);

  const empty = paginateReviewsCollection([], 1);
  assert.equal(empty.items.length, 0);
  assert.equal(empty.totalPages, 0);

  for (const count of [1, 2, 3]) {
    const singlePage = paginateReviewsCollection(buildTestReviews(count), 1);
    assert.equal(singlePage.items.length, count);
    assert.equal(singlePage.totalPages, 1);
  }

  const nineReviews = buildTestReviews(9);
  const p1 = paginateReviewsCollection(nineReviews, 1);
  const p2 = paginateReviewsCollection(nineReviews, 2);
  const p3 = paginateReviewsCollection(nineReviews, 3);
  assert.equal(p1.totalPages, 3);
  assert.equal(p1.items.length, 3);
  assert.equal(p1.items[0].id, 'test-rev-1');
  assert.equal(p2.items[0].id, 'test-rev-4');
  assert.equal(p3.items[0].id, 'test-rev-7');
});

test('validateFeedbackPayload and PortfolioRepository enforce validation and honest persistence states', async () => {
  // Rejects spam honeypot
  const spam = validateFeedbackPayload({
    displayName: 'Alex',
    comment: 'Great engineering work on this scene!',
    honeypot: 'http://spam.invalid',
  });
  assert.equal(spam.valid, false);

  // Rejects short comment
  const tooShort = validateFeedbackPayload({
    displayName: 'Alex',
    comment: 'Too short',
  });
  assert.equal(tooShort.valid, false);

  // Unconfigured repository reports backend_unconfigured honestly (persisted: false)
  const unconfiguredRepo = createPortfolioRepository({
    isConfigured: false,
    apiBaseUrl: '',
  });
  const unconfRes = await unconfiguredRepo.submitFeedback({
    displayName: 'Jordan',
    rating: 5,
    comment: 'Clean architecture and smooth mobile controls.',
  });
  assert.equal(unconfRes.ok, false);
  assert.equal(unconfRes.persisted, false);
  assert.equal(unconfRes.status, 'backend_unconfigured');

  // Configured repository confirms persistence only when server succeeds
  const savedStore = buildTestReviews(4);
  const connectedRepo = createPortfolioRepository({
    isConfigured: true,
    apiBaseUrl: 'https://api.example.org',
    fetchReviewsPage: async (page, pageSize) =>
      paginateReviewsCollection(savedStore, page, pageSize, 'remote'),
    postFeedback: async (payload) => {
      const created = {
        id: 'rev-new',
        authorName: payload.displayName,
        rating: payload.rating,
        comment: payload.comment,
      };
      savedStore.unshift(created);
      return { ok: true, review: created };
    },
  });

  const savedRes = await connectedRepo.submitFeedback({
    displayName: 'Morgan',
    rating: 5,
    comment: 'Verified end-to-end submission against remote transport.',
  });
  assert.equal(savedRes.ok, true);
  assert.equal(savedRes.persisted, true);
  assert.equal(savedRes.status, 'saved');

  const pageOne = await connectedRepo.getReviewsPage(1, 3);
  assert.equal(pageOne.items.length, 3);
  assert.equal(pageOne.totalItems, 5);
  assert.equal(pageOne.items[0].id, 'rev-new');
});
