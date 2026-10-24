/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Vector2D {
  x: number;
  z: number;
}

export interface CollectibleOrb {
  id: string;
  x: number;
  z: number;
  collected: boolean;
  title: string;
}

export interface ExhibitLocation {
  id: string;
  title: string;
  x: number;
  z: number;
  interactRadius: number;
}

/**
 * Calculates Euclidean distance between two points on the X-Z ground plane.
 */
export function distanceXZ(a: Vector2D, b: Vector2D): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Checks if a player is within interaction proximity of a target.
 */
export function isWithinProximity(player: Vector2D, target: Vector2D, radius: number): boolean {
  return distanceXZ(player, target) <= radius;
}

/**
 * Clamps player coordinates within the circular plaza radius.
 */
export function clampToPlazaBounds(pos: Vector2D, maxRadius: number): Vector2D {
  const currentDist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
  if (currentDist <= maxRadius || currentDist === 0) {
    return { x: pos.x, z: pos.z };
  }
  const ratio = maxRadius / currentDist;
  return {
    x: pos.x * ratio,
    z: pos.z * ratio,
  };
}

/**
 * Calculates quest completion percentage and status.
 */
export function calculateQuestProgress(orbs: CollectibleOrb[]): {
  total: number;
  collectedCount: number;
  percent: number;
  isComplete: boolean;
} {
  const total = orbs.length;
  if (total === 0) {
    return { total: 0, collectedCount: 0, percent: 100, isComplete: true };
  }
  const collectedCount = orbs.filter((o) => o.collected).length;
  const percent = Math.round((collectedCount / total) * 100);
  return {
    total,
    collectedCount,
    percent,
    isComplete: collectedCount === total,
  };
}

/**
 * Determines the closest interactable exhibit or orb.
 */
export function findNearestInteractable(
  player: Vector2D,
  exhibits: ExhibitLocation[],
  interactionThreshold: number = 3.5
): ExhibitLocation | null {
  let nearest: ExhibitLocation | null = null;
  let minDistance = Infinity;

  for (const exhibit of exhibits) {
    const dist = distanceXZ(player, exhibit);
    const effectiveRadius = exhibit.interactRadius || interactionThreshold;
    if (dist <= effectiveRadius && dist < minDistance) {
      minDistance = dist;
      nearest = exhibit;
    }
  }

  return nearest;
}

/**
 * Determines companion robot's emotional state based on player activity.
 */
export function resolveCompanionEmotion(params: {
  isMoving: boolean;
  isWaving: boolean;
  isJumping: boolean;
  nearExhibitId: string | null;
  allOrbsCollected: boolean;
}): 'curious' | 'happy' | 'waving' | 'excited' | 'idle' {
  if (params.isWaving) return 'waving';
  if (params.allOrbsCollected) return 'excited';
  if (params.isJumping) return 'happy';
  if (params.nearExhibitId) return 'curious';
  if (params.isMoving) return 'happy';
  return 'idle';
}
