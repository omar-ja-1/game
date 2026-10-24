/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CollectibleOrbData } from '../types/portfolio';

/**
 * Spatial coordinates for the 5 Main Plaza energy cores used to awaken the Central Beacon Spire.
 * Kept in the game layer so 3D world mechanics remain decoupled from portfolio owner content.
 */
export const DEFAULT_WORLD_ORBS: CollectibleOrbData[] = [
  {
    id: 'orb-north',
    title: 'Neural Core Alpha',
    clue: 'Drifting near the northern biographical sector.',
    position: [0, 1.2, -14],
    accentColor: '#22d3ee',
    collected: false,
  },
  {
    id: 'orb-west',
    title: 'Synapse Core Beta',
    clue: 'Hovering alongside the western promenade.',
    position: [-13, 1.2, -7],
    accentColor: '#38bdf8',
    collected: false,
  },
  {
    id: 'orb-east',
    title: 'Prism Core Gamma',
    clue: 'Gleaming near the eastern plaza quadrant.',
    position: [13, 1.2, -7],
    accentColor: '#f59e0b',
    collected: false,
  },
  {
    id: 'orb-southwest',
    title: 'Kinetics Core Delta',
    clue: 'Stationed beside the southwestern pavilion.',
    position: [-10, 1.2, 10],
    accentColor: '#06b6d4',
    collected: false,
  },
  {
    id: 'orb-southeast',
    title: 'Resonance Core Epsilon',
    clue: 'Floating above the southeastern promenade.',
    position: [12, 1.2, 12],
    accentColor: '#a855f7',
    collected: false,
  },
];
