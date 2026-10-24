# Aura · 3D Nocturnal Portfolio World

An interactive nocturnal 3D portfolio experience built with React 19, TypeScript, Tailwind CSS, and vanilla Three.js. Visitors explore six data-driven portfolio sectors alongside an articulated robotic companion, or switch at any time to an accessible HTML **Quick View**.

## Key Capabilities

- **Adaptive Graphics Quality (`Auto`, `Low`, `Medium`, `High`):** Calibrated nocturnal dark-navy/charcoal floor grid across both PBR (`MeshStandardMaterial`) and mobile-lightweight (`MeshLambertMaterial`) profiles, capped pixel ratios, instanced perimeter geometry, shared billboard resources, and render-loop pausing behind overlays.
- **Expressive Companion Automaton:** Connected multi-part hierarchy (`CompanionRobot.ts`) with dark charcoal and navy armor, cyan/purple emissive accents, front-facing digital visor face (symmetrical eyes, blinking eyelids, and distinct neutral/curious/smiling mouths), coordinated 4-phase greeting wave, and understated idle motion.
- **Six Data-Driven Portfolio Zones:** Main Plaza Hub plus dedicated zones for *About Me*, *Projects*, *Skills*, *Certificates*, *Contact & Social Links*, and *Feedback & Reviews* (3 reviews per page + validated feedback submission).
- **Production Integration Ready:** Clean separation between the reusable 3D experience (`src/integration/`, `src/three/`, `src/game/`, `src/components/`, `src/services/`) and standalone demo seed data (`src/data/standaloneDemoData.ts`). See **[INTEGRATION.md](./INTEGRATION.md)** for step-by-step embedding and API connection instructions.

## Run Locally

**Prerequisites:** Node.js 20+

1. Install dependencies:
   ```bash
   npm install
   ```
2. *(Optional)* Copy `.env.example` to `.env.local` and configure `VITE_PORTFOLIO_API_URL` or public `VITE_PORTFOLIO_*` contact URLs. When left empty, the standalone shell runs with isolated local demo data and reports backend persistence status honestly.
3. Start the development server (port `3000`):
   ```bash
   npm run dev
   ```

## Verification Scripts

- **Type-check:** `npm run lint`
- **Automated unit tests:** `npm test`
- **Production build:** `npm run build`
