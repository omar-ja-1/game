/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public Integration Entry Point
 * ----------------------------------------------------------------------------
 * Import `<PortfolioWorldExperience />`, data adapters, and portfolio domain
 * contracts from this module when embedding the 3D portfolio world into an
 * existing React / Next.js / Vite website.
 */

export {
  PortfolioWorldExperience,
  type PortfolioWorldExperienceProps,
} from './PortfolioWorldExperience';

export {
  PortfolioRepository,
  REVIEWS_PER_PAGE,
  createDefaultHttpTransport,
  createEmptyPortfolioOverview,
  createPortfolioRepository,
  createStaticPortfolioDataSource,
  normalizeValidContactLinks,
  paginateReviewsCollection,
  portfolioRepository,
  readConfiguredEnvContacts,
  validateFeedbackPayload,
  type PortfolioRepositoryOptions,
  type RemotePortfolioTransport,
} from '../services/portfolioRepository';

export type {
  ActiveModalView,
  BillboardAction,
  CameraMode,
  CareerMilestone,
  CertificateItem,
  CollectibleOrbData,
  CompanionEmotion,
  ContactLinkItem,
  FacialExpressionState,
  FeedbackSubmissionPayload,
  FeedbackSubmissionResult,
  GameState,
  HostNavigationEvent,
  MetricItem,
  PaginatedReviewsResult,
  PerfDiagnostics,
  PortfolioDataSource,
  PortfolioEntryMode,
  PortfolioOverviewData,
  ProfileData,
  ProjectItem,
  QualityPreference,
  QualityTier,
  ReviewItem,
  SkillCategoryGroup,
  SkillItem,
  VisitorSignal,
  WorldBillboardKind,
  WorldBillboardNode,
  ZoneId,
} from '../types/portfolio';
