/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ActiveModalView,
  PortfolioOverviewData,
  ZoneId,
} from '../types/portfolio';
import { ReviewsAndFeedbackPanel, SafePortfolioImage } from './PortfolioSectionModal';
import { synthAudio } from '../audio/synthAudio';

interface StandardPortfolioViewProps {
  overview: PortfolioOverviewData;
  isLoadingData: boolean;
  onEnter3DWorld: (targetZone?: ZoneId) => void;
  onOpenProjectModal: (modal: ActiveModalView) => void;
  onFeedbackSaved?: () => void;
}

function isSafeHttpUrl(url?: string): boolean {
  if (!url) return false;
  return /^https?:\/\/[^\s]+$/i.test(url.trim());
}

export const StandardPortfolioView: React.FC<StandardPortfolioViewProps> = ({
  overview,
  isLoadingData,
  onEnter3DWorld,
  onOpenProjectModal,
  onFeedbackSaved,
}) => {
  const { profile, projects, skillCategories, certificates, contacts, reviewsPreview } = overview;

  const scrollToSection = (sectionId: string) => {
    synthAudio.playButtonClick();
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      data-testid="standard-portfolio-view"
      className="fixed inset-0 z-40 overflow-y-auto touch-auto select-text bg-[#060911] text-white font-sans"
    >
      {/* Single Sticky Top Bar (<= 56px height to preserve >= 85% mobile reading viewport) */}
      <header className="sticky top-0 z-20 h-14 bg-[#070b13]/95 border-b border-slate-800/90 px-4 sm:px-6 flex items-center justify-between gap-4">
        <a
          href="#qv-about"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection('qv-about');
          }}
          className="text-sm sm:text-base font-extrabold tracking-tight text-white whitespace-nowrap"
        >
          {profile.name}
        </a>

        <nav
          aria-label="Portfolio sections"
          className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-300"
        >
          {[
            { id: 'qv-about', label: 'About' },
            { id: 'qv-projects', label: 'Projects' },
            { id: 'qv-skills', label: 'Skills' },
            { id: 'qv-certificates', label: 'Certificates' },
            { id: 'qv-contact', label: 'Contact' },
            { id: 'qv-feedback', label: 'Reviews' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.id)}
              className="hover:text-cyan-400 transition-colors cursor-pointer py-1"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => {
            synthAudio.playButtonClick();
            onEnter3DWorld();
          }}
          className="min-h-[40px] px-4 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs font-mono whitespace-nowrap transition-colors cursor-pointer"
        >
          Explore 3D World
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 sm:py-12 space-y-16 sm:space-y-24">
        {/* Non-sticky Mobile Section Jump Strip */}
        <div className="flex md:hidden items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800/80">
          {[
            { id: 'qv-about', label: 'About' },
            { id: 'qv-projects', label: 'Projects' },
            { id: 'qv-skills', label: 'Skills' },
            { id: 'qv-certificates', label: 'Certificates' },
            { id: 'qv-contact', label: 'Contact' },
            { id: 'qv-feedback', label: 'Reviews' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.id)}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#0c121e] border border-slate-800 text-xs font-medium text-slate-200 shrink-0"
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoadingData && (
          <div className="text-xs font-mono text-cyan-300 bg-[#0c121e] border border-slate-800 rounded-xl px-4 py-3">
            Synchronizing portfolio records...
          </div>
        )}

        {overview.loadError && (
          <div className="text-xs text-amber-200 bg-amber-950/30 border border-amber-500/40 rounded-xl px-4 py-3">
            Backend notice: {overview.loadError} — showing verified local repository records.
          </div>
        )}

        {/* 01. ABOUT ME */}
        <section id="qv-about" className="scroll-mt-20 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-8 space-y-4">
              <div className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                01. About Me
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                {profile.name}
              </h1>
              <p className="text-lg sm:text-xl font-medium text-cyan-300">{profile.title}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                {profile.subtitle && <span>{profile.subtitle}</span>}
                {profile.subtitle && profile.period && <span aria-hidden="true">·</span>}
                {profile.period && <span className="font-mono text-slate-300">{profile.period}</span>}
              </div>

              <div className="space-y-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl pt-2">
                {profile.biography.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </div>

            <div className="md:col-span-4">
              <div className="rounded-3xl overflow-hidden border border-slate-800 bg-[#090d16] aspect-[4/4] max-w-[300px] mx-auto">
                <SafePortfolioImage
                  src={profile.portraitUrl}
                  alt={profile.name}
                  fallbackKicker="Profile Archive"
                  fallbackTitle={profile.name}
                />
              </div>
            </div>
          </div>

          {profile.metrics && profile.metrics.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {profile.metrics.map((m, idx) => (
                <div key={idx} className="bg-[#090d16] border border-slate-800 rounded-2xl p-4">
                  <div className="text-xs text-slate-400">{m.label}</div>
                  <div className="text-base font-bold font-mono text-cyan-300 tabular-nums mt-1">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {profile.specializations.length > 0 && (
              <div className="bg-[#090d16] border border-slate-800 rounded-2xl p-6 space-y-3">
                <h2 className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                  Core Technical Focus
                </h2>
                <div className="text-sm text-slate-200 leading-relaxed">
                  {profile.specializations.join(' · ')}
                </div>
              </div>
            )}

            {profile.highlights.length > 0 && (
              <div className="bg-[#090d16] border border-slate-800 rounded-2xl p-6 space-y-3">
                <h2 className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                  Selected Highlights
                </h2>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                  {profile.highlights.map((h, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-cyan-400 font-mono">▸</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* 02. PROJECTS */}
        <section id="qv-projects" className="scroll-mt-20 space-y-6 border-t border-slate-800/80 pt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                02. Projects
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Engineering Case Studies
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onEnter3DWorld('projects')}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#0c121e] hover:bg-slate-800 border border-slate-800 text-xs font-mono text-cyan-300 cursor-pointer"
            >
              Visit 3D Projects Zone →
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="bg-[#090d16] border border-slate-800 rounded-2xl p-6 text-sm text-slate-400">
              No published project records are currently loaded from the portfolio data source.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((proj) => {
                const hasRepo = isSafeHttpUrl(proj.repoUrl);
                const hasLive = isSafeHttpUrl(proj.liveUrl);

                return (
                  <article
                    key={proj.id}
                    className="bg-[#090d16] border border-slate-800 rounded-3xl overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[16/10] bg-[#060a12] border-b border-slate-800 overflow-hidden">
                        <SafePortfolioImage
                          src={proj.imageUrl}
                          alt={proj.title}
                          fallbackKicker={proj.category}
                          fallbackTitle={proj.title}
                        />
                      </div>

                      <div className="p-5 space-y-3">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                          <span className="text-cyan-400 font-medium">{proj.category}</span>
                          {proj.year && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">{proj.year}</span>
                            </>
                          )}
                        </div>

                        <h3 className="text-lg font-bold text-white leading-snug">{proj.title}</h3>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                          {proj.summary}
                        </p>

                        <div className="text-xs font-mono text-slate-400 pt-1">
                          {proj.techStack.join(' · ')}
                        </div>
                      </div>
                    </div>

                    <div className="px-5 pb-5 pt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          synthAudio.playButtonClick();
                          onOpenProjectModal({ type: 'project', projectId: proj.id });
                        }}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs font-mono transition-colors cursor-pointer"
                      >
                        Inspect Details
                      </button>

                      {hasRepo && (
                        <a
                          href={proj.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 inline-flex items-center gap-1"
                        >
                          <span>Repo</span>
                          <span aria-hidden="true">↗</span>
                        </a>
                      )}

                      {hasLive && (
                        <a
                          href={proj.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 inline-flex items-center gap-1"
                        >
                          <span>Live</span>
                          <span aria-hidden="true">↗</span>
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* 03. SKILLS */}
        <section id="qv-skills" className="scroll-mt-20 space-y-6 border-t border-slate-800/80 pt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                03. Skills
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Technical Capabilities by Domain
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onEnter3DWorld('skills')}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#0c121e] hover:bg-slate-800 border border-slate-800 text-xs font-mono text-cyan-300 cursor-pointer"
            >
              Visit 3D Skills Zone →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {skillCategories.map((cat) => (
              <div
                key={cat.id}
                className="bg-[#090d16] border border-slate-800 rounded-3xl p-6 space-y-4"
              >
                <div className="space-y-1.5 border-b border-slate-800 pb-3">
                  <h3 className="text-lg font-bold text-white">{cat.category}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{cat.summary}</p>
                </div>

                <ul className="space-y-3">
                  {cat.skills.map((skill, idx) => (
                    <li key={idx} className="space-y-0.5">
                      <div className="flex items-center justify-between text-sm font-semibold text-slate-200">
                        <span>{skill.name}</span>
                        {skill.proficiencyLabel && (
                          <span className="text-xs font-mono text-cyan-300">
                            {skill.proficiencyLabel}
                          </span>
                        )}
                      </div>
                      {skill.context && (
                        <div className="text-xs text-slate-400">{skill.context}</div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 04. CERTIFICATES */}
        <section
          id="qv-certificates"
          className="scroll-mt-20 space-y-6 border-t border-slate-800/80 pt-12"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                04. Certificates
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Verified Credentials
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onEnter3DWorld('certificates')}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#0c121e] hover:bg-slate-800 border border-slate-800 text-xs font-mono text-cyan-300 cursor-pointer"
            >
              Visit 3D Certificates Zone →
            </button>
          </div>

          {certificates.length === 0 ? (
            <div className="bg-[#090d16] border border-slate-800 rounded-2xl p-6 space-y-2">
              <div className="text-sm font-semibold text-slate-200">
                0 Certificates Loaded in Active Data Source
              </div>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-3xl">
                No fabricated certificates are displayed. Connect{' '}
                <code className="text-cyan-300 font-mono">VITE_PORTFOLIO_API_URL</code> returning{' '}
                <code className="text-cyan-300 font-mono">certificates[]</code> to render verified
                issuing organizations, dates, credential IDs, and verification links automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {certificates.map((cert) => (
                <article
                  key={cert.id}
                  className="bg-[#090d16] border border-slate-800 rounded-3xl p-6 space-y-3"
                >
                  <div className="text-xs font-mono text-amber-400">{cert.issuer}</div>
                  <h3 className="text-lg font-bold text-white">{cert.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                    {cert.issueDate && <span>Issued {cert.issueDate}</span>}
                    {cert.credentialId && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>ID {cert.credentialId}</span>
                      </>
                    )}
                  </div>
                  {cert.summary && (
                    <p className="text-sm text-slate-300 leading-relaxed">{cert.summary}</p>
                  )}
                  {isSafeHttpUrl(cert.verificationUrl) && (
                    <div className="pt-2">
                      <a
                        href={cert.verificationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs font-mono inline-flex items-center gap-2"
                      >
                        <span>Verify Credential</span>
                        <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* 05. CONTACT & SOCIAL LINKS */}
        <section
          id="qv-contact"
          className="scroll-mt-20 space-y-6 border-t border-slate-800/80 pt-12"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                05. Contact & Social Links
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Direct Channels</h2>
            </div>
            <button
              type="button"
              onClick={() => onEnter3DWorld('contact')}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#0c121e] hover:bg-slate-800 border border-slate-800 text-xs font-mono text-cyan-300 cursor-pointer"
            >
              Visit 3D Contact Zone →
            </button>
          </div>

          {contacts.length === 0 ? (
            <div className="bg-[#090d16] border border-slate-800 rounded-2xl p-6 space-y-2">
              <div className="text-sm font-semibold text-slate-200">
                No Public Social or Email Links Configured Yet
              </div>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-3xl">
                Provide <code className="text-cyan-300 font-mono">VITE_PORTFOLIO_GITHUB_URL</code>,{' '}
                <code className="text-cyan-300 font-mono">VITE_PORTFOLIO_LINKEDIN_URL</code>,{' '}
                <code className="text-cyan-300 font-mono">VITE_PORTFOLIO_EMAIL</code>, or backend{' '}
                <code className="text-cyan-300 font-mono">contacts[]</code> to enable verified
                external action links.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {contacts.map((contact) => {
                const isEmail =
                  contact.kind === 'email' || contact.url.toLowerCase().startsWith('mailto:');
                return (
                  <a
                    key={contact.id}
                    href={contact.url}
                    target={isEmail ? undefined : '_blank'}
                    rel={isEmail ? undefined : 'noopener noreferrer'}
                    className="bg-[#090d16] hover:bg-[#0d1422] border border-slate-800 hover:border-cyan-400/60 rounded-2xl p-5 flex items-center justify-between gap-4 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-sm font-bold text-white">{contact.platform}</div>
                      <div className="text-xs font-mono text-slate-400 truncate">
                        {contact.handleOrLabel || contact.url}
                      </div>
                    </div>
                    <span className="text-cyan-400 font-mono text-sm shrink-0">
                      {isEmail ? '✉' : '↗'}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* 06. FEEDBACK & REVIEWS */}
        <section
          id="qv-feedback"
          className="scroll-mt-20 space-y-6 border-t border-slate-800/80 pt-12 pb-8"
        >
          <div className="space-y-1">
            <div className="text-xs font-mono uppercase tracking-wider text-cyan-400">
              06. Feedback & Reviews
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Visitor Perspectives & Feedback
            </h2>
          </div>

          <ReviewsAndFeedbackPanel
            initialReviews={reviewsPreview}
            backendConnected={overview.backendConnected}
            onFeedbackSaved={onFeedbackSaved}
          />
        </section>
      </main>
    </div>
  );
};
