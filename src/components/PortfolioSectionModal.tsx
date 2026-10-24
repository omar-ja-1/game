/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActiveModalView,
  CertificateItem,
  ContactLinkItem,
  FeedbackSubmissionResult,
  PaginatedReviewsResult,
  PortfolioDataSource,
  PortfolioOverviewData,
  ProjectItem,
  SkillCategoryGroup,
  ZoneId,
} from '../types/portfolio';
import { REVIEWS_PER_PAGE, portfolioRepository } from '../services/portfolioRepository';
import { synthAudio } from '../audio/synthAudio';

interface SafePortfolioImageProps {
  src?: string;
  alt: string;
  fallbackKicker: string;
  fallbackTitle: string;
  className?: string;
}

export const SafePortfolioImage: React.FC<SafePortfolioImageProps> = ({
  src,
  alt,
  fallbackKicker,
  fallbackTitle,
  className = 'w-full h-full object-cover',
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#0b1528] to-[#060911]">
        <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">
          {fallbackKicker}
        </span>
        <span className="text-sm font-semibold text-slate-200 mt-1.5 max-w-[22ch] line-clamp-2">
          {fallbackTitle}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

function isSafeHttpUrl(url?: string): boolean {
  if (!url) return false;
  return /^https?:\/\/[^\s]+$/i.test(url.trim());
}

export interface ReviewsAndFeedbackPanelProps {
  initialReviews: PaginatedReviewsResult;
  backendConnected: boolean;
  dataSource?: PortfolioDataSource;
  onFeedbackSaved?: () => void;
}

export const ReviewsAndFeedbackPanel: React.FC<ReviewsAndFeedbackPanelProps> = ({
  initialReviews,
  backendConnected,
  dataSource = portfolioRepository,
  onFeedbackSaved,
}) => {
  const [reviewsPage, setReviewsPage] = useState<PaginatedReviewsResult>(initialReviews);
  const [currentPage, setCurrentPage] = useState<number>(initialReviews.page || 1);
  const [isLoadingPage, setIsLoadingPage] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Feedback form state
  const [displayName, setDisplayName] = useState('');
  const [organization, setOrganization] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [rating, setRating] = useState<number | undefined>(5);
  const [comment, setComment] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<FeedbackSubmissionResult | null>(null);

  useEffect(() => {
    setReviewsPage(initialReviews);
    setCurrentPage(initialReviews.page || 1);
  }, [initialReviews]);

  const loadPage = useCallback(
    async (targetPage: number, forceRefresh = false) => {
      setIsLoadingPage(true);
      setPageError(null);
      try {
        const result = await dataSource.getReviewsPage(targetPage, REVIEWS_PER_PAGE, {
          forceRefresh,
        });
        setReviewsPage(result);
        setCurrentPage(result.page);
      } catch (err) {
        setPageError(
          err instanceof Error ? err.message : 'Unable to load reviews from the backend.'
        );
      } finally {
        setIsLoadingPage(false);
      }
    },
    [dataSource]
  );

  const handlePrevPage = () => {
    if (currentPage <= 1 || isLoadingPage) return;
    synthAudio.playButtonClick();
    void loadPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage >= reviewsPage.totalPages || isLoadingPage) return;
    synthAudio.playButtonClick();
    void loadPage(currentPage + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const res = await dataSource.submitFeedback({
        displayName,
        organization: organization || undefined,
        contactInfo: contactInfo || undefined,
        rating,
        comment,
        honeypot,
      });
      setSubmitResult(res);

      if (res.ok && res.persisted) {
        synthAudio.playOrbCollect(4);
        setDisplayName('');
        setOrganization('');
        setContactInfo('');
        setRating(5);
        setComment('');
        await loadPage(1, true);
        onFeedbackSaved?.();
      } else {
        synthAudio.playButtonClick();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Paginated Published Reviews (3 per page) */}
      <div className="lg:col-span-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">Published Visitor Reviews</h3>
            <p className="text-xs text-slate-400">
              Showing up to {REVIEWS_PER_PAGE} reviews per page
              {reviewsPage.averageRating !== undefined
                ? ` · Average ${reviewsPage.averageRating} / 5`
                : ''}
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-300 tabular-nums">
            {reviewsPage.totalItems} {reviewsPage.totalItems === 1 ? 'Review' : 'Reviews'}
          </span>
        </div>

        {isLoadingPage ? (
          <div className="space-y-3" aria-live="polite">
            {[0, 1, 2].map((skeletonIdx) => (
              <div
                key={skeletonIdx}
                className="bg-[#0c121e] border border-slate-800/80 rounded-2xl p-4 space-y-2"
              >
                <div className="h-3.5 w-32 bg-slate-800 rounded" />
                <div className="h-3 w-full bg-slate-800/70 rounded" />
                <div className="h-3 w-3/4 bg-slate-800/70 rounded" />
              </div>
            ))}
          </div>
        ) : pageError ? (
          <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-5 space-y-3">
            <div className="text-sm font-semibold text-rose-200">Unable to Load Reviews</div>
            <p className="text-xs text-rose-300/90 leading-relaxed">{pageError}</p>
            <button
              type="button"
              onClick={() => void loadPage(currentPage, true)}
              className="min-h-[40px] px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-100 rounded-xl text-xs font-mono transition-colors cursor-pointer"
            >
              Retry Request
            </button>
          </div>
        ) : reviewsPage.items.length === 0 ? (
          <div className="bg-[#0c121e] border border-slate-800 rounded-2xl p-6 space-y-2">
            <div className="text-sm font-semibold text-slate-200">
              No Published Reviews Yet
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {backendConnected
                ? 'The connected portfolio backend currently has 0 published visitor reviews. Be the first to share feedback using the form.'
                : 'No review backend is connected yet (VITE_PORTFOLIO_API_URL is unconfigured). Fake testimonials are never shown — connect GET /reviews and POST /feedback to publish live visitor reviews.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviewsPage.items.map((rev) => (
              <article
                key={rev.id}
                className="bg-[#0c121e] border border-slate-800 rounded-2xl p-4 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-bold text-white">{rev.authorName}</span>
                    {rev.authorRoleOrOrg && (
                      <>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span className="text-slate-400">{rev.authorRoleOrOrg}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    {typeof rev.rating === 'number' && rev.rating >= 1 && rev.rating <= 5 && (
                      <span
                        className="text-amber-400 tracking-tight"
                        aria-label={`Rated ${rev.rating} out of 5`}
                      >
                        {'★'.repeat(rev.rating)}
                        <span className="text-slate-700">{'★'.repeat(5 - rev.rating)}</span>
                      </span>
                    )}
                    {rev.createdAt && <span className="text-slate-500">{rev.createdAt}</span>}
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{rev.comment}</p>
              </article>
            ))}
          </div>
        )}

        {/* Pagination Controls (3 per page) */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || isLoadingPage || reviewsPage.totalPages <= 1}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-mono border border-slate-800 bg-[#0c121e] text-slate-200 hover:border-cyan-400/50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            ← Previous
          </button>

          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {reviewsPage.totalPages > 0
              ? `Page ${currentPage} of ${reviewsPage.totalPages}`
              : 'Page 1 of 1'}
          </span>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={
              currentPage >= reviewsPage.totalPages ||
              isLoadingPage ||
              reviewsPage.totalPages <= 1
            }
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-mono border border-slate-800 bg-[#0c121e] text-slate-200 hover:border-cyan-400/50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Right Column: Validated Feedback Submission Form */}
      <div className="lg:col-span-5">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-[#0c121e] border border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Submit Feedback</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {backendConnected
                ? 'Submissions are validated and sent directly to the portfolio server.'
                : 'Backend persistence is currently unconfigured — submissions are validated locally and will clearly report connection status.'}
            </p>
          </div>

          {/* Offscreen honeypot field for basic anti-spam */}
          <div className="sr-only" aria-hidden="true">
            <label htmlFor="portfolio-feedback-company-url">Leave this field empty</label>
            <input
              id="portfolio-feedback-company-url"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="feedback-display-name"
              className="block text-xs font-medium text-slate-300"
            >
              Display Name <span className="text-cyan-400">*</span>
            </label>
            <input
              id="feedback-display-name"
              type="text"
              required
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#070b13] border border-slate-800 focus:border-cyan-400 focus:outline-none text-sm text-white placeholder:text-slate-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="feedback-organization"
                className="block text-xs font-medium text-slate-300"
              >
                Role or Team <span className="text-slate-500">(optional)</span>
              </label>
              <input
                id="feedback-organization"
                type="text"
                maxLength={80}
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. Frontend Lead"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#070b13] border border-slate-800 focus:border-cyan-400 focus:outline-none text-sm text-white placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="feedback-contact"
                className="block text-xs font-medium text-slate-300"
              >
                Email / Handle <span className="text-slate-500">(optional)</span>
              </label>
              <input
                id="feedback-contact"
                type="text"
                maxLength={120}
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="Private contact"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#070b13] border border-slate-800 focus:border-cyan-400 focus:outline-none text-sm text-white placeholder:text-slate-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-300">
              Rating <span className="text-slate-500">(optional)</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const selected = rating === star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(rating === star ? undefined : star)}
                    aria-pressed={selected}
                    className={`min-w-[44px] min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-mono border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold'
                        : 'bg-[#070b13] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {star}★
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="feedback-comment" className="font-medium text-slate-300">
                Feedback Message <span className="text-cyan-400">*</span>
              </label>
              <span className="font-mono text-slate-500 tabular-nums">
                {comment.length} / 1000
              </span>
            </div>
            <textarea
              id="feedback-comment"
              required
              rows={4}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share thoughts on the work, architecture, or 3D experience..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#070b13] border border-slate-800 focus:border-cyan-400 focus:outline-none text-sm text-white placeholder:text-slate-600 resize-y"
            />
          </div>

          {submitResult && (
            <div
              role="status"
              className={`rounded-xl p-3.5 text-xs leading-relaxed border ${
                submitResult.status === 'saved'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : submitResult.status === 'backend_unconfigured'
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              }`}
            >
              {submitResult.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors cursor-pointer"
          >
            {isSubmitting ? 'Submitting Feedback...' : 'Send Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
};

interface PortfolioSectionModalProps {
  modal: Exclude<ActiveModalView, { type: 'beacon' }>;
  overview: PortfolioOverviewData;
  currentZone: ZoneId;
  dataSource?: PortfolioDataSource;
  onClose: () => void;
  onNavigateZone: (zone: ZoneId) => void;
  onReturnHub: () => void;
  onFeedbackSaved?: () => void;
}

export const PortfolioSectionModal: React.FC<PortfolioSectionModalProps> = ({
  modal,
  overview,
  currentZone,
  dataSource = portfolioRepository,
  onClose,
  onNavigateZone,
  onReturnHub,
  onFeedbackSaved,
}) => {
  const [projectTab, setProjectTab] = useState<'overview' | 'stack' | 'interactive'>('overview');
  const [selectedSkillCatId, setSelectedSkillCatId] = useState<string>(
    modal.type === 'skill_category'
      ? modal.categoryId
      : overview.skillCategories[0]?.id || ''
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Interactive project playground states (preserved from original exhibits)
  const [simNodes, setSimNodes] = useState<number>(32);
  const [simFreq, setSimFreq] = useState<number>(432);
  const [testedLatency, setTestedLatency] = useState<string>('11.2ms');
  const [companionMood, setCompanionMood] = useState<'happy' | 'curious' | 'wave'>('happy');

  useEffect(() => {
    setProjectTab('overview');
    if (modal.type === 'skill_category') {
      setSelectedSkillCatId(modal.categoryId);
    }
  }, [modal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        synthAudio.playButtonClick();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = async (id: string, value: string) => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedId(id);
      synthAudio.playButtonClick();
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2000);
    } catch {
      // Clipboard API restricted in some contexts; ignore silently
    }
  };

  const renderAboutContent = () => {
    const { profile } = overview;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-4 rounded-2xl overflow-hidden border border-slate-800 bg-[#060a12] aspect-[4/4] max-w-[260px] w-full mx-auto md:mx-0">
            <SafePortfolioImage
              src={profile.portraitUrl}
              alt={profile.name}
              fallbackKicker="Biographical Archive"
              fallbackTitle={profile.name}
            />
          </div>

          <div className="md:col-span-8 space-y-3">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              {profile.name}
            </h2>
            <p className="text-base font-medium text-cyan-400">{profile.title}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              {profile.subtitle && <span>{profile.subtitle}</span>}
              {profile.subtitle && profile.period && <span aria-hidden="true">·</span>}
              {profile.period && <span className="font-mono text-slate-300">{profile.period}</span>}
            </div>
            <p className="text-sm text-slate-300 leading-relaxed pt-1">{profile.shortBio}</p>

            {profile.metrics && profile.metrics.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                {profile.metrics.map((m, idx) => (
                  <div
                    key={idx}
                    className="bg-[#0c121e] border border-slate-800 rounded-xl p-3"
                  >
                    <div className="text-[11px] text-slate-400">{m.label}</div>
                    <div className="text-sm font-bold font-mono text-cyan-300 tabular-nums mt-0.5">
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Full Biography */}
        <div className="space-y-3 text-sm text-slate-300 leading-relaxed border-t border-slate-800 pt-5">
          {profile.biography.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>

        {/* Specializations & Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {profile.specializations.length > 0 && (
            <div className="bg-[#0c121e] border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                Core Technical Focus
              </h3>
              <ul className="space-y-2 text-sm text-slate-200">
                {profile.specializations.map((spec, i) => (
                  <li key={i} className="flex items-center justify-between border-b border-slate-800/70 pb-1.5 last:border-0 last:pb-0">
                    <span>{spec}</span>
                    <span className="text-xs font-mono text-slate-500">0{i + 1}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {profile.highlights.length > 0 && (
            <div className="bg-[#0c121e] border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                Selected Highlights
              </h3>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                {profile.highlights.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-cyan-400 font-mono">▸</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Optional Career / Education Timeline when supplied by backend */}
        {profile.careerOrEducation && profile.careerOrEducation.length > 0 && (
          <div className="space-y-3 border-t border-slate-800 pt-5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400">
              Experience & Education
            </h3>
            <div className="space-y-3">
              {profile.careerOrEducation.map((entry, idx) => (
                <div
                  key={idx}
                  className="bg-[#0c121e] border border-slate-800 rounded-xl p-4 space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">{entry.title}</span>
                    {entry.period && (
                      <span className="text-xs font-mono text-slate-400">{entry.period}</span>
                    )}
                  </div>
                  {entry.organization && (
                    <div className="text-xs text-cyan-300">{entry.organization}</div>
                  )}
                  {entry.summary && (
                    <p className="text-xs text-slate-300 leading-relaxed pt-1">{entry.summary}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderProjectContent = (projectId: string) => {
    const project: ProjectItem | undefined = overview.projects.find((p) => p.id === projectId);
    if (!project) {
      return (
        <div className="p-6 text-center text-sm text-slate-400">
          Project record not found in the active portfolio snapshot.
        </div>
      );
    }

    const hasRepo = isSafeHttpUrl(project.repoUrl);
    const hasLive = isSafeHttpUrl(project.liveUrl);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-5 relative rounded-2xl overflow-hidden border border-slate-800 bg-[#060a12] aspect-[4/3]">
            <SafePortfolioImage
              src={project.imageUrl}
              alt={project.title}
              fallbackKicker={project.category}
              fallbackTitle={project.title}
            />
          </div>

          <div className="md:col-span-7 space-y-3">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              {project.title}
            </h2>
            {project.subtitle && (
              <p className="text-sm font-medium text-cyan-400">{project.subtitle}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{project.category}</span>
              {project.role && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{project.role}</span>
                </>
              )}
              {project.year && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-300">{project.year}</span>
                </>
              )}
            </div>

            <p className="text-sm text-slate-300 leading-relaxed pt-1">{project.summary}</p>

            {/* Verified External Project Links */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {hasRepo && (
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-white flex items-center gap-2 transition-colors"
                >
                  <span>Source Repository</span>
                  <span aria-hidden="true">↗</span>
                </a>
              )}
              {hasLive && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs font-mono flex items-center gap-2 transition-colors"
                >
                  <span>Launch Live Demo</span>
                  <span aria-hidden="true">↗</span>
                </a>
              )}
              {!hasRepo && !hasLive && (
                <span className="text-xs font-mono text-slate-500">
                  No external repository or live deployment link attached to this entry
                </span>
              )}
            </div>
          </div>
        </div>

        {project.metrics && project.metrics.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {project.metrics.map((m, idx) => (
              <div key={idx} className="bg-[#0c121e] border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400">{m.label}</div>
                <div className="text-sm font-bold font-mono text-cyan-300 tabular-nums mt-0.5">
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => {
              synthAudio.playButtonClick();
              setProjectTab('overview');
            }}
            className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
              projectTab === 'overview'
                ? 'bg-cyan-400 text-slate-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Case Study Details
          </button>
          <button
            type="button"
            onClick={() => {
              synthAudio.playButtonClick();
              setProjectTab('stack');
            }}
            className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
              projectTab === 'stack'
                ? 'bg-cyan-400 text-slate-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Technologies ({project.techStack.length})
          </button>
          {project.interactivePreset && (
            <button
              type="button"
              onClick={() => {
                synthAudio.playButtonClick();
                setProjectTab('interactive');
              }}
              className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                projectTab === 'interactive'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Interactive Laboratory
            </button>
          )}
        </div>

        {projectTab === 'overview' && (
          <div className="space-y-4">
            <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
              {project.description.map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
            </div>

            {project.highlights && project.highlights.length > 0 && (
              <div className="pt-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400 mb-2.5">
                  Engineering Highlights
                </h3>
                <ul className="space-y-2 text-xs text-slate-300">
                  {project.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-cyan-400 font-mono">▸</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {projectTab === 'stack' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {project.techStack.map((tech, idx) => (
              <div
                key={idx}
                className="bg-[#0c121e] border border-slate-800 p-3.5 rounded-xl flex items-center justify-between"
              >
                <span className="text-xs font-semibold text-slate-200">{tech}</span>
                <span className="text-[11px] font-mono text-slate-500">
                  {String(idx + 1).padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>
        )}

        {projectTab === 'interactive' && project.interactivePreset && (
          <div className="bg-[#070b13] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
              <span>INTERACTIVE SIMULATION</span>
              <span className="text-slate-500">LOCAL PARAMETER SANDBOX</span>
            </div>

            {project.interactivePreset === 'neurogrid' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Active Topology Nodes: {simNodes}</span>
                    <span className="font-mono text-cyan-300">
                      Estimated Latency: {testedLatency}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={128}
                    value={simNodes}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSimNodes(val);
                      setTestedLatency(`${(8 + (128 - val) * 0.05).toFixed(1)}ms`);
                    }}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    synthAudio.playHologramScan();
                    setTestedLatency(`${(9.8 + Math.random() * 2).toFixed(1)}ms`);
                  }}
                  className="min-h-[42px] px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-xl text-xs font-mono transition-colors cursor-pointer"
                >
                  Benchmark Topology Ring
                </button>
              </div>
            )}

            {project.interactivePreset === 'quantum-canvas' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Resonant Carrier Frequency: {simFreq} Hz</span>
                    <span className="font-mono text-amber-300">
                      Phase Angle: {(simFreq / 432).toFixed(2)}π
                    </span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={880}
                    value={simFreq}
                    onChange={(e) => setSimFreq(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => synthAudio.playOrbCollect(3)}
                  className="min-h-[42px] px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs font-mono transition-colors cursor-pointer"
                >
                  Pulse Crystal Harmonic
                </button>
              </div>
            )}

            {project.interactivePreset === 'orbit-companion' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-400">Test Companion Emotion Synthesizer:</div>
                <div className="flex flex-wrap items-center gap-2">
                  {(['happy', 'curious', 'wave'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setCompanionMood(m);
                        synthAudio.playRobotChirp(m);
                      }}
                      className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-mono transition-colors cursor-pointer ${
                        companionMood === m
                          ? 'bg-cyan-400 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSkillsContent = () => {
    const categories = overview.skillCategories;
    if (categories.length === 0) {
      return (
        <div className="p-6 text-center text-sm text-slate-400">
          No skill categories are currently loaded from the portfolio data source.
        </div>
      );
    }

    const activeGroup: SkillCategoryGroup =
      categories.find((c) => c.id === selectedSkillCatId) || categories[0];

    return (
      <div className="space-y-6">
        {/* Category Switcher */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          {categories.map((cat) => {
            const active = cat.id === activeGroup.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  synthAudio.playButtonClick();
                  setSelectedSkillCatId(cat.id);
                }}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-[#0c121e] text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                {cat.category} ({cat.skills.length})
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">{activeGroup.category}</h2>
          <p className="text-sm text-slate-300 leading-relaxed">{activeGroup.summary}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeGroup.skills.map((skill, idx) => (
            <div
              key={idx}
              className="bg-[#0c121e] border border-slate-800 rounded-2xl p-4 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white">{skill.name}</span>
                {(skill.proficiencyLabel || skill.yearsOfExperience !== undefined) && (
                  <span className="text-xs font-mono text-cyan-300">
                    {[
                      skill.proficiencyLabel,
                      skill.yearsOfExperience !== undefined
                        ? `${skill.yearsOfExperience}y`
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </div>
              {skill.context && (
                <p className="text-xs text-slate-400 leading-relaxed">{skill.context}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCertificateContent = (certificateId: string) => {
    if (certificateId === '__empty__' || overview.certificates.length === 0) {
      return (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">No Certificates Loaded Yet</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            This portfolio strictly avoids displaying fabricated credentials. Zero certificate
            records were found in the local repository, and no live backend endpoint is currently
            supplying certificate entries.
          </p>
          <div className="bg-[#0c121e] border border-slate-800 rounded-2xl p-5 space-y-2 text-xs font-mono text-slate-400">
            <div className="text-amber-400">DYNAMIC BACKEND CONTRACT</div>
            <p className="font-sans text-slate-300 leading-relaxed">
              When <code className="text-cyan-300">VITE_PORTFOLIO_API_URL</code> returns{' '}
              <code className="text-cyan-300">certificates[]</code> from{' '}
              <code className="text-cyan-300">GET /overview</code>, the Certificates Vault
              automatically generates non-overlapping 3D billboards and detail views for each
              verified certificate.
            </p>
          </div>
        </div>
      );
    }

    const cert: CertificateItem | undefined =
      overview.certificates.find((c) => c.id === certificateId) || overview.certificates[0];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-5 rounded-2xl overflow-hidden border border-slate-800 bg-[#060a12] aspect-[4/3]">
            <SafePortfolioImage
              src={cert.imageUrl}
              alt={cert.name}
              fallbackKicker={cert.issuer}
              fallbackTitle={cert.name}
            />
          </div>

          <div className="md:col-span-7 space-y-3">
            <h2 className="text-2xl font-extrabold text-white">{cert.name}</h2>
            <p className="text-base font-medium text-amber-400">{cert.issuer}</p>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
              {cert.issueDate && <span>Issued: {cert.issueDate}</span>}
              {cert.expirationDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Expires: {cert.expirationDate}</span>
                </>
              )}
              {cert.credentialId && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-300">ID: {cert.credentialId}</span>
                </>
              )}
            </div>

            {cert.summary && (
              <p className="text-sm text-slate-300 leading-relaxed pt-1">{cert.summary}</p>
            )}

            {isSafeHttpUrl(cert.verificationUrl) && (
              <div className="pt-2">
                <a
                  href={cert.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs font-mono items-center gap-2 transition-colors"
                >
                  <span>Verify Credential</span>
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderContactContent = (selectedId?: string) => {
    if (overview.contacts.length === 0) {
      return (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">No Public Contact Links Configured</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            To prevent dead or placeholder links, external contact billboards are generated only
            when verified URLs or email addresses are present in your environment or backend API.
          </p>
          <div className="bg-[#0c121e] border border-slate-800 rounded-2xl p-5 space-y-2 text-xs font-mono text-slate-300">
            <div className="text-cyan-400">SUPPORTED CONFIGURATION KEYS</div>
            <div>VITE_PORTFOLIO_GITHUB_URL</div>
            <div>VITE_PORTFOLIO_LINKEDIN_URL</div>
            <div>VITE_PORTFOLIO_WEBSITE_URL</div>
            <div>VITE_PORTFOLIO_EMAIL</div>
            <div className="text-slate-400 pt-1 font-sans">
              Or supply <code className="text-cyan-300">contacts[]</code> from{' '}
              <code className="text-cyan-300">VITE_PORTFOLIO_API_URL/overview</code>.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Direct Contact & Verified Channels</h2>
          <p className="text-xs text-slate-400">
            External profiles open safely in a new browser tab; email links launch your mail client.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {overview.contacts.map((contact: ContactLinkItem) => {
            const isEmail =
              contact.kind === 'email' || contact.url.toLowerCase().startsWith('mailto:');
            const isHighlighted = selectedId === contact.id;
            const copyValue = isEmail ? contact.url.replace(/^mailto:/i, '') : contact.url;

            return (
              <div
                key={contact.id}
                className={`rounded-2xl p-5 border space-y-3 ${
                  isHighlighted
                    ? 'bg-[#0f1a2c] border-cyan-400/70'
                    : 'bg-[#0c121e] border-slate-800'
                }`}
              >
                <div className="space-y-1">
                  <div className="text-xs font-mono text-cyan-400">
                    {isEmail ? 'DIRECT EMAIL' : 'EXTERNAL DESTINATION'}
                  </div>
                  <h3 className="text-lg font-bold text-white">{contact.platform}</h3>
                  <div className="text-xs font-mono text-slate-300 break-all">
                    {contact.handleOrLabel || copyValue}
                  </div>
                  {contact.description && (
                    <p className="text-xs text-slate-400 pt-1">{contact.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={contact.url}
                    target={isEmail ? undefined : '_blank'}
                    rel={isEmail ? undefined : 'noopener noreferrer'}
                    onClick={() => synthAudio.playButtonClick()}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs font-mono inline-flex items-center gap-2 transition-colors"
                  >
                    <span>
                      {isEmail ? 'Compose Email' : `Open ${contact.platform}`}
                    </span>
                    <span aria-hidden="true">{isEmail ? '✉' : '↗'}</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => void handleCopy(contact.id, copyValue)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors cursor-pointer"
                  >
                    {copiedId === contact.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const sectionLabelMap: Record<Exclude<ActiveModalView['type'], 'beacon'>, string> = {
    about: '01 · About Me',
    project: '02 · Project Case Study',
    skill_category: '03 · Skills Matrix',
    certificate: '04 · Certificates Vault',
    contact: '05 · Contact & Social Relay',
    feedback: '06 · Visitor Reviews & Feedback',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="absolute inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8 bg-[#04060a]/88 text-white select-text touch-auto"
    >
      <div className="w-full max-w-5xl max-h-[92%] bg-[#090d16] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-800 bg-[#0c121d] shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <span>{sectionLabelMap[modal.type]}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              synthAudio.playButtonClick();
              onClose();
            }}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close [Esc]
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 md:p-8">
          {modal.type === 'about' && renderAboutContent()}
          {modal.type === 'project' && renderProjectContent(modal.projectId)}
          {modal.type === 'skill_category' && renderSkillsContent()}
          {modal.type === 'certificate' && renderCertificateContent(modal.certificateId)}
          {modal.type === 'contact' && renderContactContent(modal.contactId)}
          {modal.type === 'feedback' && (
            <ReviewsAndFeedbackPanel
              initialReviews={overview.reviewsPreview}
              backendConnected={overview.backendConnected}
              dataSource={dataSource}
              onFeedbackSaved={onFeedbackSaved}
            />
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-slate-800 bg-[#0c121d] shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {currentZone !== 'hub' && (
              <button
                type="button"
                onClick={() => {
                  synthAudio.playButtonClick();
                  onClose();
                  onReturnHub();
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-mono transition-colors cursor-pointer"
              >
                ← Return to Main World
              </button>
            )}
            {currentZone === 'hub' && modal.type === 'about' && (
              <button
                type="button"
                onClick={() => {
                  synthAudio.playButtonClick();
                  onClose();
                  onNavigateZone('about');
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-mono transition-colors cursor-pointer"
              >
                Enter About Zone →
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              synthAudio.playButtonClick();
              onClose();
            }}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs font-mono transition-colors cursor-pointer ml-auto"
          >
            Resume 3D World
          </button>
        </div>
      </div>
    </div>
  );
};
