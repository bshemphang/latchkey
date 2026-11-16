/**
 * Application tracker store.
 *
 * Today this persists to localStorage so the board works with no backend.
 * The interface is backend-shaped on purpose: when Firebase is wired, the
 * same calls go to Firestore (collection `applications`, one document per
 * saved job, keyed by the anonymous uid) with no UI change.
 */

import type { ScamLevel, TrackerApplication } from '../ai/types';

const TRACKER_KEY = 'latchkey.tracker.v1';

export type TrackerStatus = TrackerApplication['status'];

export const TRACKER_STATUSES: { id: TrackerStatus; label: string }[] = [
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'rejected', label: 'Rejected' },
];

export function loadApplications(): TrackerApplication[] {
  try {
    const raw = localStorage.getItem(TRACKER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrackerApplication[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(apps: TrackerApplication[]): void {
  try {
    localStorage.setItem(TRACKER_KEY, JSON.stringify(apps));
  } catch {
    // ignore
  }
}

export function addApplication(input: {
  role: string;
  company: string;
  deadline?: string;
  notes?: string;
  scamLevel?: ScamLevel;
}): TrackerApplication {
  const now = Date.now();
  const app: TrackerApplication = {
    id: `app-${now}-${Math.random().toString(36).slice(2, 8)}`,
    role: input.role,
    company: input.company,
    status: 'saved',
    deadline: input.deadline ?? 'Not stated',
    notes: input.notes ?? '',
    scamLevel: input.scamLevel ?? 'green',
    createdAt: now,
    updatedAt: now,
  };
  const apps = loadApplications();
  apps.unshift(app);
  persist(apps);
  return app;
}

export function updateApplication(
  id: string,
  patch: Partial<Pick<TrackerApplication, 'status' | 'notes' | 'deadline'>>,
): TrackerApplication[] {
  const apps = loadApplications().map((a) =>
    a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a,
  );
  persist(apps);
  return apps;
}

export function removeApplication(id: string): TrackerApplication[] {
  const apps = loadApplications().filter((a) => a.id !== id);
  persist(apps);
  return apps;
}

/** Days from now until a deadline string like "Nov 30, 2026", or null. */
export function daysUntil(deadline: string): number | null {
  if (!deadline || deadline === 'Not stated') return null;
  const parsed = Date.parse(deadline);
  if (Number.isNaN(parsed)) return null;
  return Math.ceil((parsed - Date.now()) / 86_400_000);
}
