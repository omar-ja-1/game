# Mobile Performance Optimization for Aura 3D Nocturnal Portfolio

Deliver smooth, responsive mobile exploration (targeting 30–60 FPS depending on hardware) across the nocturnal 3D portfolio museum while preserving full desktop PBR fidelity, all interactive holographic exhibits, companion robot kinematics, audio synthesis, and touch/keyboard controls.

## User Review & Critical Decisions

> [!IMPORTANT]
> All core optimization trade-offs have been aligned with your selections and preserve 100% of existing portfolio content, interactions, and desktop visual quality.

- **Confirmed Decision — Quality Selection UX**: Graphics quality auto-detects on startup (`High`, `Medium`, or `Low` based on device capabilities) and exposes a manual quality selector (`Auto`, `Low`, `Medium`, `High`) inside the Pause menu with persistent preference storage.
- **Confirmed Decision — Mobile Lighting & Glow Strategy**: Mobile / `Low` performance mode replaces per-orb and per-billboard real-time point lights with lightweight additive emissive floor glow decals and crisp emissive accents, eliminating fragment-shader multi-light bottlenecks on the reflective plaza floor while preserving the neon cyan, amber, and deep navy atmosphere.
- **Confirmed Decision — Overlay & Lifecycle Rendering**: Background 3D rendering throttles to a calm, low-power frame rate on the Title screen, pauses completely while full-screen modals (Pause, Exhibit Inspection, Beacon Guestbook) are open or when the browser tab is hidden, and resumes immediately at full responsiveness during active exploration.
- **Default Choice — Optional Developer Diagnostics**: Keep the visitor-facing HUD clean and free of intrusive telemetry, while providing a lightweight developer-only performance overlay (activated only via `?perf=1` in development/testing) reporting live FPS, active quality tier, draw calls, and triangle count.

---

## 1. Overview & Core Concept

- **What It Does**: Upgrades the existing Three.js 3D museum engine and 2.5D fallback world with adaptive rendering profiles, batched instanced geometry, multi-light shader relief, resolution-aware GPU texture scaling, zero-allocation frame updates, complete GPU memory cleanup, and smart render-loop suspension.
- **Target Audience / Persona**: Mobile visitors, recruiters, and engineering peers exploring the portfolio on smartphones and tablets with constrained tile-based GPUs, as well as desktop visitors on high-DPI displays expecting studio-grade reflections and shadows.
- **Key Value**: Eliminates mobile GPU fill-rate saturation, fragment shader light overload, redundant draw calls, and background battery drain—making touch navigation, camera orbiting, and hologram inspection feel snappy without stripping out any exhibits, animations, or visual atmosphere.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Arrival & Title Screen**: Visitors land on the nocturnal Title overlay while the 3D plaza renders gently in the background at a battery-friendly throttled cadence using an automatically selected device quality profile.
  2. **Plaza Exploration (Mobile & Desktop)**: Pressing *Enter Exhibition* unlocks full frame-rate simulation. Mobile visitors navigate via the virtual D-pad, Jump button, and touch-drag camera orbit without input conflicts; desktop visitors use `WASD`, `Space`, `E`, `Q`, `C`, and mouse orbit.
  3. **Hologram & Spire Inspection**: Approaching an exhibit or the Central Spire highlights the prompt and opens the inspection or guestbook modal, automatically pausing background 3D GPU rendering until the modal closes so scrolling and interactive lab sliders run at 60 FPS.
  4. **Manual Graphics Override**: Opening the Pause menu (`Esc` or `PAUSE`) allows visitors to switch between `Auto`, `Low`, `Medium`, and `High` quality on the fly without losing player position, collected energy cores, or guestbook state.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Calm nocturnal sci-fi museum sanctuary—preserving the existing architectural composition, companion automaton, floating holographic displays, and central resonance spire across every quality tier.
  - *Color Palette & Mood*: Retains the 60-30-10 nocturnal distribution—deep obsidian navy canvas (`#060911` / `#090d16`), dark slate structural surfaces (`#0c121d` with subtle `slate-800` hairline borders, zero `backdrop-filter` blur over the active WebGL canvas), and electric cyan (`#22d3ee`) paired with warm reactor amber (`#f59e0b`) accents.
  - *Typography & Hierarchy*: Preserves `Outfit` and `Plus Jakarta Sans` for headings and readable prose, paired with `JetBrains Mono` (`tabular-nums`) for compact HUD readouts, orb counters, and segmented Pause-menu quality controls.
  - *Component Styling & Layout*: Keeps the central 3D viewport unobstructed with perimeter HUD clusters and the collapsible bottom warp dock (`[H]`). The new quality selector integrates cleanly into the existing Pause modal as a single-line segmented control with >= 40px touch-friendly hit areas.

- **Interactive Feedback & Motion**:
  - Gameplay physics, movement speed, jump gravity, proximity checks, and exponential camera damping remain strictly delta-time (`dt`) driven and independent of rendering frame rate or quality tier.
  - When real-time shadow maps are disabled in `Low` mode, soft radial contact shadows beneath the companion robot, collectible orbs, and pedestals preserve spatial grounding so no object appears to float.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Tiered Adaptive Quality Engine (`High` / `Medium` / `Low` + `Auto`)**
  - *Chosen Approach*: Centralize all graphics parameters in a dedicated quality profile system evaluated from reliable signals (coarse pointer + viewport size, `devicePixelRatio`, `navigator.hardwareConcurrency` / `deviceMemory` where available, `prefers-reduced-motion`, and WebGL software-renderer detection) rather than brittle user-agent regexes alone.
  - *Why*: Caps mobile pixel ratio (`1.0–1.2` on `Low`, `1.35` on `Medium`, up to `2.0` on `High`), scales shadow maps (`Off` on `Low`, `512px PCF` on `Medium`, `1024px PCFSoft` on `High`), and adjusts particle/texture budgets proportionally while keeping desktop visuals untouched.
  - *Alternatives Considered*: Hardcoding a single mobile/desktop boolean—passed over because high-end tablets have very different GPU headroom than budget phones, and visitors benefit from manual control in the Pause menu.

- **Decision 2: Consolidating 11 Dynamic Point Lights on Mobile via Emissive Glow Decals**
  - *Chosen Approach*: Keep all 13 lights in `High` quality, trim the 5 orb point lights in `Medium` quality, and replace both the 5 orb point lights and 4 billboard point lights in `Low` quality with shared radial additive glow planes flush above the floor alongside vibrant emissive materials.
  - *Why*: Three.js forward PBR shaders loop over every active point light per fragment across the giant 90x90 reflective plaza floor. Cutting 9 dynamic point lights on mobile drastically reduces fragment shader ALU cost while keeping the exact colored pools of cyan and amber light on the plaza floor.
  - *Alternatives Considered*: Switching the entire plaza floor to an unlit material on mobile—passed over because retaining PBR hemisphere/directional lighting and studio `RoomEnvironment` reflections keeps the dark metallic grid looking rich and three-dimensional.

- **Decision 3: Static Geometry Instancing & Shared Asset Pools**
  - *Chosen Approach*: Convert the 40 individual perimeter pylon and tip meshes into 2 `InstancedMesh` draw calls with precomputed bounding spheres, share geometries and materials across billboards, orbs, and robot limbs, and downscale hologram GPU textures on `Low`/`Medium` tiers via an offscreen canvas cache while skipping unused keyart preloads.
  - *Why*: Cuts ~40+ redundant draw calls per frame and reduces mobile VRAM pressure by >60% without altering any visual silhouette or deleting project assets.
  - *Alternatives Considered*: Merging the entire scene into one static mesh—passed over because exhibits, orbs, and beacon rings require independent visibility, proximity highlights, and rotations.

- **Decision 4: Context-Aware Render Loop Suspension & Throttling**
  - *Chosen Approach*: Pause the WebGL and 2D fallback loops completely when `document.hidden` is true or when modal overlays (`Pause`, `Exhibit`, `Beacon`) are active (rendering a single frame on state/resize changes), and throttle the background loop to ~24 FPS while on the Title screen.
  - *Why*: Eliminates wasted GPU heat and touch-scroll jank inside rich DOM modals while keeping the Title screen atmospheric and gameplay 100% fluid.

---

## 4. Technical Architecture & Data Strategy

- **Architecture & Component Diagram**:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                     Adaptive Graphics Quality Config                      │
│  • Capability Probe (pointer, viewport, DPR, cores/memory, software GL)   │
│  • Profiles: High (Desktop) │ Medium (Tablet/Balanced) │ Low (Mobile)     │
└──────────────────────┬───────────────────────────────────┬────────────────┘
                       │                                   │
                       ▼                                   ▼
┌──────────────────────────────────────┐   ┌────────────────────────────────┐
│       React Application Shell        │   │    3D World Engine & Scene     │
│  • Lifecycle Mode Controller:        │◄─►│  • Render Modes:               │
│    - 'active' (60 FPS gameplay)      │   │    active │ throttled │ paused │
│    - 'throttled' (Title backdrop)    │   │  • Instanced Perimeter Pylons  │
│    - 'paused' (Modals / Hidden tab)  │   │  • Shared Geometry/Mat Cache   │
│  • Camera & Quality State Sync       │   │  • Tiered Texture Resizer      │
└───────┬──────────────┬───────────────┘   └───────┬────────────────┬───────┘
        │              │                           │                │
        ▼              ▼                           ▼                ▼
┌──────────────┐ ┌─────────────────────┐   ┌──────────────┐ ┌───────────────┐
│ Playing HUD  │ │ Pause & Info Modals │   │  Hologram    │ │  Companion    │
│ • Touch DPad │ │ • Quality Selector  │   │  Billboards  │ │  Robot & Orbs │
│ • Warp Dock  │ │   (Auto/Low/Med/Hi) │   │ • Glow Decal │ │ • Contact     │
│ • Dev Perf   │ │ • Lazy Async Media  │   │   vs PtLight │ │   Shadows     │
│   (?perf=1)  │ │ • Zero GPU Contend  │   │ • Culling &  │ │ • Zero-GC     │
└──────────────┘ └─────────────────────┘   │   Throttled  │ │   dt Physics  │
                                           │   Particles  │ └───────────────┘
                                           └──────────────┘
```

- **Data Model & State**:
  - **Quality Preference & Resolved Tier**: Stores user preference (`'auto' | 'low' | 'medium' | 'high'`) in `localStorage` and resolves an active `QualityConfig` record controlling `maxPixelRatio`, `antialias`, `shadowsEnabled`, `shadowMapSize`, `shadowMapType`, `enableBillboardLights`, `enableOrbLights`, `billboardParticles`, `dustParticles`, `floorTextureSize`, `maxHologramTextureSize`, and `decorativeUpdateStride`.
  - **Render Activity Mode**: Derives `'active' | 'throttled' | 'paused'` from `gameState`, open modal flags (`activeExhibit`, `isBeaconModalOpen`), and browser tab visibility (`document.hidden`).
  - **Dev Diagnostics Snapshot**: Optional lightweight struct (`fps`, `qualityTier`, `drawCalls`, `triangles`) sampled once every 500ms only when developer diagnostics (`?perf=1`) are enabled, avoiding per-frame React state updates.

- **Interactive Component & State Mapping**:
  - **Pause Modal Quality Switcher**: Clicking `Auto`, `Low`, `Medium`, or `High` updates persisted state and invokes live `applyQualityProfile()` on the active 3D scene (dynamically updating pixel ratio, shadow map state, light/glow decal visibility, and particle draw ranges without resetting player coordinates or collected orbs).
  - **Camera Mode Sync (`[C]` Key & HUD Button)**: Synchronizes keyboard `[C]` toggles back to React HUD state so the camera mode indicator always matches the active camera rig.
  - **Touch Input Isolation**: Tracks active touch identifiers on the 3D canvas separately from HUD D-pad/Jump buttons with `touch-action: none` so simultaneous movement and camera look-around never conflict or trigger page scrolling.
  - **Modal Open/Close & Visibility Recovery**: Opening any modal transitions the engine to `'paused'` after ensuring a clean background frame; closing a modal or returning to a visible browser tab resets the frame clock (`lastTime = performance.now()`) before resuming `'active'` mode so `dt` never jumps.
  - **Full Resource Disposal & WebGL Context Recovery**: Attaches `webglcontextlost` / `webglcontextrestored` handlers and traverses all geometries, materials, procedural canvas textures, resized hologram textures, and PMREM environment targets on teardown.
