/**
 * Candidate profile store: local-first.
 *
 * The profile is the user's private data. By default it lives in
 * localStorage on this device only, and it is only ever sent to an on-device
 * model. Cloud calls receive it only when the user explicitly opts in.
 */

import type { CandidateProfile } from '../ai/types';

const PROFILE_KEY = 'latchkey.profile.v1';

/** Fictional sample profile used for the one-click demo. Not a real person. */
export const SAMPLE_PROFILE: CandidateProfile = {
  fullName: 'Ananya Rao',
  headline: 'BCA graduate, fresher — customer support and web development',
  education: 'BCA, 2025',
  skills: [
    'customer support',
    'email support',
    'communication',
    'typescript',
    'react',
    'javascript',
    'html',
    'css',
    'excel',
    'documentation',
  ],
  experience: [
    'Answered customer emails and chat for a college fest helpdesk, resolving 40+ queries a day',
    'Built a small event website with React and TypeScript for the college coding club',
    'Tested a campus app and reported 12 bugs with clear reproduction steps',
  ],
  projects: [
    'Campus helpdesk site (React, TypeScript, Firebase)',
    'Personal portfolio site (Next.js, Tailwind)',
  ],
  languages: ['English', 'Hindi', 'Kannada'],
};

export function loadProfile(): CandidateProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return SAMPLE_PROFILE;
    const parsed = JSON.parse(raw) as CandidateProfile;
    if (!parsed || typeof parsed.fullName !== 'string') return SAMPLE_PROFILE;
    return parsed;
  } catch {
    return SAMPLE_PROFILE;
  }
}

export function saveProfile(profile: CandidateProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Storage full or unavailable: the in-memory copy still works.
  }
}

export function resetProfile(): CandidateProfile {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    // ignore
  }
  return SAMPLE_PROFILE;
}
