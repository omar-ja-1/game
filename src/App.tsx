/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * STANDALONE DEMO SHELL
 * ----------------------------------------------------------------------------
 * Mounts `<PortfolioWorldExperience />` with isolated standalone demo records
 * (`src/data/standaloneDemoData.ts`) for local development and preview.
 *
 * Production integrations should import `<PortfolioWorldExperience />` from
 * `src/integration` and supply their own `PortfolioDataSource` instead of
 * copying this standalone shell.
 */

import React, { useMemo } from 'react';
import { PortfolioWorldExperience } from './integration';
import {
  DEMO_VISITOR_SIGNALS,
  createStandaloneDemoOverview,
  createStandaloneDemoRepository,
} from './data/standaloneDemoData';
import { PortfolioEntryMode } from './types/portfolio';

function resolveStandaloneEntryMode(): PortfolioEntryMode {
  if (typeof window === 'undefined') return 'title';
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'standard' || params.get('quick') === '1') {
    return 'quick-view';
  }
  if (params.get('autostart') === '1') {
    return 'world';
  }
  return 'title';
}

export default function App() {
  const demoRepository = useMemo(() => createStandaloneDemoRepository(), []);
  const initialDemoOverview = useMemo(() => createStandaloneDemoOverview(), []);
  const initialEntryMode = useMemo(() => resolveStandaloneEntryMode(), []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#060911]">
      <PortfolioWorldExperience
        dataSource={demoRepository}
        initialOverview={initialDemoOverview}
        initialEntryMode={initialEntryMode}
        initialVisitorSignals={DEMO_VISITOR_SIGNALS}
        className="w-full h-full"
      />
    </div>
  );
}
