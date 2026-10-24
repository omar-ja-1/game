/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CertificateItem,
  ContactLinkItem,
  ProjectItem,
  ReviewItem,
} from '../types/portfolio';

/**
 * Isolated development/test-only fixture builders used strictly by automated unit tests
 * to verify variable item counts (2, 5, 10+ projects/certificates), social link filtering,
 * and 3-per-page review pagination without ever polluting production portfolio content.
 */
export function buildTestProjects(count: number): ProjectItem[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `test-proj-${idx + 1}`,
    title: `Test System ${idx + 1}`,
    category: 'Systems Test',
    role: 'Architect',
    year: '2026',
    summary: `Synthetic test fixture #${idx + 1} for deterministic layout verification.`,
    description: [`Detailed test description for fixture ${idx + 1}.`],
    techStack: ['TypeScript', 'Three.js'],
    repoUrl: `https://github.com/example/test-proj-${idx + 1}`,
  }));
}

export function buildTestCertificates(count: number): CertificateItem[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `test-cert-${idx + 1}`,
    name: `Test Credential ${idx + 1}`,
    issuer: 'Test Standards Institute',
    issueDate: '2025-06',
    credentialId: `CRED-${1000 + idx}`,
    verificationUrl: `https://verify.example.org/cred/${1000 + idx}`,
  }));
}

export function buildTestContacts(): ContactLinkItem[] {
  return [
    {
      id: 'c-github',
      platform: 'GitHub',
      kind: 'social',
      url: 'https://github.com/example-handle',
      handleOrLabel: 'github.com/example-handle',
    },
    {
      id: 'c-email',
      platform: 'Email',
      kind: 'email',
      url: 'mailto:hello@example.org',
      handleOrLabel: 'hello@example.org',
    },
    {
      id: 'c-invalid-empty',
      platform: 'Twitter',
      kind: 'social',
      url: '   ',
    },
  ];
}

export function buildTestReviews(count: number): ReviewItem[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `test-rev-${idx + 1}`,
    authorName: `Reviewer ${idx + 1}`,
    authorRoleOrOrg: `Test Lab ${idx + 1}`,
    rating: (idx % 5) + 1,
    comment: `Automated test review entry number ${idx + 1} for pagination verification.`,
    createdAt: '2026-01-15',
  }));
}
