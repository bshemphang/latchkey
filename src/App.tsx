/**
 * Latchkey — a fresher job-hunt copilot.
 *
 * Your private data is drafted on your own device (Gemini Nano) and only the
 * heavy work goes to the cloud (Gemini). Built with Firebase AI Logic
 * hybrid inference, Firestore, Auth, Remote Config, and App Check.
 */

import { useEffect, useState } from 'react';
import {
  Briefcase,
  Cloud,
  Cpu,
  KeyRound,
  ListChecks,
  Lock,
  LogIn,
  ShieldCheck,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ensureSession, signInWithGoogle, type Session } from './auth';
import { initAppCheck } from './appcheck';
import { loadProfile } from './store/profile';
import { loadApplications } from './store/tracker';
import type { CandidateProfile } from './ai/types';
import { JobAnalyzer } from './ui/JobAnalyzer';
import { Tracker } from './ui/Tracker';
import { ProfileEditor } from './ui/ProfileEditor';
import { useEngineStatus } from './ui/useEngineStatus';
import { Card } from './ui/components';

type Tab = 'analyze' | 'tracker' | 'profile';

export default function App() {
  const { status } = useEngineStatus();
  const [tab, setTab] = useState<Tab>('analyze');
  const [profile, setProfile] = useState<CandidateProfile>(() => loadProfile());
  const [trackerKey, setTrackerKey] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInNote, setSignInNote] = useState('');

  useEffect(() => {
    initAppCheck();
    ensureSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  const trackerCount = loadApplications().length;

  async function handleGoogleSignIn() {
    if (!status.configured) {
      setSignInNote('Google sign-in needs the Firebase project connected.');
      return;
    }
    setSigningIn(true);
    setSignInNote('');
    try {
      const s = await signInWithGoogle();
      setSession(s);
    } catch {
      setSignInNote('Google sign-in failed. Please try again.');
    } finally {
      setSigningIn(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'analyze', label: 'Analyse a job', icon: <Briefcase className="h-4 w-4" /> },
    { id: 'tracker', label: 'Tracker', icon: <ListChecks className="h-4 w-4" />, count: trackerCount },
    { id: 'profile', label: 'My profile', icon: <User className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#faf9f6]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <a href="#" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-amber-400">
              <KeyRound className="h-5 w-5" />
            </span>
            <span className="font-display text-2xl font-bold tracking-tight text-stone-900">
              Latchkey
            </span>
          </a>
          <span className="hidden rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 sm:inline">
            Firebase AI Logic · Hybrid Inference
          </span>
          <span className="flex-1" />
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              status.configured
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-stone-200 text-stone-700'
            }`}
            title={status.configured ? 'Firebase is connected' : 'Demo mode: Firebase not connected yet'}
          >
            {status.configured ? <Cloud className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
            {status.configured ? 'Firebase connected' : 'Demo mode'}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600"
            title={status.online ? 'Online' : 'Offline: on-device features still work'}
          >
            {status.online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {status.online ? 'Online' : 'Offline'}
          </span>
          {session && !session.isAnonymous ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <User className="h-3.5 w-3.5" /> {session.displayName ?? session.email ?? 'Signed in'}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              <LogIn className="h-3.5 w-3.5" />
              {signingIn ? 'Signing in...' : 'Sign in with Google'}
            </button>
          )}
        </div>
        {signInNote && (
          <p className="mx-auto max-w-6xl px-4 pb-2 text-xs text-stone-500">{signInNote}</p>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        {/* Hero */}
        <section className="py-10 sm:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
            Built for freshers in India · Free to use
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-stone-900 sm:text-5xl">
            Your private data stays on your device. Only the heavy work goes to
            the cloud.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-stone-600 sm:text-lg">
            Latchkey is a job-hunt copilot. Paste a posting and Gemini Nano on
            your own device extracts the details, checks it for scams, and
            tailors your resume, all without sending your data anywhere. The
            deep analysis, interview prep, and cover letter run in the cloud,
            and only with your permission.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#analyze"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
            >
              <Briefcase className="h-4 w-4" /> Analyse a job posting
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            >
              How hybrid inference works
            </a>
          </div>
        </section>

        {/* Tabs */}
        <nav className="mb-6 flex gap-2 overflow-x-auto" aria-label="Sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === t.id
                  ? 'bg-stone-900 text-white'
                  : 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {t.icon} {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                    tab === t.id ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div id="analyze">
          {tab === 'analyze' && (
            <JobAnalyzer
              profile={profile}
              onSaved={() => setTrackerKey((k) => k + 1)}
            />
          )}
          {tab === 'tracker' && <Tracker refreshKey={trackerKey} />}
          {tab === 'profile' && (
            <ProfileEditor profile={profile} onChange={setProfile} />
          )}
        </div>

        {/* How it works */}
        <section id="how-it-works" className="mt-14">
          <h2 className="font-display text-2xl font-bold text-stone-900">
            How hybrid inference works
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-500">
            Routing is driven by privacy, not just availability. Each result in
            the app carries a badge showing where it ran and how long it took.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Cpu className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-display text-lg font-semibold text-stone-900">
                On-device · Gemini Nano
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                Job-post extraction, scam detection, resume bullets, and the
                short cover note. Your profile and the posting never leave this
                device. Instant, free, and it works offline.
              </p>
            </Card>
            <Card className="p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <Cloud className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-display text-lg font-semibold text-stone-900">
                In the cloud · Gemini
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                Deep match analysis, interview questions with model answers,
                and the full cover letter. Long-context work that needs the
                cloud, and only with your explicit opt-in.
              </p>
            </Card>
            <Card className="p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Lock className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-display text-lg font-semibold text-stone-900">
                Private by routing
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                If Nano is unavailable, on-device tasks fall back to the cloud
                and the badge flips so you can see it. If you are offline, the
                cloud features pause and the on-device ones keep working.
              </p>
            </Card>
          </div>
          <Card className="mt-4 flex flex-col gap-2 p-5 sm:flex-row sm:items-center">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm leading-relaxed text-stone-600">
              <span className="font-semibold text-stone-900">No account needed.</span>{' '}
              You are signed in anonymously, and your profile is stored only on
              this device. Sign in with Google only if you want your tracker to
              sync across devices. Latchkey is free of charge.
            </p>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6">
          <p className="text-sm text-stone-500">
            <span className="font-display font-bold text-stone-900">Latchkey</span> ·
            Built with Firebase AI Logic hybrid inference (Gemini Nano on-device,
            Gemini in the cloud), Firestore, Auth, Remote Config, and App Check.
          </p>
          <p className="text-sm text-stone-500">
            Built for #BuildHybridAI 2026 ·{' '}
            <a
              className="font-semibold text-amber-700 underline"
              href="https://github.com/bshemphang/latchkey"
              target="_blank"
              rel="noreferrer"
            >
              github.com/bshemphang/latchkey
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
