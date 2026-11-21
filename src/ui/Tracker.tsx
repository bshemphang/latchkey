/**
 * Application tracker board: saved jobs in a status pipeline
 * (Saved / Applied / Interview / Offer / Rejected) with deadlines.
 * Persists locally today; the store interface is shaped for Firestore.
 */

import { useEffect, useState } from 'react';
import { CalendarDays, ShieldCheck, ShieldAlert, Trash2, XCircle } from 'lucide-react';
import {
  daysUntil,
  loadApplications,
  removeApplication,
  subscribeApplications,
  TRACKER_STATUSES,
  updateApplication,
  type TrackerStatus,
} from '../store/tracker';
import type { ScamLevel } from '../ai/types';
import { Card, SectionHeading } from './components';

function ScamDot({ level }: { level: ScamLevel }) {
  if (level === 'red') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
        <XCircle className="h-3 w-3" /> Scam risk
      </span>
    );
  }
  if (level === 'amber') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
        <ShieldAlert className="h-3 w-3" /> Caution
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
      <ShieldCheck className="h-3 w-3" /> Clean
    </span>
  );
}

export function Tracker({ refreshKey }: { refreshKey: number }) {
  const [apps, setApps] = useState(() => loadApplications());
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  // Live board: Firestore pushes remote changes (and App.tsx bumps the
  // refresh key on saves). No-op subscription in demo mode.
  useEffect(() => subscribeApplications(setApps), []);

  // Reload when the parent signals a save happened elsewhere.
  const [lastKey, setLastKey] = useState(refreshKey);
  if (refreshKey !== lastKey) {
    setLastKey(refreshKey);
    setApps(loadApplications());
  }

  function changeStatus(id: string, status: TrackerStatus) {
    setApps(updateApplication(id, { status }));
  }

  function saveNotes(id: string) {
    const notes = notesDraft[id];
    if (notes === undefined) return;
    setApps(updateApplication(id, { notes }));
    setNotesDraft((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  }

  function remove(id: string) {
    setApps(removeApplication(id));
  }

  const counts = new Map<TrackerStatus, number>();
  for (const a of apps) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionHeading
          title="Your applications"
          subtitle="Saved jobs move through Saved, Applied, Interview, Offer, or Rejected. Deadlines are shown so nothing slips. Signed in, the board syncs across devices."
        />
        {apps.length === 0 && (
          <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">
            Nothing saved yet. Analyse a job posting and click “Save to tracker” to start your board.
          </p>
        )}
        <div className="space-y-3">
          {apps.map((a) => {
            const days = daysUntil(a.deadline);
            return (
              <div key={a.id} className="rounded-xl border border-stone-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{a.role}</p>
                    <p className="text-sm text-stone-500">{a.company}</p>
                  </div>
                  <ScamDot level={a.scamLevel} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={a.status}
                    onChange={(e) => changeStatus(a.id, e.target.value as TrackerStatus)}
                    className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-medium text-stone-700 focus:border-amber-600 focus:outline-none"
                    aria-label="Application status"
                  >
                    {TRACKER_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label} ({counts.get(s.id) ?? 0})
                      </option>
                    ))}
                  </select>
                  {a.deadline !== 'Not stated' && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                        days !== null && days < 0
                          ? 'bg-red-100 text-red-800'
                          : days !== null && days <= 3
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      {a.deadline}
                      {days !== null && (days < 0 ? ` · ${-days}d overdue` : ` · ${days}d left`)}
                    </span>
                  )}
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1.5 text-xs font-medium text-stone-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
                <textarea
                  value={notesDraft[a.id] ?? a.notes}
                  onChange={(e) =>
                    setNotesDraft((d) => ({ ...d, [a.id]: e.target.value }))
                  }
                  onBlur={() => saveNotes(a.id)}
                  rows={1}
                  placeholder="Notes for this application..."
                  className="mt-3 w-full rounded-lg border border-stone-200 bg-stone-50 p-2 text-sm text-stone-700 placeholder:text-stone-400 focus:border-amber-600 focus:bg-white focus:outline-none"
                />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
