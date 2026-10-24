/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CertificateItem,
  ContactLinkItem,
  FeedbackSubmissionPayload,
  FeedbackSubmissionResult,
  PaginatedReviewsResult,
  PortfolioOverviewData,
  ProfileData,
  ProjectItem,
  ReviewItem,
  SkillCategoryGroup,
} from '../types/portfolio';
import {
  LOCAL_CERTIFICATES_DATA,
  LOCAL_PROFILE_DATA,
  LOCAL_PROJECTS_DATA,
  LOCAL_SKILL_CATEGORIES,
  readConfiguredEnvContacts,
} from '../data/portfolioData';

export const REVIEWS_PER_PAGE = 3;

export interface RemotePortfolioTransport {
  isConfigured: boolean;
  apiBaseUrl: string;
  fetchOverview?: (signal?: AbortSignal) => Promise<{
    profile?: ProfileData;
    projects?: ProjectItem[];
    skillCategories?: SkillCategoryGroup[];
    certificates?: CertificateItem[];
    contacts?: ContactLinkItem[];
    reviews?: PaginatedReviewsResult | ReviewItem[];
  }>;
  fetchReviewsPage?: (
    page: number,
    pageSize: number,
    signal?: AbortSignal
  ) => Promise<PaginatedReviewsResult | ReviewItem[]>;
  postFeedback?: (
    payload: FeedbackSubmissionPayload,
    signal?: AbortSignal
  ) => Promise<{ ok: boolean; message?: string; review?: ReviewItem }>;
}

/**
 * Sanitizes and filters contact links so missing, blank, or unsafe URLs never render boards.
 */
export function normalizeValidContactLinks(items: ContactLinkItem[] | undefined | null): ContactLinkItem[] {
  if (!Array.isArray(items)) return [];
  const valid: ContactLinkItem[] = [];

  for (const item of items) {
    if (!item || typeof item.url !== 'string' || typeof item.platform !== 'string') continue;
    const raw = item.url.trim();
    const platform = item.platform.trim();
    if (!raw || !platform) continue;

    if (item.kind === 'email' || raw.toLowerCase().startsWith('mailto:')) {
      const href = raw.toLowerCase().startsWith('mailto:') ? raw : `mailto:${raw}`;
      const emailPart = href.replace(/^mailto:/i, '').split('?')[0].trim();
      if (emailPart.includes('@') && !/\s/.test(emailPart)) {
        valid.push({
          ...item,
          platform,
          kind: 'email',
          url: href,
          handleOrLabel: item.handleOrLabel?.trim() || emailPart,
        });
      }
      continue;
    }

    if (/^https?:\/\/[^\s]+$/i.test(raw)) {
      valid.push({
        ...item,
        platform,
        url: raw,
        handleOrLabel:
          item.handleOrLabel?.trim() || raw.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''),
      });
    }
  }

  return valid;
}

/**
 * Normalizes either an array of ReviewItems or a pre-paginated backend payload into
 * a strict PaginatedReviewsResult with `pageSize = 3` items per page.
 */
export function paginateReviewsCollection(
  input: PaginatedReviewsResult | ReviewItem[] | undefined | null,
  requestedPage: number = 1,
  pageSize: number = REVIEWS_PER_PAGE,
  source: 'remote' | 'unconfigured' = 'remote'
): PaginatedReviewsResult {
  const safePageSize = Math.max(1, pageSize);

  if (input && !Array.isArray(input) && Array.isArray(input.items)) {
    const totalItems = Math.max(input.totalItems ?? input.items.length, input.items.length);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / safePageSize);
    const clampedPage = totalPages === 0 ? 1 : Math.min(Math.max(1, requestedPage), totalPages);
    const items =
      input.items.length > safePageSize
        ? input.items.slice((clampedPage - 1) * safePageSize, clampedPage * safePageSize)
        : input.items;

    return {
      items,
      page: input.page ?? clampedPage,
      pageSize: safePageSize,
      totalItems,
      totalPages,
      averageRating: input.averageRating,
      source: input.source ?? source,
    };
  }

  const list = Array.isArray(input) ? input.filter((r) => Boolean(r && r.comment?.trim())) : [];
  const totalItems = list.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / safePageSize);
  const clampedPage = totalPages === 0 ? 1 : Math.min(Math.max(1, requestedPage), totalPages);
  const start = (clampedPage - 1) * safePageSize;
  const items = totalItems === 0 ? [] : list.slice(start, start + safePageSize);

  const rated = list.filter((r) => typeof r.rating === 'number' && r.rating >= 1 && r.rating <= 5);
  const averageRating =
    rated.length > 0
      ? Number((rated.reduce((acc, r) => acc + (r.rating ?? 0), 0) / rated.length).toFixed(1))
      : undefined;

  return {
    items,
    page: clampedPage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    averageRating,
    source,
  };
}

/**
 * Validates feedback submission payload before network transmission.
 */
export function validateFeedbackPayload(
  payload: FeedbackSubmissionPayload
): { valid: true; sanitized: FeedbackSubmissionPayload } | { valid: false; error: string } {
  // Silent anti-spam honeypot check
  if (payload.honeypot && payload.honeypot.trim().length > 0) {
    return { valid: false, error: 'Automated spam submission rejected.' };
  }

  const displayName = (payload.displayName ?? '').trim();
  if (displayName.length < 2) {
    return { valid: false, error: 'Please enter your display name (at least 2 characters).' };
  }
  if (displayName.length > 80) {
    return { valid: false, error: 'Display name must be 80 characters or fewer.' };
  }

  const comment = (payload.comment ?? '').trim();
  if (comment.length < 10) {
    return { valid: false, error: 'Please write at least 10 characters of feedback.' };
  }
  if (comment.length > 1000) {
    return { valid: false, error: 'Feedback message must be 1,000 characters or fewer.' };
  }

  const contactInfo = payload.contactInfo?.trim() || undefined;
  if (contactInfo && contactInfo.length > 120) {
    return { valid: false, error: 'Contact field must be 120 characters or fewer.' };
  }

  const organization = payload.organization?.trim() || undefined;
  if (organization && organization.length > 80) {
    return { valid: false, error: 'Role or organization must be 80 characters or fewer.' };
  }

  let rating: number | undefined = undefined;
  if (payload.rating !== undefined && payload.rating !== null) {
    const r = Number(payload.rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return { valid: false, error: 'Rating must be a whole number between 1 and 5.' };
    }
    rating = r;
  }

  return {
    valid: true,
    sanitized: {
      displayName,
      contactInfo,
      organization,
      rating,
      comment,
    },
  };
}

function createDefaultHttpTransport(): RemotePortfolioTransport {
  const rawBase =
    (typeof import.meta !== 'undefined' &&
      (import.meta as unknown as { env?: Record<string, string | undefined> }).env
        ?.VITE_PORTFOLIO_API_URL) ||
    '';
  const apiBaseUrl = rawBase.trim().replace(/\/$/, '');
  const isConfigured = apiBaseUrl.length > 0;

  return {
    isConfigured,
    apiBaseUrl,
    fetchOverview: isConfigured
      ? async (signal?: AbortSignal) => {
          const res = await fetch(`${apiBaseUrl}/overview`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal,
          });
          if (!res.ok) {
            throw new Error(`Portfolio backend returned HTTP ${res.status}`);
          }
          return res.json();
        }
      : undefined,
    fetchReviewsPage: isConfigured
      ? async (page: number, pageSize: number, signal?: AbortSignal) => {
          const url = `${apiBaseUrl}/reviews?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(pageSize)}`;
          const res = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal,
          });
          if (!res.ok) {
            throw new Error(`Reviews endpoint returned HTTP ${res.status}`);
          }
          return res.json();
        }
      : undefined,
    postFeedback: isConfigured
      ? async (payload: FeedbackSubmissionPayload, signal?: AbortSignal) => {
          const res = await fetch(`${apiBaseUrl}/feedback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(payload),
            signal,
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(body?.message || `Feedback submission failed (HTTP ${res.status})`);
          }
          return {
            ok: body?.ok !== false,
            message: body?.message,
            review: body?.review,
          };
        }
      : undefined,
  };
}

export class PortfolioRepository {
  private transport: RemotePortfolioTransport;
  private overviewCache: PortfolioOverviewData | null = null;
  private inflightOverview: Promise<PortfolioOverviewData> | null = null;
  private reviewsPageCache = new Map<string, PaginatedReviewsResult>();
  private lastAcceptedSubmitAt = 0;

  constructor(transport?: RemotePortfolioTransport) {
    this.transport = transport ?? createDefaultHttpTransport();
  }

  public isBackendConfigured(): boolean {
    return this.transport.isConfigured;
  }

  public clearCache(): void {
    this.overviewCache = null;
    this.inflightOverview = null;
    this.reviewsPageCache.clear();
  }

  public async getOverview(options?: {
    forceRefresh?: boolean;
    signal?: AbortSignal;
  }): Promise<PortfolioOverviewData> {
    if (options?.forceRefresh) {
      this.clearCache();
    }
    if (this.overviewCache) {
      return this.overviewCache;
    }
    if (this.inflightOverview && !options?.signal) {
      return this.inflightOverview;
    }

    const loader = async (): Promise<PortfolioOverviewData> => {
      const envContacts = readConfiguredEnvContacts();

      if (this.transport.isConfigured && this.transport.fetchOverview) {
        try {
          const remote = await this.transport.fetchOverview(options?.signal);
          const reviewsPreview = paginateReviewsCollection(
            remote.reviews,
            1,
            REVIEWS_PER_PAGE,
            'remote'
          );
          this.reviewsPageCache.set(`1:${REVIEWS_PER_PAGE}`, reviewsPreview);

          const data: PortfolioOverviewData = {
            profile: remote.profile ?? LOCAL_PROFILE_DATA,
            projects: Array.isArray(remote.projects) ? remote.projects : LOCAL_PROJECTS_DATA,
            skillCategories: Array.isArray(remote.skillCategories)
              ? remote.skillCategories
              : LOCAL_SKILL_CATEGORIES,
            certificates: Array.isArray(remote.certificates)
              ? remote.certificates
              : LOCAL_CERTIFICATES_DATA,
            contacts: normalizeValidContactLinks(remote.contacts ?? envContacts),
            reviewsPreview,
            backendConnected: true,
            dataSourceLabel: 'Connected Portfolio API',
          };
          this.overviewCache = data;
          return data;
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') {
            throw err;
          }
          const fallbackReviews = paginateReviewsCollection([], 1, REVIEWS_PER_PAGE, 'unconfigured');
          const fallback: PortfolioOverviewData = {
            profile: LOCAL_PROFILE_DATA,
            projects: LOCAL_PROJECTS_DATA,
            skillCategories: LOCAL_SKILL_CATEGORIES,
            certificates: LOCAL_CERTIFICATES_DATA,
            contacts: envContacts,
            reviewsPreview: fallbackReviews,
            backendConnected: false,
            dataSourceLabel: 'Local Repository Fallback (Backend Unreachable)',
            loadError:
              err instanceof Error ? err.message : 'Unable to reach configured portfolio backend.',
          };
          this.overviewCache = fallback;
          return fallback;
        }
      }

      const emptyReviews = paginateReviewsCollection([], 1, REVIEWS_PER_PAGE, 'unconfigured');
      this.reviewsPageCache.set(`1:${REVIEWS_PER_PAGE}`, emptyReviews);

      const localOverview: PortfolioOverviewData = {
        profile: LOCAL_PROFILE_DATA,
        projects: LOCAL_PROJECTS_DATA,
        skillCategories: LOCAL_SKILL_CATEGORIES,
        certificates: LOCAL_CERTIFICATES_DATA,
        contacts: envContacts,
        reviewsPreview: emptyReviews,
        backendConnected: false,
        dataSourceLabel: 'Local Repository Data (VITE_PORTFOLIO_API_URL not yet connected)',
      };
      this.overviewCache = localOverview;
      return localOverview;
    };

    const promise = loader().finally(() => {
      this.inflightOverview = null;
    });

    if (!options?.signal) {
      this.inflightOverview = promise;
    }

    return promise;
  }

  public async getReviewsPage(
    page: number = 1,
    pageSize: number = REVIEWS_PER_PAGE,
    options?: { forceRefresh?: boolean; signal?: AbortSignal }
  ): Promise<PaginatedReviewsResult> {
    const safePage = Math.max(1, Math.floor(page));
    const cacheKey = `${safePage}:${pageSize}`;

    if (!options?.forceRefresh) {
      const cached = this.reviewsPageCache.get(cacheKey);
      if (cached) return cached;
    }

    if (!this.transport.isConfigured || !this.transport.fetchReviewsPage) {
      const empty = paginateReviewsCollection([], 1, pageSize, 'unconfigured');
      this.reviewsPageCache.set(cacheKey, empty);
      return empty;
    }

    const remotePayload = await this.transport.fetchReviewsPage(
      safePage,
      pageSize,
      options?.signal
    );
    const normalized = paginateReviewsCollection(remotePayload, safePage, pageSize, 'remote');
    this.reviewsPageCache.set(`${normalized.page}:${pageSize}`, normalized);
    return normalized;
  }

  public async submitFeedback(
    payload: FeedbackSubmissionPayload,
    signal?: AbortSignal
  ): Promise<FeedbackSubmissionResult> {
    const validation = validateFeedbackPayload(payload);
    if (!validation.valid) {
      return {
        ok: false,
        persisted: false,
        status: 'validation_error',
        message: validation.error,
      };
    }

    const now = Date.now();
    if (now - this.lastAcceptedSubmitAt < 8000) {
      return {
        ok: false,
        persisted: false,
        status: 'validation_error',
        message: 'Please wait a few seconds before submitting another feedback message.',
      };
    }

    if (!this.transport.isConfigured || !this.transport.postFeedback) {
      return {
        ok: false,
        persisted: false,
        status: 'backend_unconfigured',
        message:
          'Feedback persistence is not yet connected to a live backend server. Configure VITE_PORTFOLIO_API_URL (POST /feedback) to store visitor reviews permanently.',
      };
    }

    try {
      const result = await this.transport.postFeedback(validation.sanitized, signal);
      if (!result.ok) {
        return {
          ok: false,
          persisted: false,
          status: 'network_error',
          message: result.message || 'The server declined to store this feedback submission.',
        };
      }

      this.lastAcceptedSubmitAt = Date.now();
      this.reviewsPageCache.clear();
      this.overviewCache = null;

      return {
        ok: true,
        persisted: true,
        status: 'saved',
        message:
          result.message || 'Thank you — your feedback was confirmed and saved by the server.',
        createdReview: result.review,
      };
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw err;
      }
      return {
        ok: false,
        persisted: false,
        status: 'network_error',
        message:
          err instanceof Error
            ? err.message
            : 'Network error while sending feedback to the backend.',
      };
    }
  }
}

export function createPortfolioRepository(
  transport?: RemotePortfolioTransport
): PortfolioRepository {
  return new PortfolioRepository(transport);
}

export const portfolioRepository = new PortfolioRepository();
