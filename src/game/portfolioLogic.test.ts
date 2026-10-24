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
  // Distance is 50, clamped to 25 -> x: 15, z: 20
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

  // Player near 'ai'
  const playerNearAi = { x: 14, z: 1 };
  const nearest = findNearestInteractable(playerNearAi, exhibits);
  assert.notEqual(nearest, null);
  assert.equal(nearest?.id, 'ai');

  // Player in empty center zone
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
