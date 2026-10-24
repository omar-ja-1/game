/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PortfolioOverviewData,
  WorldBillboardNode,
  ZoneId,
} from '../types/portfolio';

export interface ZoneEnvironmentTheme {
  id: ZoneId;
  title: string;
  subtitle: string;
  accentHex: string;
  accentColorNum: number;
  secondaryHex: string;
  fogHex: number;
  fogDensity: number;
  defaultBoundsRadius: number;
  spawnPosition: [number, number, number];
}

export interface DynamicPlacement {
  position: [number, number, number];
  rotationY: number;
  tierIndex: number;
}

export interface ZoneLayoutResult {
  zone: ZoneId;
  theme: ZoneEnvironmentTheme;
  boundsRadius: number;
  spawnPosition: [number, number, number];
  nodes: WorldBillboardNode[];
}

export const ZONE_THEMES: Record<ZoneId, ZoneEnvironmentTheme> = {
  hub: {
    id: 'hub',
    title: 'Main World Plaza',
    subtitle: 'Central Navigation Hub · Six Portfolio Sectors',
    accentHex: '#22d3ee',
    accentColorNum: 0x22d3ee,
    secondaryHex: '#f59e0b',
    fogHex: 0x060911,
    fogDensity: 0.022,
    defaultBoundsRadius: 36,
    spawnPosition: [0, 0, 6.5],
  },
  about: {
    id: 'about',
    title: 'About Me Sanctuary',
    subtitle: 'Biographical Profile & Core Specializations',
    accentHex: '#38bdf8',
    accentColorNum: 0x38bdf8,
    secondaryHex: '#818cf8',
    fogHex: 0x060a14,
    fogDensity: 0.025,
    defaultBoundsRadius: 24,
    spawnPosition: [0, 0, 3.5],
  },
  projects: {
    id: 'projects',
    title: 'Projects Pavilion',
    subtitle: 'Interactive Systems & Engineering Case Studies',
    accentHex: '#06b6d4',
    accentColorNum: 0x06b6d4,
    secondaryHex: '#2dd4bf',
    fogHex: 0x050a12,
    fogDensity: 0.019,
    defaultBoundsRadius: 28,
    spawnPosition: [0, 0, 3.5],
  },
  skills: {
    id: 'skills',
    title: 'Skills Matrix',
    subtitle: 'Organized Technical Categories & Stack Context',
    accentHex: '#a855f7',
    accentColorNum: 0xa855f7,
    secondaryHex: '#22d3ee',
    fogHex: 0x080714,
    fogDensity: 0.023,
    defaultBoundsRadius: 26,
    spawnPosition: [0, 0, 3.5],
  },
  certificates: {
    id: 'certificates',
    title: 'Certificates Vault',
    subtitle: 'Verified Credentials & Issuing Authorities',
    accentHex: '#f59e0b',
    accentColorNum: 0xf59e0b,
    secondaryHex: '#22d3ee',
    fogHex: 0x090910,
    fogDensity: 0.023,
    defaultBoundsRadius: 26,
    spawnPosition: [0, 0, 3.5],
  },
  contact: {
    id: 'contact',
    title: 'Contact & Social Relay',
    subtitle: 'Direct External Channels & Electronic Mail',
    accentHex: '#14b8a6',
    accentColorNum: 0x14b8a6,
    secondaryHex: '#38bdf8',
    fogHex: 0x050b11,
    fogDensity: 0.024,
    defaultBoundsRadius: 26,
    spawnPosition: [0, 0, 3.5],
  },
  feedback: {
    id: 'feedback',
    title: 'Feedback & Reviews Chamber',
    subtitle: 'Published Visitor Reviews & Submission Terminal',
    accentHex: '#c084fc',
    accentColorNum: 0xc084fc,
    secondaryHex: '#f59e0b',
    fogHex: 0x080713,
    fogDensity: 0.024,
    defaultBoundsRadius: 24,
    spawnPosition: [0, 0, 3.5],
  },
};

function parseHexToInt(hex: string, fallback: number = 0x22d3ee): number {
  const cleaned = hex.trim().replace(/^#/, '');
  const parsed = Number.parseInt(cleaned, 16);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function truncateLine(text: string, maxLen: number = 66): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}

/**
 * Deterministic layout generator supporting 0, 1, 2, 5, 10, 20+ items without overlap.
 * Guarantees >= 9.0 units of center-to-center spacing between every generated board
 * and clear separation from the Return-to-Home billboard at [0, 0, 8.5].
 */
export function computeDynamicBoardPlacements(
  count: number,
  focalPoint: [number, number] = [0, 3.5]
): { placements: DynamicPlacement[]; recommendedBoundsRadius: number } {
  if (count <= 0) {
    return { placements: [], recommendedBoundsRadius: 24 };
  }

  const [focusX, focusZ] = focalPoint;
  const arcOriginZ = 1.5;

  if (count === 1) {
    return {
      placements: [
        {
          position: [0, 0, -10.5],
          rotationY: 0,
          tierIndex: 0,
        },
      ],
      recommendedBoundsRadius: 24,
    };
  }

  if (count <= 6) {
    const configs: Record<number, { span: number; radius: number }> = {
      2: { span: Math.PI * 0.42, radius: 12.5 },
      3: { span: Math.PI * 0.62, radius: 13.5 },
      4: { span: Math.PI * 0.76, radius: 15.0 },
      5: { span: Math.PI * 0.84, radius: 17.5 },
      6: { span: Math.PI * 0.88, radius: 20.0 },
    };
    const { span, radius } = configs[count];
    const placements: DynamicPlacement[] = [];

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const theta = -span / 2 + t * span;
      const x = Number((Math.sin(theta) * radius).toFixed(3));
      const z = Number((arcOriginZ - Math.cos(theta) * radius).toFixed(3));
      const rotationY = Math.atan2(focusX - x, focusZ - z);
      placements.push({
        position: [x, 0, z],
        rotationY,
        tierIndex: 0,
      });
    }

    return {
      placements,
      recommendedBoundsRadius: Math.max(26, Math.ceil(radius + 6.5)),
    };
  }

  // Multi-row concentric semicircular gallery avenues for 7+ items
  const placements: DynamicPlacement[] = [];
  let remaining = count;
  let tierIndex = 0;
  let maxRadiusUsed = 16.5;

  while (remaining > 0) {
    const tierCapacity = 5 + tierIndex * 2;
    const itemsInTier = Math.min(remaining, tierCapacity);
    const radius = 16.5 + tierIndex * 10.5;
    maxRadiusUsed = radius;

    const maxSpan = Math.PI * 0.86;
    const stepAngle = tierCapacity > 1 ? maxSpan / (tierCapacity - 1) : 0;
    const actualSpan = itemsInTier > 1 ? stepAngle * (itemsInTier - 1) : 0;

    for (let i = 0; i < itemsInTier; i++) {
      const theta = itemsInTier === 1 ? 0 : -actualSpan / 2 + i * stepAngle;
      const x = Number((Math.sin(theta) * radius).toFixed(3));
      const z = Number((arcOriginZ - Math.cos(theta) * radius).toFixed(3));
      const rotationY = Math.atan2(focusX - x, focusZ - z);
      placements.push({
        position: [x, 0, z],
        rotationY,
        tierIndex,
      });
    }

    remaining -= itemsInTier;
    tierIndex += 1;
  }

  return {
    placements,
    recommendedBoundsRadius: Math.min(76, Math.max(28, Math.ceil(maxRadiusUsed + 6.5))),
  };
}

function createReturnHomeNode(zone: ZoneId): WorldBillboardNode {
  return {
    id: `${zone}-return-home`,
    zone,
    kind: 'return_home',
    kicker: 'Navigation Portal',
    title: 'Return to Main World',
    subtitle: 'Central Portfolio Hub',
    summaryLines: [
      'Step back into the Main Nocturnal Plaza.',
      'Access all six portfolio sectors and the Central Spire.',
    ],
    footerMeta: 'Instant Hub Restore · Press E or Tap Return',
    promptLabel: 'RETURN TO MAIN WORLD',
    accentColor: '#f59e0b',
    glowColor: 0xf59e0b,
    position: [0, 0, 8.5],
    rotationY: Math.PI, // Faces North (-Z) toward the visitor at [0, 0, 3.5]
    action: { type: 'return_hub' },
  };
}

/**
 * Generates the complete typed WorldBillboardNode list and bounds for any zone
 * directly from the shared PortfolioOverviewData snapshot.
 */
export function buildZoneLayout(
  zone: ZoneId,
  data: PortfolioOverviewData
): ZoneLayoutResult {
  const theme = ZONE_THEMES[zone];

  if (zone === 'hub') {
    const totalSkills = data.skillCategories.reduce((sum, c) => sum + c.skills.length, 0);
    const radius = 21;

    // 6 balanced hexagonal main-world section billboards around (0, 0, 0)
    const hubAnglesDeg = [
      0, // 1. About Me (North)
      -60, // 2. Projects (North-West)
      60, // 3. Skills (North-East)
      -120, // 4. Certificates (South-West)
      120, // 5. Contact & Social (South-East)
      180, // 6. Feedback & Reviews (South)
    ];

    const posForAngle = (deg: number): { pos: [number, number, number]; rotY: number } => {
      const rad = (deg * Math.PI) / 180;
      const x = Number((Math.sin(rad) * radius).toFixed(3));
      const z = Number((-Math.cos(rad) * radius).toFixed(3));
      const rotY = Math.atan2(-x, -z);
      return { pos: [x, 0, z], rotY };
    };

    const a0 = posForAngle(hubAnglesDeg[0]);
    const a1 = posForAngle(hubAnglesDeg[1]);
    const a2 = posForAngle(hubAnglesDeg[2]);
    const a3 = posForAngle(hubAnglesDeg[3]);
    const a4 = posForAngle(hubAnglesDeg[4]);
    const a5 = posForAngle(hubAnglesDeg[5]);

    const projectPreviewNames = data.projects.slice(0, 3).map((p) => p.title);
    const skillCatNames = data.skillCategories.slice(0, 3).map((c) => c.category);
    const certNames = data.certificates.slice(0, 2).map((c) => `${c.name} (${c.issuer})`);
    const contactNames = data.contacts.map((c) => c.platform);
    const firstReview = data.reviewsPreview.items[0];

    const nodes: WorldBillboardNode[] = [
      {
        id: 'hub-about',
        zone: 'hub',
        kind: 'hub_section',
        kicker: '01 · Biographical Profile',
        title: 'About Me',
        subtitle: `${data.profile.name} · ${data.profile.title.split('&')[0].trim()}`,
        summaryLines: [
          truncateLine(data.profile.shortBio, 68),
          data.profile.specializations.slice(0, 4).join(' · '),
        ].filter(Boolean),
        footerMeta: `${data.profile.period || 'Active'} · View Full Profile & Zone`,
        promptLabel: 'OPEN ABOUT ME',
        accentColor: '#38bdf8',
        glowColor: 0x38bdf8,
        position: a0.pos,
        rotationY: a0.rotY,
        isPortrait: true,
        imageUrl: data.profile.portraitUrl,
        action: { type: 'enter_zone', zone: 'about', openModal: { type: 'about' } },
      },
      {
        id: 'hub-projects',
        zone: 'hub',
        kind: 'hub_section',
        kicker: '02 · Engineering Showcase',
        title: 'Projects',
        subtitle:
          data.projects.length > 0
            ? `${data.projects.length} Real ${data.projects.length === 1 ? 'Project' : 'Projects'} Available`
            : '0 Projects Loaded',
        summaryLines:
          projectPreviewNames.length > 0
            ? [
                `Featured: ${projectPreviewNames.join(' · ')}`,
                'Enter pavilion to inspect each system, stack, and live links.',
              ]
            : ['No published projects loaded yet from the data source.'],
        footerMeta: `${data.projects.length} Total · Enter Projects Zone`,
        promptLabel: 'ENTER PROJECTS ZONE',
        accentColor: '#06b6d4',
        glowColor: 0x06b6d4,
        position: a1.pos,
        rotationY: a1.rotY,
        imageUrl: data.projects[0]?.imageUrl,
        action: { type: 'enter_zone', zone: 'projects' },
      },
      {
        id: 'hub-skills',
        zone: 'hub',
        kind: 'hub_section',
        kicker: '03 · Capabilities Matrix',
        title: 'Skills',
        subtitle: `${totalSkills} Technologies · ${data.skillCategories.length} Categories`,
        summaryLines:
          skillCatNames.length > 0
            ? [
                skillCatNames.join(' · '),
                'Organized by architectural domain and production usage.',
              ]
            : ['No skill categories loaded yet from the data source.'],
        footerMeta: `${data.skillCategories.length} Domains · Enter Skills Zone`,
        promptLabel: 'ENTER SKILLS ZONE',
        accentColor: '#a855f7',
        glowColor: 0xa855f7,
        position: a2.pos,
        rotationY: a2.rotY,
        action: { type: 'enter_zone', zone: 'skills' },
      },
      {
        id: 'hub-certificates',
        zone: 'hub',
        kind: 'hub_section',
        kicker: '04 · Verified Credentials',
        title: 'Certificates',
        subtitle:
          data.certificates.length > 0
            ? `${data.certificates.length} ${data.certificates.length === 1 ? 'Certificate' : 'Certificates'} Available`
            : '0 Certificates Loaded',
        summaryLines:
          certNames.length > 0
            ? [
                certNames.join(' · '),
                'Inspect issuer details, dates, and verification links.',
              ]
            : [
                'No certificate records loaded yet.',
                'Connect backend endpoint to populate verified credentials.',
              ],
        footerMeta: `${data.certificates.length} Records · Enter Certificates Zone`,
        promptLabel: 'ENTER CERTIFICATES ZONE',
        accentColor: '#f59e0b',
        glowColor: 0xf59e0b,
        position: a3.pos,
        rotationY: a3.rotY,
        action: { type: 'enter_zone', zone: 'certificates' },
      },
      {
        id: 'hub-contact',
        zone: 'hub',
        kind: 'hub_section',
        kicker: '05 · Direct Channels',
        title: 'Contact & Social Links',
        subtitle:
          contactNames.length > 0
            ? `${contactNames.length} Verified ${contactNames.length === 1 ? 'Platform' : 'Platforms'}`
            : 'No Public Links Configured Yet',
        summaryLines:
          contactNames.length > 0
            ? [
                `Available: ${contactNames.join(' · ')}`,
                'Enter relay to open verified external accounts or email.',
              ]
            : [
                'No social or email URLs configured in current environment.',
                'Enter relay for backend & env connection details.',
              ],
        footerMeta: `${contactNames.length} Active · Enter Contact Zone`,
        promptLabel: 'ENTER CONTACT ZONE',
        accentColor: '#14b8a6',
        glowColor: 0x14b8a6,
        position: a4.pos,
        rotationY: a4.rotY,
        action: { type: 'enter_zone', zone: 'contact' },
      },
      {
        id: 'hub-feedback',
        zone: 'hub',
        kind: 'hub_section',
        kicker: '06 · Visitor Perspectives',
        title: 'Feedback & Reviews',
        subtitle:
          data.reviewsPreview.totalItems > 0
            ? `${data.reviewsPreview.totalItems} Published ${data.reviewsPreview.totalItems === 1 ? 'Review' : 'Reviews'}`
            : '0 Published Reviews · Leave Feedback',
        summaryLines: firstReview
          ? [
              `"${truncateLine(firstReview.comment, 58)}" — ${firstReview.authorName}`,
              'Browse 3 reviews per page or submit your own feedback.',
            ]
          : [
              'No published visitor reviews loaded yet.',
              'Enter chamber to inspect review feed or submit feedback.',
            ],
        footerMeta: `${data.reviewsPreview.totalItems} Reviews · Enter Feedback Zone`,
        promptLabel: 'ENTER FEEDBACK ZONE',
        accentColor: '#c084fc',
        glowColor: 0xc084fc,
        position: a5.pos,
        rotationY: a5.rotY,
        action: { type: 'enter_zone', zone: 'feedback', openModal: { type: 'feedback' } },
      },
    ];

    return {
      zone: 'hub',
      theme,
      boundsRadius: theme.defaultBoundsRadius,
      spawnPosition: theme.spawnPosition,
      nodes,
    };
  }

  // ==========================================================================
  // Section 1: About Me Zone
  // ==========================================================================
  if (zone === 'about') {
    const itemsCount = data.profile.specializations.length > 0 ? 2 : 1;
    const { placements, recommendedBoundsRadius } = computeDynamicBoardPlacements(itemsCount);
    const nodes: WorldBillboardNode[] = [
      {
        id: 'about-profile-board',
        zone: 'about',
        kind: 'hub_section',
        kicker: 'Biographical Archive',
        title: data.profile.name,
        subtitle: data.profile.title,
        summaryLines: [
          truncateLine(data.profile.shortBio, 68),
          truncateLine(data.profile.biography[0] || '', 68),
        ].filter(Boolean),
        footerMeta: `${data.profile.period || 'Profile'} · Open Full Readable Profile`,
        promptLabel: 'READ FULL PROFILE',
        accentColor: '#38bdf8',
        glowColor: 0x38bdf8,
        position: placements[0].position,
        rotationY: placements[0].rotationY,
        isPortrait: true,
        imageUrl: data.profile.portraitUrl,
        action: { type: 'open_modal', modal: { type: 'about' } },
      },
    ];

    if (placements[1]) {
      nodes.push({
        id: 'about-focus-board',
        zone: 'about',
        kind: 'hub_section',
        kicker: 'Technical Specializations',
        title: 'Core Focus & Highlights',
        subtitle: data.profile.subtitle || 'Systems & Spatial Computing',
        summaryLines: [
          data.profile.specializations.join(' · '),
          truncateLine(data.profile.highlights[0] || '', 68),
        ].filter(Boolean),
        footerMeta: `${data.profile.specializations.length} Focus Areas · Inspect`,
        promptLabel: 'READ PROFILE DETAILS',
        accentColor: '#818cf8',
        glowColor: 0x818cf8,
        position: placements[1].position,
        rotationY: placements[1].rotationY,
        action: { type: 'open_modal', modal: { type: 'about' } },
      });
    }

    nodes.push(createReturnHomeNode('about'));
    return {
      zone: 'about',
      theme,
      boundsRadius: recommendedBoundsRadius,
      spawnPosition: theme.spawnPosition,
      nodes,
    };
  }

  // ==========================================================================
  // Section 2: Projects Zone
  // ==========================================================================
  if (zone === 'projects') {
    if (data.projects.length === 0) {
      return {
        zone: 'projects',
        theme,
        boundsRadius: 24,
        spawnPosition: theme.spawnPosition,
        nodes: [
          {
            id: 'projects-empty',
            zone: 'projects',
            kind: 'empty_notice',
            kicker: 'Projects Pavilion',
            title: 'No Projects Published Yet',
            subtitle: 'Awaiting Backend Project Records',
            summaryLines: [
              'Connect VITE_PORTFOLIO_API_URL to populate live projects.',
              'Each project automatically receives its own interactive board.',
            ],
            footerMeta: '0 Records Loaded',
            promptLabel: 'RETURN TO MAIN WORLD',
            accentColor: theme.accentHex,
            glowColor: theme.accentColorNum,
            position: [0, 0, -10.5],
            rotationY: 0,
            action: { type: 'return_hub' },
          },
          createReturnHomeNode('projects'),
        ],
      };
    }

    const { placements, recommendedBoundsRadius } = computeDynamicBoardPlacements(
      data.projects.length
    );
    const nodes: WorldBillboardNode[] = data.projects.map((proj, index) => {
      const placement = placements[index];
      const accent = proj.accentColor || theme.accentHex;
      return {
        id: `project-board-${proj.id}`,
        zone: 'projects',
        kind: 'project',
        kicker: `Project ${String(index + 1).padStart(2, '0')} · ${proj.category}`,
        title: proj.title,
        subtitle: proj.subtitle || proj.role || 'Engineering Case Study',
        summaryLines: [
          truncateLine(proj.summary, 68),
          proj.techStack.slice(0, 4).join(' · '),
        ].filter(Boolean),
        footerMeta: [proj.year, proj.repoUrl ? 'Source Link' : '', proj.liveUrl ? 'Live Demo' : '']
          .filter(Boolean)
          .join(' · '),
        promptLabel: `INSPECT ${proj.title.toUpperCase()}`,
        accentColor: accent,
        glowColor: parseHexToInt(accent, theme.accentColorNum),
        position: placement.position,
        rotationY: placement.rotationY,
        imageUrl: proj.imageUrl,
        action: { type: 'open_modal', modal: { type: 'project', projectId: proj.id } },
      };
    });

    nodes.push(createReturnHomeNode('projects'));
    return {
      zone: 'projects',
      theme,
      boundsRadius: recommendedBoundsRadius,
      spawnPosition: theme.spawnPosition,
      nodes,
    };
  }

  // ==========================================================================
  // Section 3: Skills Zone
  // ==========================================================================
  if (zone === 'skills') {
    if (data.skillCategories.length === 0) {
      return {
        zone: 'skills',
        theme,
        boundsRadius: 24,
        spawnPosition: theme.spawnPosition,
        nodes: [
          {
            id: 'skills-empty',
            zone: 'skills',
            kind: 'empty_notice',
            kicker: 'Skills Matrix',
            title: 'No Skill Categories Loaded',
            subtitle: 'Awaiting Backend Skill Groups',
            summaryLines: ['Connect VITE_PORTFOLIO_API_URL to load categorized skills.'],
            footerMeta: '0 Categories Loaded',
            promptLabel: 'RETURN TO MAIN WORLD',
            accentColor: theme.accentHex,
            glowColor: theme.accentColorNum,
            position: [0, 0, -10.5],
            rotationY: 0,
            action: { type: 'return_hub' },
          },
          createReturnHomeNode('skills'),
        ],
      };
    }

    const { placements, recommendedBoundsRadius } = computeDynamicBoardPlacements(
      data.skillCategories.length
    );
    const nodes: WorldBillboardNode[] = data.skillCategories.map((cat, idx) => {
      const placement = placements[idx];
      const accent = cat.accentColor || theme.accentHex;
      return {
        id: `skill-cat-board-${cat.id}`,
        zone: 'skills',
        kind: 'skill_category',
        kicker: `Domain ${String(idx + 1).padStart(2, '0')}`,
        title: cat.category,
        subtitle: `${cat.skills.length} ${cat.skills.length === 1 ? 'Technology' : 'Technologies'}`,
        summaryLines: [
          cat.skills.map((s) => s.name).slice(0, 5).join(' · '),
          truncateLine(cat.summary, 66),
        ].filter(Boolean),
        footerMeta: `${cat.skills.length} Items · Open Category Breakdown`,
        promptLabel: `INSPECT ${cat.category.toUpperCase()}`,
        accentColor: accent,
        glowColor: parseHexToInt(accent, theme.accentColorNum),
        position: placement.position,
        rotationY: placement.rotationY,
        action: { type: 'open_modal', modal: { type: 'skill_category', categoryId: cat.id } },
      };
    });

    nodes.push(createReturnHomeNode('skills'));
    return {
      zone: 'skills',
      theme,
      boundsRadius: recommendedBoundsRadius,
      spawnPosition: theme.spawnPosition,
      nodes,
    };
  }

  // ==========================================================================
  // Section 4: Certificates Zone
  // ==========================================================================
  if (zone === 'certificates') {
    if (data.certificates.length === 0) {
      return {
        zone: 'certificates',
        theme,
        boundsRadius: 24,
        spawnPosition: theme.spawnPosition,
        nodes: [
          {
            id: 'certificates-empty',
            zone: 'certificates',
            kind: 'empty_notice',
            kicker: 'Certificates Vault',
            title: 'No Certificates Loaded Yet',
            subtitle: 'Verified Credential Feed Unconfigured',
            summaryLines: [
              'No certificate records are present in the active data source.',
              'Open this terminal for backend integration details.',
            ],
            footerMeta: '0 Credentials · Honest Empty State',
            promptLabel: 'VIEW CREDENTIAL STATUS',
            accentColor: theme.accentHex,
            glowColor: theme.accentColorNum,
            position: [0, 0, -10.5],
            rotationY: 0,
            action: {
              type: 'open_modal',
              modal: { type: 'certificate', certificateId: '__empty__' },
            },
          },
          createReturnHomeNode('certificates'),
        ],
      };
    }

    const { placements, recommendedBoundsRadius } = computeDynamicBoardPlacements(
      data.certificates.length
    );
    const nodes: WorldBillboardNode[] = data.certificates.map((cert, idx) => {
      const placement = placements[idx];
      const accent = cert.accentColor || theme.accentHex;
      return {
        id: `certificate-board-${cert.id}`,
        zone: 'certificates',
        kind: 'certificate',
        kicker: `Credential ${String(idx + 1).padStart(2, '0')}`,
        title: cert.name,
        subtitle: cert.issuer,
        summaryLines: [
          [cert.issueDate ? `Issued ${cert.issueDate}` : '', cert.credentialId ? `ID ${cert.credentialId}` : '']
            .filter(Boolean)
            .join(' · ') || 'Official Certification Record',
          cert.summary ? truncateLine(cert.summary, 66) : 'Open board to inspect full credential details.',
        ],
        footerMeta: cert.verificationUrl ? 'Verification Link Available · Inspect' : 'Inspect Credential',
        promptLabel: `INSPECT ${cert.name.toUpperCase()}`,
        accentColor: accent,
        glowColor: parseHexToInt(accent, theme.accentColorNum),
        position: placement.position,
        rotationY: placement.rotationY,
        imageUrl: cert.imageUrl,
        action: { type: 'open_modal', modal: { type: 'certificate', certificateId: cert.id } },
      };
    });

    nodes.push(createReturnHomeNode('certificates'));
    return {
      zone: 'certificates',
      theme,
      boundsRadius: recommendedBoundsRadius,
      spawnPosition: theme.spawnPosition,
      nodes,
    };
  }

  // ==========================================================================
  // Section 5: Contact & Social Links Zone
  // ==========================================================================
  if (zone === 'contact') {
    if (data.contacts.length === 0) {
      return {
        zone: 'contact',
        theme,
        boundsRadius: 24,
        spawnPosition: theme.spawnPosition,
        nodes: [
          {
            id: 'contact-empty',
            zone: 'contact',
            kind: 'empty_notice',
            kicker: 'Contact & Social Relay',
            title: 'No Public Links Configured Yet',
            subtitle: 'Zero Fabricated Accounts Policy',
            summaryLines: [
              'Set VITE_PORTFOLIO_GITHUB_URL, LINKEDIN_URL, EMAIL, or API.',
              'Each verified URL automatically generates an action board here.',
            ],
            footerMeta: '0 Active Channels · Inspect Configuration Guide',
            promptLabel: 'VIEW CONTACT SETUP',
            accentColor: theme.accentHex,
            glowColor: theme.accentColorNum,
            position: [0, 0, -10.5],
            rotationY: 0,
            action: { type: 'open_modal', modal: { type: 'contact' } },
          },
          createReturnHomeNode('contact'),
        ],
      };
    }

    const { placements, recommendedBoundsRadius } = computeDynamicBoardPlacements(
      data.contacts.length
    );
    const nodes: WorldBillboardNode[] = data.contacts.map((contact, idx) => {
      const placement = placements[idx];
      const accent = contact.accentColor || theme.accentHex;
      const isEmail = contact.kind === 'email' || contact.url.toLowerCase().startsWith('mailto:');
      const actionVerb = isEmail
        ? `SEND EMAIL (${contact.platform.toUpperCase()})`
        : `OPEN ${contact.platform.toUpperCase()} IN NEW TAB`;

      return {
        id: `contact-board-${contact.id}`,
        zone: 'contact',
        kind: 'contact',
        kicker: isEmail ? 'Direct Electronic Mail' : 'Verified External Destination',
        title: contact.platform,
        subtitle: contact.handleOrLabel || contact.url,
        summaryLines: [
          contact.description ||
            (isEmail
              ? 'Launches your default mail client via mailto: link.'
              : `Opens ${contact.platform} safely in a new browser tab.`),
          isEmail ? 'Action: Compose Email' : 'Action: External Navigation (New Tab)',
        ],
        footerMeta: isEmail ? 'mailto: Protocol · Explicit Activation' : 'External URL · New Tab',
        promptLabel: actionVerb,
        accentColor: accent,
        glowColor: parseHexToInt(accent, theme.accentColorNum),
        position: placement.position,
        rotationY: placement.rotationY,
        externalHref: contact.url,
        externalNewTab: !isEmail,
        action: { type: 'external_contact', contact },
      };
    });

    nodes.push(createReturnHomeNode('contact'));
    return {
      zone: 'contact',
      theme,
      boundsRadius: recommendedBoundsRadius,
      spawnPosition: theme.spawnPosition,
      nodes,
    };
  }

  // ==========================================================================
  // Section 6: Feedback & Reviews Zone (Kept intentionally lightweight: 1 primary terminal + Return Home)
  // ==========================================================================
  const reviewCount = data.reviewsPreview.totalItems;
  const firstRev = data.reviewsPreview.items[0];
  return {
    zone: 'feedback',
    theme,
    boundsRadius: 24,
    spawnPosition: theme.spawnPosition,
    nodes: [
      {
        id: 'feedback-primary-terminal',
        zone: 'feedback',
        kind: 'feedback_terminal',
        kicker: 'Visitor Reviews & Feedback',
        title: 'Reviews & Feedback Terminal',
        subtitle:
          reviewCount > 0
            ? `${reviewCount} Published ${reviewCount === 1 ? 'Review' : 'Reviews'} · 3 Per Page`
            : '0 Published Reviews · Submit Feedback',
        summaryLines: firstRev
          ? [
              `"${truncateLine(firstRev.comment, 60)}" — ${firstRev.authorName}`,
              'Open terminal to browse 3 reviews per page or submit feedback.',
            ]
          : [
              'No published reviews loaded from backend yet.',
              'Open terminal to inspect review status or submit feedback.',
            ],
        footerMeta: 'Paginated HTML Interface (3/Page) · Press E or Tap Open',
        promptLabel: 'OPEN REVIEWS & FEEDBACK',
        accentColor: theme.accentHex,
        glowColor: theme.accentColorNum,
        position: [0, 0, -10.5],
        rotationY: 0,
        action: { type: 'open_modal', modal: { type: 'feedback' } },
      },
      createReturnHomeNode('feedback'),
    ],
  };
}
