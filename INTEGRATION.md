# Production Portfolio Integration Guide

This document explains how to embed the interactive 3D nocturnal portfolio world (`<PortfolioWorldExperience />`) into an existing React, Next.js, or Vite portfolio website and connect it to your real portfolio API or data layer without modifying the 3D scene engine.

---

## 1. Reusable 3D Experience Directories & Files

Copy the following directories into your host project (for example under `src/features/portfolio-world/` or `src/`):

| Path | Responsibility |
| :--- | :--- |
| `src/integration/index.ts` | Public integration barrel exporting `<PortfolioWorldExperience />`, data adapters, and TypeScript contracts. |
| `src/integration/PortfolioWorldExperience.tsx` | Scoped React integration component managing the single WebGL lifecycle, zone transitions, introductory robot greeting, Quick View toggle, and modal state. |
| `src/three/WorldScene.ts` | Vanilla Three.js scene controller, player movement, camera rig, raycasting, instanced perimeter pylons, floor quality switching, and render loop governor. |
| `src/three/CompanionRobot.ts` | Articulated procedural companion robot (`THREE.Group`), front-facing digital visor face, 4-phase greeting animation, and understated idle kinematics. |
| `src/three/HologramBillboard.ts` | Shared-geometry holographic display boards with proximity prompts and lazy image loading. |
| `src/three/proceduralAssets.ts` | Procedural floor grid generator (`FLOOR_VISUAL_CONFIG`), `RobotEyeCanvas` facial expression renderer, billboard card canvas renderer, and `SharedTexturePool`. |
| `src/three/qualityConfig.ts` | Device capability detection, `High` / `Medium` / `Low` graphics profiles, DPR caps, and conservative `RuntimeQualityGovernor`. |
| `src/three/webglCheck.ts` | Safe WebGL availability probe. |
| `src/game/zoneLayout.ts` | Deterministic Main Hub (6 section boards) and dynamic non-overlapping sub-zone board placement calculator. |
| `src/game/portfolioLogic.ts` | Pure spatial math helpers (bounds clamping, XZ distance, proximity checks). |
| `src/game/worldOrbs.ts` | Spatial coordinates for the 5 Main Plaza energy cores (`DEFAULT_WORLD_ORBS`), decoupled from personal portfolio data. |
| `src/audio/synthAudio.ts` | Zero-asset Web Audio API procedural sound synthesizer with mute control. |
| `src/components/TitleScreen.tsx` | Scoped entry overlay (`Enter 3D World` / `Quick View`). |
| `src/components/PlayingHUD.tsx` | Scoped HUD (zone status, mobile D-Pad, interaction prompt, collapsible bottom warp dock). |
| `src/components/PortfolioSectionModal.tsx` | Scoped inspection modal for About, Projects, Skills, Certificates, Contact, and paginated Reviews + Feedback form (`ReviewsAndFeedbackPanel`). |
| `src/components/StandardPortfolioView.tsx` | Accessible HTML Quick View rendering all 6 portfolio sections without WebGL. |
| `src/components/PauseModal.tsx` | Scoped pause & graphics quality (`Auto / Low / Med / High`) modal. |
| `src/components/BeaconModal.tsx` | Central Beacon Spire guestbook modal. |
| `src/components/FallbackCanvasWorld.tsx` | Lightweight 2D HTML5 Canvas fallback used automatically when WebGL is disabled or unavailable. |

> **Note:** `src/components/ExhibitModal.tsx` is a legacy standalone component retained for backward compatibility and is **not** imported by `<PortfolioWorldExperience />`. You do not need to copy it.

---

## 2. Portfolio Content & Data Contracts

All domain contracts and normalized data adapters live in two files with zero Three.js dependencies:

- **`src/types/portfolio.ts`**:
  - `PortfolioDataSource`: Replaceable async interface (`isBackendConfigured`, `getOverview`, `getReviewsPage`, `submitFeedback`).
  - `PortfolioOverviewData`: Normalized root dataset consumed by both `zoneLayout.ts` (3D billboards) and `StandardPortfolioView` / `PortfolioSectionModal` (HTML views).
  - Domain record contracts: `ProfileData`, `ProjectItem`, `SkillCategoryGroup`, `SkillItem`, `CertificateItem`, `ContactLinkItem`, `ReviewItem`, `PaginatedReviewsResult`, `FeedbackSubmissionPayload`, `FeedbackSubmissionResult`.
  - Integration types: `PortfolioEntryMode` (`'title' | 'world' | 'quick-view'`), `HostNavigationEvent`.
- **`src/services/portfolioRepository.ts`**:
  - `PortfolioRepository` & `createPortfolioRepository(transport?, options?)`: Caching, request deduplication, contact link URL/mailto sanitization (`normalizeValidContactLinks`), 3-per-page review pagination (`paginateReviewsCollection`), and feedback payload validation (`validateFeedbackPayload`).
  - `createDefaultHttpTransport(apiBaseUrlOverride?)`: Built-in REST transport for `GET /overview`, `GET /reviews?page=&limit=`, and `POST /feedback`.
  - `createStaticPortfolioDataSource(overview, options?)`: Wraps data already fetched by your host website (e.g., Next.js Server Components, GraphQL, or React Query) into a `PortfolioDataSource`.
  - `createEmptyPortfolioOverview()`: Honest empty initial state containing zero fabricated records.

Each 3D billboard stores an explicit typed `BillboardAction` referencing stable record IDs (`projectId`, `categoryId`, `certificateId`, `contact.id`), never array indices or display titles.

---

## 3. Standalone Demo Files (Do Not Copy to Production)

The following files exist strictly to run and test this standalone preview repository:

| Standalone File | Purpose & What Production Replaces |
| :--- | :--- |
| `src/App.tsx` | Standalone full-viewport shell that injects demo data and parses `?quick=1` / `?autostart=1` preview query flags. |
| `src/main.tsx` & `index.html` | Standalone Vite SPA entry point. |
| `src/data/standaloneDemoData.ts` | Placeholder persona (`Aura Kaelen`), sample project case studies, sample skill groups, and sample beacon guestbook signals. **Contains unverified placeholder copy — replace completely with your production API or CMS data.** |
| `src/data/portfolioData.ts` | Backward-compatible re-export barrel for standalone demo records. |
| `src/data/devFixtures.ts` | Synthetic fixtures used only by `src/game/portfolioLogic.test.ts` to test variable record counts (0–16 boards, pagination). |
| `src/assets/images/*` | Demo artwork referenced only by `standaloneDemoData.ts`. Production records supply their own `portraitUrl` and `imageUrl` strings (with automatic CSS fallback via `SafePortfolioImage` if any image URL is omitted or fails to load). |

---

## 4. Required Dependencies

The reusable 3D experience requires only **React** and **Three.js** at runtime, plus **Tailwind CSS** utility classes for the HTML overlays:

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "three": "^0.186.1"
  },
  "devDependencies": {
    "@types/three": "^0.186.0"
  }
}
```

- Compatible with React 18+ or React 19 and Three.js `r160+` (`^0.186.1` tested).
- Other packages present in the standalone `package.json` (`@google/genai`, `express`, `dotenv`, `lucide-react`, `motion`) are **not** imported anywhere in the reusable 3D experience and are not required when integrating.
- Recommended fonts in your host stylesheet or `<head>` (optional; falls back cleanly to system sans/mono): `Plus Jakarta Sans` / `Outfit` (`font-sans`) and `JetBrains Mono` (`font-mono`).

---

## 5. Environment Variables (Client-Safe vs Server-Side)

All browser-consumed variables use public client prefixes and must **only** hold public URLs or addresses:

| Variable | Scope | Required? | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_PORTFOLIO_API_URL` | Client-safe (public) | Optional | Base URL for `createDefaultHttpTransport()` (e.g., `/api/portfolio` or `https://yourdomain.com/api/portfolio`). Leave unset if injecting a custom `dataSource`. |
| `VITE_PORTFOLIO_GITHUB_URL` | Client-safe (public) | Optional | Fallback public GitHub URL if backend `contacts[]` is not used. |
| `VITE_PORTFOLIO_LINKEDIN_URL` | Client-safe (public) | Optional | Fallback public LinkedIn URL. |
| `VITE_PORTFOLIO_WEBSITE_URL` | Client-safe (public) | Optional | Fallback public website URL. |
| `VITE_PORTFOLIO_FACEBOOK_URL` | Client-safe (public) | Optional | Fallback public Facebook URL. |
| `VITE_PORTFOLIO_EMAIL` | Client-safe (public) | Optional | Fallback public contact email (`mailto:` generated automatically). |

- **Next.js / non-Vite hosts:** Pass your framework's public env var directly to `createDefaultHttpTransport(process.env.NEXT_PUBLIC_PORTFOLIO_API_URL)` or pass `envRecord` in `createPortfolioRepository(transport, { envRecord: { VITE_PORTFOLIO_GITHUB_URL: process.env.NEXT_PUBLIC_GITHUB_URL } })`.
- **Security rule:** Never expose database connection strings, admin tokens, SMTP credentials, or private API keys in `VITE_*` or `NEXT_PUBLIC_*` variables. Keep all write credentials and moderation secrets inside your production backend API routes.

---

## 6. Mounting Into an Existing React or Next.js Route

`<PortfolioWorldExperience />` positions all canvases, HUD controls, Quick View, and modals with `absolute inset-0` inside a `relative overflow-hidden` wrapper. Give its parent container an explicit height (`h-screen`, `h-[calc(100dvh-64px)]`, or `h-[760px]`).

### Vite / React Router Page Example

```tsx
import { useMemo } from 'react';
import {
  PortfolioWorldExperience,
  createDefaultHttpTransport,
  createPortfolioRepository,
} from '@/features/portfolio-world/integration';

export function InteractiveWorldRoute() {
  const dataSource = useMemo(
    () => createPortfolioRepository(createDefaultHttpTransport('/api/portfolio')),
    []
  );

  return (
    <section className="w-full h-[calc(100dvh-4rem)]">
      <PortfolioWorldExperience
        dataSource={dataSource}
        initialEntryMode="title"
        worldTitle="YOUR NAME · 3D PORTFOLIO"
      />
    </section>
  );
}
```

### Next.js App Router Example (Client-Only Dynamic Import)

Because Three.js accesses WebGL and browser APIs on mount, load the component with `ssr: false` inside a Client Component wrapper or route:

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import {
  createStaticPortfolioDataSource,
  type PortfolioOverviewData,
} from '@/features/portfolio-world/integration';

const PortfolioWorldExperience = dynamic(
  () =>
    import('@/features/portfolio-world/integration').then(
      (mod) => mod.PortfolioWorldExperience
    ),
  { ssr: false }
);

export function EmbeddedPortfolioWorld({
  serverOverview,
}: {
  serverOverview: PortfolioOverviewData;
}) {
  const dataSource = useMemo(
    () =>
      createStaticPortfolioDataSource(serverOverview, {
        onSubmitFeedback: async (payload, signal) => {
          const res = await fetch('/api/portfolio/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal,
          });
          const data = await res.json();
          return {
            ok: res.ok && data.ok !== false,
            persisted: res.ok && data.ok !== false,
            status: res.ok ? 'saved' : 'network_error',
            message: data.message ?? (res.ok ? 'Feedback saved.' : 'Submission failed.'),
            createdReview: data.review,
          };
        },
      }),
    [serverOverview]
  );

  return (
    <div className="w-full h-[calc(100dvh-64px)]">
      <PortfolioWorldExperience
        dataSource={dataSource}
        initialOverview={serverOverview}
        initialEntryMode="world"
      />
    </div>
  );
}
```

---

## 7. Connecting Your Real Portfolio Data or API

You never need to edit `WorldScene.ts`, `HologramBillboard.ts`, or `CompanionRobot.ts` to connect your backend. Choose whichever adapter matches your existing site architecture:

### Option A — Custom `PortfolioDataSource` Adapter (Recommended for Existing APIs)

Map your existing REST, GraphQL, tRPC, or CMS endpoints to `PortfolioDataSource`:

```ts
import {
  paginateReviewsCollection,
  normalizeValidContactLinks,
  validateFeedbackPayload,
  REVIEWS_PER_PAGE,
  type PortfolioDataSource,
} from '@/features/portfolio-world/integration';

export const mySitePortfolioDataSource: PortfolioDataSource = {
  isBackendConfigured: () => true,

  async getOverview({ signal } = {}) {
    const raw = await fetch('/api/me/portfolio', { signal }).then((r) => r.json());
    return {
      profile: raw.profile,
      projects: raw.projects ?? [],
      skillCategories: raw.skillCategories ?? [],
      certificates: raw.certificates ?? [],
      contacts: normalizeValidContactLinks(raw.contacts),
      reviewsPreview: paginateReviewsCollection(raw.reviews ?? [], 1, REVIEWS_PER_PAGE, 'remote'),
      backendConnected: true,
      dataSourceLabel: 'Production API',
    };
  },

  async getReviewsPage(page = 1, pageSize = REVIEWS_PER_PAGE, { signal } = {}) {
    const raw = await fetch(`/api/me/reviews?page=${page}&limit=${pageSize}`, { signal }).then(
      (r) => r.json()
    );
    return paginateReviewsCollection(raw, page, pageSize, 'remote');
  },

  async submitFeedback(payload, signal) {
    const check = validateFeedbackPayload(payload);
    if (!check.valid) {
      return { ok: false, persisted: false, status: 'validation_error', message: check.error };
    }
    const res = await fetch('/api/me/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(check.sanitized),
      signal,
    });
    if (!res.ok) {
      return {
        ok: false,
        persisted: false,
        status: 'network_error',
        message: 'Could not save feedback right now.',
      };
    }
    const body = await res.json();
    return {
      ok: true,
      persisted: true,
      status: 'saved',
      message: 'Thank you — your feedback has been saved.',
      createdReview: body.review,
    };
  },
};
```

### Option B — Built-in REST Convention (`PortfolioRepository`)

If you expose three JSON endpoints under a base URL (passed to `createDefaultHttpTransport(baseUrl)` or `VITE_PORTFOLIO_API_URL`):

- `GET {baseUrl}/overview` → `{ profile, projects, skillCategories, certificates, contacts, reviews }`
- `GET {baseUrl}/reviews?page=1&limit=3` → `ReviewItem[]` or `{ items, page, pageSize, totalItems, totalPages, averageRating }`
- `POST {baseUrl}/feedback` → accepts `FeedbackSubmissionPayload`, returns `{ ok: true, message?: string, review?: ReviewItem }`

---

## 8. Preserving Host Routing, Styles, and WebGL Lifecycle

- **No Global CSS Pollution:** `src/index.css` contains only `@import "tailwindcss";`. There are no global `body`, `html`, or `*` overrides in the reusable components.
- **Scoped Overlays:** Every overlay (`TitleScreen`, `PlayingHUD`, `PortfolioSectionModal`, `StandardPortfolioView`, `PauseModal`, `BeaconModal`) uses `absolute inset-0` inside `<PortfolioWorldExperience />`, keeping your host site's navigation bar, footer, and route transitions unobstructed.
- **Zero `document.body` Mutation:** State attributes (`data-portfolio-state`, `data-portfolio-zone`) live on `<PortfolioWorldExperience />`'s own root `div`.
- **Delegating Navigation to Host Routes (`onHostNavigate`):** If your production website already has dedicated routes (for example `/projects/[slug]` or `/contact`), pass `onHostNavigate`:
  ```tsx
  <PortfolioWorldExperience
    dataSource={dataSource}
    onHostNavigate={(event) => {
      if (event.type === 'project') {
        router.push(`/projects/${event.projectId}`);
        return true; // Skip internal modal; host router handled it
      }
      return false; // Keep built-in 3D zone / modal behavior for other events
    }}
  />
  ```
- **Deterministic WebGL Cleanup:** Mounting creates exactly one `THREE.WebGLRenderer`. Unmounting cancels `requestAnimationFrame` and throttled timers, disconnects `ResizeObserver` and DOM listeners, and disposes all geometries, materials, procedural `CanvasTexture` instances, `PMREM` environment maps, shadow maps, and the renderer.

---

## 9. Independent vs Adaptable Components

| Module / Component | Keep Independent (As-Is) or Adapt? | Notes |
| :--- | :--- | :--- |
| `src/three/*`, `src/game/*`, `src/audio/*` | **Keep independent** | Pure engine, spatial layout, quality governor, and procedural audio. Zero hardcoded portfolio copy. |
| `src/types/portfolio.ts` & `src/services/portfolioRepository.ts` | **Keep contracts; adapt transport** | Implement `PortfolioDataSource` or configure `createDefaultHttpTransport` for your backend. |
| `PortfolioWorldExperience.tsx` | **Primary integration boundary** | Mount directly and configure via props (`dataSource`, `initialEntryMode`, `onHostNavigate`). |
| `TitleScreen.tsx`, `PlayingHUD.tsx`, `PauseModal.tsx` | **Keep or lightly theme** | Customize `worldTitle` / `worldTagline` via props, or adjust Tailwind accent classes if desired. |
| `PortfolioSectionModal.tsx` & `StandardPortfolioView.tsx` | **Keep or bypass selectively** | Use out-of-the-box for in-world reading, or return `true` from `onHostNavigate` / link to your host site's existing HTML pages if you already have a standard portfolio layout. |

---

## 10. Pre-Deployment Verification Checklist

Before deploying the integrated experience to production:

1. **TypeScript & Build:** Run `npm run lint` (`tsc --noEmit`) and `npm run build` in the host repository to confirm clean types and asset bundling.
2. **Automated Logic & Robot Tests:** Run `node --import tsx --test src/game/portfolioLogic.test.ts` to verify zone placement spacing, review pagination, feedback validation, floor palette config, and robot kinematics.
3. **Real Data & Empty States:** Verify all 6 Main Hub billboards (`About Me`, `Projects`, `Skills`, `Certificates`, `Contact & Social Links`, `Feedback & Reviews`) reflect live API records, and confirm categories with `0` records (e.g., `certificates: []`) display honest empty states without broken links.
4. **Graphics Quality Switching:** Open `Pause [Esc]` and switch between `High`, `Medium`, `Low`, and `Auto` at runtime — confirm the nocturnal dark-navy floor grid and the companion robot's face remain clearly legible in every mode.
5. **Route Unmount / Remount:** Navigate from your host site's home page → 3D World route → another route → back to 3D World route in DevTools, confirming only one `<canvas>` exists and WebGL memory cleans up without errors.
6. **Mobile Hardware & Quick View:** Test touch D-Pad movement, camera drag, billboard tap inspection, robot greeting animation, and `Quick View` switching on an actual iOS Safari and mid/low-tier Android Chrome device.
