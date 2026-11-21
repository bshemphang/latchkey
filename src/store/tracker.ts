/**
 * Application tracker store.
 *
 * Firestore is the source of truth when Firebase is configured: one
 * document per saved job in collection `applications`, keyed by the
 * anonymous uid, with a live onSnapshot subscription for the board.
 * localStorage is the offline cache, so the board still works with no
 * backend and updates instantly while a Firestore write is in flight.
 * In demo mode (Firebase not configured) the cache is the whole store.
 */

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import type { ScamLevel, TrackerApplication } from '../ai/types';
import { currentUid, ensureSession } from '../auth';
import { getFirestoreDb, isFirebaseConfigured } from '../config/firebase';

const TRACKER_KEY = 'latchkey.tracker.v1';

export type TrackerStatus = TrackerApplication['status'];

export const TRACKER_STATUSES: { id: TrackerStatus; label: string }[] = [
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'rejected', label: 'Rejected' },
];

function normalize(app: TrackerApplication): TrackerApplication {
  return { ...app, uid: app.uid ?? currentUid() };
}

export function loadApplications(): TrackerApplication[] {
  try {
    const raw = localStorage.getItem(TRACKER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrackerApplication[];
    return Array.isArray(parsed) ? parsed.map(normalize) : [];
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

/** Fire-and-forget Firestore write; cache is already updated, so a failure only logs. */
function syncDoc(app: TrackerApplication): void {
  if (!isFirebaseConfigured()) return;
  void (async () => {
    try {
      const session = await ensureSession();
      const db = getFirestoreDb();
      if (!db) return;
      await setDoc(doc(db, 'applications', app.id), { ...app, uid: session.uid });
    } catch (e) {
      console.warn('Latchkey: could not sync tracker to Firestore', e);
    }
  })();
}

function deleteRemoteDoc(id: string): void {
  if (!isFirebaseConfigured()) return;
  void (async () => {
    try {
      await ensureSession();
      const db = getFirestoreDb();
      if (!db) return;
      await deleteDoc(doc(db, 'applications', id));
    } catch (e) {
      console.warn('Latchkey: could not delete tracker doc in Firestore', e);
    }
  })();
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
    uid: currentUid(),
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
  syncDoc(app);
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
  const updated = apps.find((a) => a.id === id);
  if (updated) syncDoc(updated);
  return apps;
}

export function removeApplication(id: string): TrackerApplication[] {
  const apps = loadApplications().filter((a) => a.id !== id);
  persist(apps);
  deleteRemoteDoc(id);
  return apps;
}

/**
 * Subscribe to the live tracker board. When Firebase is configured, the
 * Firestore snapshot for this uid replaces the cache (remote wins on
 * conflict) and the listener is called with the merged list; local-only
 * docs that have not synced yet are kept. In demo mode this is a no-op
 * unsubscribe: the cache is the store. Returns the unsubscribe function.
 */
export function subscribeApplications(
  onChange: (apps: TrackerApplication[]) => void,
): () => void {
  if (!isFirebaseConfigured()) return () => {};
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;
  void (async () => {
    try {
      const session = await ensureSession();
      const db = getFirestoreDb();
      if (!db || cancelled) return;
      const q = query(
        collection(db, 'applications'),
        where('uid', '==', session.uid),
      );
      unsubscribe = onSnapshot(
        q,
        (snap) => {
          const remote = snap.docs.map((d) =>
            normalize(d.data() as TrackerApplication),
          );
          const local = loadApplications();
          const byId = new Map<string, TrackerApplication>();
          for (const a of local) byId.set(a.id, a);
          for (const a of remote) byId.set(a.id, a); // remote wins
          const merged = [...byId.values()].sort(
            (a, b) => b.createdAt - a.createdAt,
          );
          persist(merged);
          onChange(merged);
        },
        (e) => {
          console.warn('Latchkey: tracker subscription failed', e);
        },
      );
    } catch (e) {
      console.warn('Latchkey: could not subscribe to tracker', e);
    }
  })();
  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

/**
 * Whole calendar days from today until a deadline string like
 * "Nov 30, 2026", or null. Parsed as a LOCAL date (Date.parse of a
 * date-only string is UTC midnight, which is off by one in negative-offset
 * timezones), compared at local start-of-day.
 */
export function daysUntil(deadline: string): number | null {
  if (!deadline || deadline === 'Not stated') return null;
  const m = deadline
    .trim()
    .match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s*(\d{4}))?$/);
  if (!m) {
    const parsed = Date.parse(deadline);
    if (Number.isNaN(parsed)) return null;
    const target = new Date(parsed);
    return calendarDaysUntil(target);
  }
  const month = MONTHS.indexOf(m[1].toLowerCase().slice(0, 3));
  if (month === -1) return null;
  const year = m[3] ? Number(m[3]) : new Date().getFullYear();
  const target = new Date(year, month, Number(m[2]));
  if (Number.isNaN(target.getTime())) return null;
  return calendarDaysUntil(target);
}

function calendarDaysUntil(target: Date): number {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(target) - startOfDay(new Date())) / 86_400_000);
}
