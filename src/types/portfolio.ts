/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MetricItem {
  label: string;
  value: string;
}

export interface ExhibitData {
  id: string;
  title: string;
  category: string;
  subtitle: string;
  role: string;
  year: string;
  summary: string;
  fullDescription: string[];
  metrics: MetricItem[];
  techStack: string[];
  highlights: string[];
  imageAsset: string;
  accentColor: string;
  glowColor: number;
  position: [number, number, number];
  rotationY: number;
  terminalType: 'profile' | 'project' | 'interactive' | 'beacon';
  githubUrl?: string;
  liveUrl?: string;
}

export interface CollectibleOrbData {
  id: string;
  title: string;
  clue: string;
  position: [number, number, number];
  accentColor: string;
  collected: boolean;
}

export interface VisitorSignal {
  id: string;
  author: string;
  organization: string;
  message: string;
  timestamp: string;
  color: string;
}

export type GameState = 'title' | 'playing' | 'paused' | 'inspecting' | 'beacon_activated';
export type CameraMode = 'follow' | 'orbit' | 'firstperson';
export type CompanionEmotion = 'idle' | 'happy' | 'waving' | 'curious' | 'excited';

export type QualityPreference = 'auto' | 'low' | 'medium' | 'high';
export type QualityTier = 'low' | 'medium' | 'high';
export type RenderActivityMode = 'active' | 'throttled' | 'paused';

export interface PerfDiagnostics {
  fps: number;
  avgFrameMs?: number;
  tier: QualityTier;
  dpr: number;
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
}

// ============================================================================
// Multi-Zone & Data-Driven Portfolio Domain Types
// ============================================================================

export type ZoneId =
  | 'hub'
  | 'about'
  | 'projects'
  | 'skills'
  | 'certificates'
  | 'contact'
  | 'feedback';

export interface CareerMilestone {
  title: string;
  organization?: string;
  period?: string;
  summary?: string;
}

export interface ContactLinkItem {
  id: string;
  platform: string;
  kind: 'social' | 'email' | 'website' | 'other';
  url: string;
  handleOrLabel?: string;
  description?: string;
  accentColor?: string;
}

export interface ProfileData {
  id: string;
  name: string;
  title: string;
  subtitle?: string;
  period?: string;
  shortBio: string;
  biography: string[];
  specializations: string[];
  highlights: string[];
  metrics?: MetricItem[];
  careerOrEducation?: CareerMilestone[];
  links?: ContactLinkItem[];
  portraitUrl?: string;
  accentColor?: string;
}

export interface ProjectItem {
  id: string;
  title: string;
  category: string;
  subtitle?: string;
  role?: string;
  year?: string;
  summary: string;
  description: string[];
  techStack: string[];
  highlights?: string[];
  metrics?: MetricItem[];
  imageUrl?: string;
  accentColor?: string;
  repoUrl?: string;
  liveUrl?: string;
  interactivePreset?: 'neurogrid' | 'quantum-canvas' | 'orbit-companion';
}

export interface SkillItem {
  name: string;
  context?: string;
  proficiencyLabel?: string;
  yearsOfExperience?: number;
}

export interface SkillCategoryGroup {
  id: string;
  category: string;
  summary: string;
  accentColor?: string;
  skills: SkillItem[];
}

export interface CertificateItem {
  id: string;
  name: string;
  issuer: string;
  issueDate?: string;
  expirationDate?: string;
  credentialId?: string;
  verificationUrl?: string;
  imageUrl?: string;
  summary?: string;
  accentColor?: string;
}

export interface ReviewItem {
  id: string;
  authorName: string;
  authorRoleOrOrg?: string;
  rating?: number;
  comment: string;
  createdAt?: string;
}

export interface PaginatedReviewsResult {
  items: ReviewItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  averageRating?: number;
  source: 'remote' | 'unconfigured';
}

export interface FeedbackSubmissionPayload {
  displayName: string;
  contactInfo?: string;
  organization?: string;
  rating?: number;
  comment: string;
  honeypot?: string;
}

export interface FeedbackSubmissionResult {
  ok: boolean;
  persisted: boolean;
  status: 'saved' | 'backend_unconfigured' | 'validation_error' | 'network_error';
  message: string;
  createdReview?: ReviewItem;
}

export interface PortfolioOverviewData {
  profile: ProfileData;
  projects: ProjectItem[];
  skillCategories: SkillCategoryGroup[];
  certificates: CertificateItem[];
  contacts: ContactLinkItem[];
  reviewsPreview: PaginatedReviewsResult;
  backendConnected: boolean;
  dataSourceLabel: string;
  loadError?: string;
}

export type WorldBillboardKind =
  | 'hub_section'
  | 'project'
  | 'skill_category'
  | 'certificate'
  | 'contact'
  | 'feedback_terminal'
  | 'return_home'
  | 'empty_notice'
  | 'beacon';

export type ActiveModalView =
  | { type: 'about' }
  | { type: 'project'; projectId: string }
  | { type: 'skill_category'; categoryId: string }
  | { type: 'certificate'; certificateId: string }
  | { type: 'contact'; contactId?: string }
  | { type: 'feedback' }
  | { type: 'beacon' };

export type BillboardAction =
  | { type: 'enter_zone'; zone: ZoneId; openModal?: ActiveModalView }
  | { type: 'return_hub' }
  | { type: 'open_modal'; modal: ActiveModalView }
  | { type: 'external_contact'; contact: ContactLinkItem };

export interface WorldBillboardNode {
  id: string;
  zone: ZoneId;
  kind: WorldBillboardKind;
  kicker: string;
  title: string;
  subtitle: string;
  summaryLines: string[];
  footerMeta: string;
  promptLabel: string;
  accentColor: string;
  glowColor: number;
  position: [number, number, number];
  rotationY: number;
  isPortrait?: boolean;
  imageUrl?: string;
  externalHref?: string;
  externalNewTab?: boolean;
  action: BillboardAction;
}
