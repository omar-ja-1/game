/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Compatibility barrel re-exporting standalone demo data (`standaloneDemoData.ts`),
 * world collectible orbs (`../game/worldOrbs`), and env contact parsing (`../services/portfolioRepository`).
 */

export { DEFAULT_WORLD_ORBS as INITIAL_ORBS } from '../game/worldOrbs';
export { readConfiguredEnvContacts } from '../services/portfolioRepository';
export {
  DEMO_EXHIBITS as EXHIBITS,
  DEMO_VISITOR_SIGNALS as INITIAL_VISITOR_SIGNALS,
  DEMO_PROFILE_DATA as LOCAL_PROFILE_DATA,
  DEMO_PROJECTS_DATA as LOCAL_PROJECTS_DATA,
  DEMO_SKILL_CATEGORIES as LOCAL_SKILL_CATEGORIES,
  DEMO_CERTIFICATES_DATA as LOCAL_CERTIFICATES_DATA,
  createStandaloneDemoOverview,
  createStandaloneDemoRepository,
} from './standaloneDemoData';
