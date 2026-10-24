/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * STANDALONE DEMO CONTENT ONLY
 * ----------------------------------------------------------------------------
 * The records in this file power the standalone development/preview shell (`src/App.tsx`).
 * None of the reusable 3D world (`src/three/`), layout (`src/game/`), presentation
 * (`src/components/`), or integration (`src/integration/`) modules import from this file.
 *
 * When integrating `<PortfolioWorldExperience />` into your production portfolio website,
 * do NOT copy this file — pass your own `PortfolioDataSource` (or `PortfolioRepository`
 * pointed at your real backend API) instead.
 */

import {
  CertificateItem,
  ExhibitData,
  PortfolioOverviewData,
  ProfileData,
  ProjectItem,
  SkillCategoryGroup,
  VisitorSignal,
} from '../types/portfolio';
import {
  PortfolioRepository,
  REVIEWS_PER_PAGE,
  createPortfolioRepository,
  paginateReviewsCollection,
  readConfiguredEnvContacts,
} from '../services/portfolioRepository';

const hologramPortraitImg = new URL(
  '../assets/images/hologram_portrait_1792852257306.jpg',
  import.meta.url
).href;
const hologramProjectAiImg = new URL(
  '../assets/images/hologram_project_ai_1792852256853.jpg',
  import.meta.url
).href;
const hologramProjectGraphicsImg = new URL(
  '../assets/images/hologram_project_graphics_1792852257795.jpg',
  import.meta.url
).href;
const hologramProjectRoboticsImg = new URL(
  '../assets/images/hologram_project_robotics_1792852258659.jpg',
  import.meta.url
).href;
const titleKeyartImg = new URL(
  '../assets/images/title_keyart_1792852256979.jpg',
  import.meta.url
).href;

export const DEMO_EXHIBITS: ExhibitData[] = [
  {
    id: 'profile',
    title: 'Aura Kaelen // Lead Systems Architect',
    category: 'Biographical Archive',
    subtitle: 'Human-Machine Spatial Computing & Ambient Telemetry',
    role: 'Principal Architect & Creative Technologist',
    year: '2024–2026',
    summary:
      'Designing calm, human-scale computing environments that bridge real-time WebGL spatial interaction, distributed machine intelligence, and tactile hardware companions.',
    fullDescription: [
      'Over the past 7 years, I have architected resilient web systems, spatial simulation engines, and tactile AI companion interfaces. My philosophy centers on calm technology: high-bandwidth communication that remains quiet, elegant, and respectful of human attention.',
      'Specializing in TypeScript, WebGL/Three.js, WebGPU, distributed consensus, and low-latency audio-visual sensory computing. Previously engineering lead on spatial telemetry platforms powering autonomous robotics and real-time planetary visualizations.',
      'When not building simulations, I experiment with analog synthesizer design, mathematical tessellations, and accessible ambient interfaces.',
    ],
    metrics: [
      { label: 'Years Architecting', value: '7+' },
      { label: 'Production Users', value: '420K' },
      { label: 'Systems Deployed', value: '18' },
      { label: 'Latency Budget', value: '<16ms' },
    ],
    techStack: [
      'TypeScript',
      'Three.js / WebGPU',
      'Rust / WASM',
      'React 19',
      'Web Audio API',
      'Distributed Systems',
    ],
    highlights: [
      'Pioneered 60fps zero-allocation canvas synchronization pipelines for browser-based robotics telemetry.',
      'Authored open-source procedural audio synthesizers running hermetically on the Web Audio API.',
      'Advocate for anti-slop digital design, purposeful negative space, and accessible spatial computing.',
    ],
    imageAsset: hologramPortraitImg,
    accentColor: '#22d3ee',
    glowColor: 0x22d3ee,
    position: [0, 0, -22],
    rotationY: 0,
    terminalType: 'profile',
  },
  {
    id: 'neurogrid',
    title: 'NeuroGrid // Distributed AI Topology',
    category: 'Artificial Intelligence & Systems',
    subtitle: 'Decentralized Real-Time Model Choreography',
    role: 'Core Engine Architect',
    year: '2025–2026',
    summary:
      'A low-latency distributed inference pipeline coordinating federated neural models across edge nodes with zero central bottleneck.',
    fullDescription: [
      'NeuroGrid addresses high-concurrency neural compute bottlenecks by decomposing inference passes into dynamic topological rings. Nodes negotiate load via peer-to-peer gossip protocols with cryptographic consensus.',
      'Achieved a 64% reduction in tail latency compared to monolithic gateway architectures, maintaining sub-12ms processing times under 50,000 concurrent streaming queries.',
      'Features a bespoke WebGL telemetry dashboard monitoring active tensor flow, node health, and gradient migration in real-time.',
    ],
    metrics: [
      { label: 'P99 Latency', value: '11.4ms' },
      { label: 'Throughput', value: '54K req/s' },
      { label: 'Bandwidth Saved', value: '64%' },
      { label: 'Edge Nodes', value: '1,280' },
    ],
    techStack: ['Rust', 'WebAssembly', 'TypeScript', 'gRPC-Web', 'WebGL', 'TensorFlow Lite'],
    highlights: [
      'Zero-allocation memory pooling in Rust WASM cores.',
      'Dynamic ring rebalancing under transient node dropouts.',
      'Interactive spatial telemetry console rendering 10,000 active packets at 60fps.',
    ],
    imageAsset: hologramProjectAiImg,
    accentColor: '#38bdf8',
    glowColor: 0x38bdf8,
    position: [-20, 0, -10],
    rotationY: Math.PI / 6,
    terminalType: 'project',
  },
  {
    id: 'quantum-canvas',
    title: 'Quantum Lattice // Generative Manifolds',
    category: 'Spatial Graphics & Physics',
    subtitle: 'Procedural Shader Studio & Raymarched Manifolds',
    role: 'Graphics Programmer & Solo Creator',
    year: '2024–2025',
    summary:
      'An exploratory WebGL laboratory generating real-time higher-dimensional geometric projections and crystalline light transport.',
    fullDescription: [
      'Quantum Lattice implements signed distance field (SDF) raymarching inside custom GLSL compute shaders to project 4D polytopes (hypercubes, 120-cells) onto three-dimensional viewport space.',
      'Integrated an ambient optical dispersion model simulating wavelength-dependent refraction, subsurface volumetric haze, and iridescent surface interference.',
      'Awarded "Site of the Day" in computational design for its tactile interaction design and zero external texture footprint.',
    ],
    metrics: [
      { label: 'Frame Rate', value: '60 FPS' },
      { label: 'Asset Bundle Size', value: '42 KB' },
      { label: 'Raymarched Steps', value: '128 max' },
      { label: 'Shader Passes', value: 'Single Pass' },
    ],
    techStack: ['Three.js', 'Custom GLSL / TSL', 'WebGPU', 'MathJS', 'Tailwind CSS'],
    highlights: [
      '100% procedural mathematics — zero downloaded images or models.',
      'Real-time chromatic dispersion with negligible GPU fill-rate penalty.',
      'Touch and mouse gyroscopic momentum damping.',
    ],
    imageAsset: hologramProjectGraphicsImg,
    accentColor: '#f59e0b',
    glowColor: 0xf59e0b,
    position: [20, 0, -10],
    rotationY: -Math.PI / 6,
    terminalType: 'project',
  },
  {
    id: 'orbit-companion',
    title: 'OrbitOS // Tactile Robotics & Companion',
    category: 'Robotics & Embodied AI',
    subtitle: 'Sensory Telemetry & Emotional Robotics OS',
    role: 'Systems & UX Lead',
    year: '2025',
    summary:
      'Embedded operating system and behavioral kinematics engine designed for friendly companion automatons.',
    fullDescription: [
      'OrbitOS replaces cold industrial robot motion curves with organic, curiosity-driven posture kinematics. It models emotional homeostasis, gaze-tracking momentum, and audio bleep synthesis directly in microcontrollers.',
      'The companion robot you are controlling right now in this museum runs a simulation of OrbitOS kinematics: note the spring-damped head turns, blinking communicative visors, and wave emotes.',
      'Built with strict safety invariants, asynchronous telemetry broadcasts, and instant hot-swappable motor controllers.',
    ],
    metrics: [
      { label: 'Cycle Jitter', value: '<200μs' },
      { label: 'Kinematic Nodes', value: '14' },
      { label: 'Power Draw', value: '4.2W idle' },
      { label: 'Reaction Time', value: '38ms' },
    ],
    techStack: [
      'Embedded C++',
      'TypeScript',
      'WebSockets',
      'Web Audio API',
      'Finite State Automata',
    ],
    highlights: [
      'Second-order spring physics for natural limb deceleration and head tilts.',
      'Procedural parametric bleep & chirp synthesis reacting to proximity.',
      'Tested with over 300 human participants with a 98% friendliness rating.',
    ],
    imageAsset: hologramProjectRoboticsImg,
    accentColor: '#06b6d4',
    glowColor: 0x06b6d4,
    position: [-16, 0, 16],
    rotationY: (5 * Math.PI) / 6,
    terminalType: 'project',
  },
  {
    id: 'beacon',
    title: 'Central Monument // Frequency Beacon & Guestbook',
    category: 'Interactive Installation',
    subtitle: 'Visitor Transmission Hub & Luminescent Core',
    role: 'Plaza Centerpiece & Community Beacon',
    year: 'Active',
    summary:
      'The central spire of the nocturnal plaza. Collecting all 5 scattered energy orbs activates the planetary antenna, allowing visitors to sign the eternal guestbook.',
    fullDescription: [
      'The Central Beacon anchors the nocturnal portfolio plaza. Surrounding the plaza are 5 floating energy orbs that power its harmonic resonance core.',
      'Once awakened by the robot companion, visitors can transmit their coordinates, leave a message, and watch the central light beam pierce the nocturnal sky.',
    ],
    metrics: [
      { label: 'Orbs Needed', value: '5 Cores' },
      { label: 'Frequency', value: '432 Hz' },
      { label: 'Status', value: 'Ready' },
      { label: 'Guest Messages', value: 'Stored' },
    ],
    techStack: [
      'Web Audio Synthesizer',
      'Three.js Particles',
      'LocalStorage Sync',
      'PointLight Arrays',
    ],
    highlights: [
      'Dynamic procedural particle funnel ascending into the night sky.',
      'Interactive visitor log saved persistently to client storage.',
      'Full harmonic synth celebration on completion.',
    ],
    imageAsset: titleKeyartImg,
    accentColor: '#f59e0b',
    glowColor: 0xf59e0b,
    position: [0, 0, 0],
    rotationY: 0,
    terminalType: 'beacon',
  },
];

export const DEMO_VISITOR_SIGNALS: VisitorSignal[] = [
  {
    id: 'sig-1',
    author: 'Elena Vance',
    organization: 'Nova Spatial Labs',
    message:
      'The companion robot kinematics and peaceful lighting are extraordinary. Beautiful museum!',
    timestamp: '2 hours ago',
    color: '#22d3ee',
  },
  {
    id: 'sig-2',
    author: 'Tarek Chen',
    organization: 'Autonomous Systems Guild',
    message:
      'NeuroGrid architecture benchmarks are remarkably clean. Inspiring work on low-latency state.',
    timestamp: '1 day ago',
    color: '#f59e0b',
  },
  {
    id: 'sig-3',
    author: 'Sora Lindqvist',
    organization: 'Quantum Graphics Collective',
    message:
      'Such a refreshing take on a personal portfolio. The calm sci-fi atmosphere feels like a sanctuary.',
    timestamp: '2 days ago',
    color: '#38bdf8',
  },
];

const profileExhibit = DEMO_EXHIBITS[0];

export const DEMO_PROFILE_DATA: ProfileData = {
  id: profileExhibit.id,
  name: 'Aura Kaelen',
  title: 'Lead Systems Architect & Principal Creative Technologist',
  subtitle: profileExhibit.subtitle,
  period: profileExhibit.year,
  shortBio: profileExhibit.summary,
  biography: profileExhibit.fullDescription,
  specializations: profileExhibit.techStack,
  highlights: profileExhibit.highlights,
  metrics: profileExhibit.metrics,
  portraitUrl: profileExhibit.imageAsset,
  accentColor: profileExhibit.accentColor,
};

/**
 * Note: Placeholder generic URLs (`https://github.com`, `https://example.com`) were removed
 * so demo project records only attach external links when real verified URLs exist.
 */
export const DEMO_PROJECTS_DATA: ProjectItem[] = DEMO_EXHIBITS.filter(
  (ex) => ex.terminalType === 'project'
).map((ex) => ({
  id: ex.id,
  title: ex.title.split('//')[0].trim(),
  category: ex.category,
  subtitle: ex.subtitle,
  role: ex.role,
  year: ex.year,
  summary: ex.summary,
  description: ex.fullDescription,
  techStack: ex.techStack,
  highlights: ex.highlights,
  metrics: ex.metrics,
  imageUrl: ex.imageAsset,
  accentColor: ex.accentColor,
  repoUrl: ex.githubUrl,
  liveUrl: ex.liveUrl,
  interactivePreset:
    ex.id === 'neurogrid' || ex.id === 'quantum-canvas' || ex.id === 'orbit-companion'
      ? ex.id
      : undefined,
}));

export const DEMO_SKILL_CATEGORIES: SkillCategoryGroup[] = [
  {
    id: 'skills-languages',
    category: 'Programming Languages & Shaders',
    summary: 'Systems, web, embedded, and GPU shading languages used across portfolio engines.',
    accentColor: '#38bdf8',
    skills: [
      {
        name: 'TypeScript',
        context: 'Spatial architecture, simulation state, and typed telemetry UI',
      },
      { name: 'Rust', context: 'Zero-allocation WASM memory cores in NeuroGrid' },
      { name: 'Embedded C++', context: 'Microcontroller behavioral kinematics in OrbitOS' },
      {
        name: 'Custom GLSL / TSL',
        context: 'Signed distance field raymarching in Quantum Lattice',
      },
    ],
  },
  {
    id: 'skills-graphics-ui',
    category: 'Frameworks & 3D Graphics',
    summary: 'Real-time spatial rendering, shader pipelines, and accessible reactive interfaces.',
    accentColor: '#a855f7',
    skills: [
      { name: 'Three.js', context: 'Real-time PBR spatial scenes, instancing, and camera rigs' },
      { name: 'WebGL', context: 'Low-overhead browser GPU rendering and telemetry consoles' },
      { name: 'WebGPU', context: 'Compute shader projection and modern graphics pipelines' },
      { name: 'React 19', context: 'Declarative HUD overlays, accessible modals, and state sync' },
      { name: 'Tailwind CSS', context: 'Responsive mobile-first layout and dark-surface styling' },
    ],
  },
  {
    id: 'skills-systems-protocols',
    category: 'Distributed Systems & Runtime',
    summary: 'High-concurrency edge networking, binary protocols, and deterministic state machines.',
    accentColor: '#22d3ee',
    skills: [
      { name: 'WebAssembly (WASM)', context: 'Browser-resident high-throughput compute modules' },
      {
        name: 'Distributed Systems',
        context: 'Peer-to-peer topological ring routing and consensus',
      },
      { name: 'gRPC-Web', context: 'Streaming binary RPC across distributed inference nodes' },
      { name: 'WebSockets', context: 'Asynchronous real-time robotics telemetry broadcasts' },
      {
        name: 'Finite State Automata',
        context: 'Deterministic companion posture and safety invariants',
      },
    ],
  },
  {
    id: 'skills-audio-ml',
    category: 'Audio, Math & Edge ML',
    summary:
      'Procedural sound synthesis, computational geometry, and lightweight neural inference.',
    accentColor: '#f59e0b',
    skills: [
      {
        name: 'Web Audio API',
        context: 'Hermetic procedural synthesizers and companion bleeps',
      },
      { name: 'MathJS', context: 'Higher-dimensional polytope projections and manifold math' },
      { name: 'TensorFlow Lite', context: 'Edge-deployed neural inference choreography' },
    ],
  },
];

export const DEMO_CERTIFICATES_DATA: CertificateItem[] = [];

export function createStandaloneDemoOverview(): PortfolioOverviewData {
  return {
    profile: DEMO_PROFILE_DATA,
    projects: DEMO_PROJECTS_DATA,
    skillCategories: DEMO_SKILL_CATEGORIES,
    certificates: DEMO_CERTIFICATES_DATA,
    contacts: readConfiguredEnvContacts(),
    reviewsPreview: paginateReviewsCollection([], 1, REVIEWS_PER_PAGE, 'unconfigured'),
    backendConnected: false,
    dataSourceLabel: 'Standalone Demo Seed (VITE_PORTFOLIO_API_URL not yet connected)',
  };
}

export function createStandaloneDemoRepository(): PortfolioRepository {
  return createPortfolioRepository(undefined, {
    fallbackOverview: createStandaloneDemoOverview(),
  });
}
