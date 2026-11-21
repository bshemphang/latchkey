/**
 * The main analysis flow:
 *   paste a job post (or upload a photo) -> extraction + scam check
 *   (on-device) -> resume bullets + short note (on-device) -> deep analysis,
 *   interview prep, cover letter (cloud, profile opt-in) -> save to tracker.
 *
 * Every AI result shows its inference badge and latency.
 */

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Cloud,
  Copy,
  Cpu,
  FileText,
  ImagePlus,
  ListChecks,
  MapPin,
  MessageSquare,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { engine } from '../ai/engine';
import { routeTask } from '../ai/router';
import { getThresholds } from '../config/remote';
import type {
  AIResult,
  CandidateProfile,
  DeepAnalysis,
  InterviewQA,
  JobExtraction,
  ScamVerdict,
} from '../ai/types';
import { addApplication } from '../store/tracker';
import { SAMPLE_JOBS } from '../data/samples';
import {
  Card,
  GhostButton,
  PrimaryButton,
  SectionHeading,
  SourceBadge,
  Spinner,
} from './components';
import { useEngineStatus } from './useEngineStatus';

type Running = 'analyze' | 'bullets' | 'note' | 'deep' | 'interview' | 'letter' | null;

/**
 * Turn SDK errors into something a user can act on. Network failures mean
 * the AI service could not be reached at all (offline, or the browser has
 * no route to it); App Check rejections mean the Firebase setup is
 * incomplete; anything else is shown as the SDK reported it.
 */
function friendlyError(e: unknown): string {
  const message =
    e instanceof Error ? e.message : 'Analysis failed. Please try again.';
  if (/Failed to fetch|NetworkError|ERR_NETWORK|network request failed/i.test(message)) {
    return "Couldn't reach the AI service. Check your connection and try again.";
  }
  if (/timed out|took too long/i.test(message)) {
    return 'The AI service took too long to respond. Check your connection and try again.';
  }
  if (/app check/i.test(message) && /\[401|\[403|invalid|rejected/i.test(message)) {
    return 'App Check rejected this request. The reCAPTCHA site key may be missing or not registered in the Firebase console yet.';
  }
  return message;
}

/** Photo uploads: only formats Gemini inlineData accepts, capped at 4 MB. */
const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard unavailable
        }
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
    >
      <Copy className="h-3.5 w-3.5" />
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function JobAnalyzer({
  profile,
  onSaved,
}: {
  profile: CandidateProfile;
  onSaved: () => void;
}) {
  const { status, refresh } = useEngineStatus();
  const [jdText, setJdText] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  const [extraction, setExtraction] = useState<AIResult<JobExtraction> | null>(null);
  const [scam, setScam] = useState<AIResult<ScamVerdict> | null>(null);
  const [bullets, setBullets] = useState<AIResult<string[]> | null>(null);
  const [note, setNote] = useState<AIResult<string> | null>(null);
  const [deep, setDeep] = useState<AIResult<DeepAnalysis> | null>(null);
  const [interview, setInterview] = useState<AIResult<InterviewQA[]> | null>(null);
  const [letter, setLetter] = useState<AIResult<string> | null>(null);
  const [running, setRunning] = useState<Running>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [scamError, setScamError] = useState<string | null>(null);
  /** Photo-only upload: the scam check needs posting text, which a photo has not produced yet. */
  const [scamUnavailable, setScamUnavailable] = useState(false);
  const [cloudOptIn, setCloudOptIn] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nanoProgress, setNanoProgress] = useState<number | null>(null);
  const [nanoMessage, setNanoMessage] = useState<string | null>(null);
  /** Where the current analyse run is actually executing, for the spinner label. */
  const [analyseRoute, setAnalyseRoute] = useState<'on-device' | 'cloud' | null>(null);
  /** Remote Config feature flag for photo upload (defaults on). */
  const [photoEnabled, setPhotoEnabled] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void getThresholds().then((t) => {
      if (!cancelled) setPhotoEnabled(t.photoUploadEnabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canAnalyse = (jdText.trim().length >= 20 || imageDataUrl !== null) && running === null;
  const hasExtraction = extraction !== null;
  const photoOnly = imageDataUrl !== null && jdText.trim().length === 0;

  function loadSample(index: number) {
    const sample = SAMPLE_JOBS[index];
    if (!sample) return;
    setJdText(sample.text);
    setImageDataUrl(null);
    setImageName('');
    setExtraction(null);
    setScam(null);
    setBullets(null);
    setNote(null);
    setDeep(null);
    setInterview(null);
    setLetter(null);
    setSaved(false);
    setError(null);
    setExtractError(null);
    setScamError(null);
    setScamUnavailable(false);
    setNanoMessage(null);
  }

  async function handleImage(file: File) {
    if (!PHOTO_MIME_TYPES.includes(file.type)) {
      setError('Please upload a JPEG, PNG, or WebP photo of the job posting.');
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError('That photo is over 4 MB. Please use a smaller photo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result));
      setImageName(file.name);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function handleAnalyse() {
    setError(null);
    setExtractError(null);
    setScamError(null);
    setScamUnavailable(false);
    setRunning('analyze');
    setSaved(false);
    // A new run supersedes the previous results; clear them upfront so a
    // failed extraction never leaves stale bullets/notes on screen.
    setBullets(null);
    setNote(null);
    setDeep(null);
    setInterview(null);
    setLetter(null);
    // Derive the spinner label from the actual route decision for the
    // extraction task, so it never claims "on-device" while a cloud call runs.
    try {
      const thresholds = await getThresholds();
      const decision = routeTask('extract', {
        nanoAvailable: status.nanoAvailable ?? false,
        online: status.online,
        jdLength: jdText.length,
        thresholds,
      });
      setAnalyseRoute(decision.mode);
    } catch {
      setAnalyseRoute(null);
    }
    try {
      if (photoOnly) {
        // A photo has no posting text yet: run extraction only. The scam
        // check needs the text, so it waits instead of green-lighting
        // an empty posting.
        const ex = await engine.generate<JobExtraction>('extract', {
          jdText,
          imageDataUrl: imageDataUrl ?? undefined,
        });
        setExtraction(ex);
        setScam(null);
        setScamUnavailable(true);
      } else {
        // One task failing must not throw away the other's success.
        const [ex, sc] = await Promise.allSettled([
          engine.generate<JobExtraction>('extract', { jdText, imageDataUrl: imageDataUrl ?? undefined }),
          engine.generate<ScamVerdict>('scam', { jdText }),
        ]);
        if (ex.status === 'fulfilled') {
          setExtraction(ex.value);
        } else {
          setExtractError(friendlyError(ex.reason));
        }
        if (sc.status === 'fulfilled') {
          setScam(sc.value);
        } else {
          setScamError(friendlyError(sc.reason));
        }
        if (ex.status === 'rejected' && sc.status === 'rejected') {
          setError(friendlyError(ex.reason));
        }
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setRunning(null);
      setAnalyseRoute(null);
      refresh();
    }
  }

  async function retryExtract() {
    setExtractError(null);
    setRunning('analyze');
    try {
      const ex = await engine.generate<JobExtraction>('extract', {
        jdText,
        imageDataUrl: imageDataUrl ?? undefined,
      });
      setExtraction(ex);
    } catch (e) {
      setExtractError(friendlyError(e));
    } finally {
      setRunning(null);
      refresh();
    }
  }

  async function retryScam() {
    if (!jdText.trim()) return;
    setScamError(null);
    setRunning('analyze');
    try {
      const sc = await engine.generate<ScamVerdict>('scam', { jdText });
      setScam(sc);
    } catch (e) {
      setScamError(friendlyError(e));
    } finally {
      setRunning(null);
      refresh();
    }
  }

  async function runTask<T>(
    task: 'bullets' | 'note' | 'deep' | 'interview' | 'letter',
    setter: (r: AIResult<T> | null) => void,
  ) {
    if (!extraction) return;
    setError(null);
    setRunning(task);
    try {
      const result = await engine.generate<T>(task, {
        jdText,
        profile,
        extraction: extraction.data,
        cloudProfileOptIn: cloudOptIn,
      });
      setter(result);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setRunning(null);
      refresh();
    }
  }

  async function handleNanoSetup() {
    setNanoProgress(0);
    setNanoMessage(null);
    const result = await engine.ensureDeviceModel((p) => setNanoProgress(p));
    setNanoProgress(null);
    if (result.ok) {
      setNanoMessage('On-device AI is ready.');
    } else {
      setNanoMessage(
        `Gemini Nano could not be set up: ${result.reason ?? 'not available on this device.'} Cloud fallback is active.`,
      );
    }
    refresh();
  }

  function handleSave() {
    if (!extraction) return;
    addApplication({
      role: extraction.data.role,
      company: extraction.data.company,
      deadline: extraction.data.deadline,
      scamLevel: scam?.data.level ?? 'green',
    });
    setSaved(true);
    onSaved();
  }

  const scamLevel = scam?.data.level ?? 'green';

  return (
    <div className="space-y-6">
      {/* Nano setup strip */}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Cpu className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-stone-900">
              On-device AI: {status.nanoAvailable ? 'ready' : 'not set up yet'}
            </p>
            <p className="text-sm text-stone-500">
              {status.configured
                ? status.nanoAvailable
                  ? 'Gemini Nano runs in Chrome on this device. Your profile and the posting never leave the device for on-device tasks.'
                  : 'Gemini Nano is not set up on this device yet, so tasks run in the cloud with a visible badge. Profile tasks stay blocked until you allow cloud use.'
                : 'Demo mode: Nano is simulated until the Firebase project is connected. The routing and badges work the same way.'}
            </p>
            {nanoMessage && (
              <p className="mt-1 text-sm text-stone-600">{nanoMessage}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!status.configured && (
            <button
              type="button"
              onClick={() => engine.setMockNano(!status.nanoAvailable)}
              className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
            >
              Simulate Nano {status.nanoAvailable ? 'unavailable' : 'available'}
            </button>
          )}
          <PrimaryButton onClick={handleNanoSetup} disabled={nanoProgress !== null}>
            {nanoProgress !== null ? (
              <>
                <Spinner /> Downloading {Math.round(nanoProgress * 100)}%
              </>
            ) : (
              'Set up on-device AI'
            )}
          </PrimaryButton>
        </div>
      </Card>

      {/* Input */}
      <Card className="p-5">
        <SectionHeading
          title="Paste a job posting"
          subtitle={
            status.nanoAvailable
              ? 'Or upload a photo of one. Extraction and the scam check run on your device, so the posting text never leaves it.'
              : 'Or upload a photo of one. Extraction and the scam check run on-device once Nano is set up; until then they run in the cloud and the badge says so.'
          }
        />
        <div className="mb-3 flex flex-wrap gap-2">
          {SAMPLE_JOBS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => loadSample(i)}
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              Try sample: {s.label}
            </button>
          ))}
        </div>
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          rows={9}
          placeholder="Paste the full job posting here..."
          className="w-full rounded-xl border border-stone-300 bg-white p-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImage(f);
            }}
          />
          <GhostButton
            onClick={() => fileRef.current?.click()}
            disabled={!photoEnabled}
          >
            <ImagePlus className="h-4 w-4" /> Upload a photo
          </GhostButton>
          {!photoEnabled && (
            <span className="text-xs text-stone-500">Photo upload is off.</span>
          )}
          {imageName && (
            <span className="text-xs font-medium text-stone-500">
              {imageName} attached
            </span>
          )}
          <span className="flex-1" />
          <PrimaryButton onClick={handleAnalyse} disabled={!canAnalyse}>
            {running === 'analyze' ? (
              <>
                <Spinner />{' '}
                {analyseRoute === 'cloud'
                  ? 'Analysing in the cloud...'
                  : 'Analysing on-device...'}
              </>
            ) : (
              <>
                <Search className="h-4 w-4" /> Analyse posting
              </>
            )}
          </PrimaryButton>
        </div>
        {imageDataUrl && (
          <div className="mt-3">
            <img
              src={imageDataUrl}
              alt="Uploaded job posting"
              className="max-h-56 rounded-xl border border-stone-200 object-contain"
            />
          </div>
        )}
        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}
      </Card>

      {/* Extraction + scam */}
      {(hasExtraction || extractError || scamError || scamUnavailable) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {extraction ? (
          <Card className="p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <SectionHeading title="What the posting says" />
              <SourceBadge source={extraction.source} latencyMs={extraction.latencyMs} fallback={extraction.fallback} />
            </div>
            <dl className="space-y-2.5 text-sm">
              <div className="flex gap-2"><Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" /><div><dt className="font-semibold text-stone-900">{extraction.data.role}</dt><dd className="text-stone-500">{extraction.data.summary}</dd></div></div>
              <div className="flex gap-2"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" /><div><dt className="font-medium text-stone-700">Company</dt><dd className="text-stone-500">{extraction.data.company}</dd></div></div>
              <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" /><div><dt className="font-medium text-stone-700">Location</dt><dd className="text-stone-500">{extraction.data.location}{extraction.data.remoteEligible ? ' · remote eligible' : ''}</dd></div></div>
              <div className="flex gap-2"><Banknote className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" /><div><dt className="font-medium text-stone-700">Salary hint</dt><dd className="text-stone-500">{extraction.data.salaryHint}</dd></div></div>
              <div className="flex gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" /><div><dt className="font-medium text-stone-700">Deadline</dt><dd className="text-stone-500">{extraction.data.deadline}</dd></div></div>
            </dl>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Must-have skills</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {extraction.data.mustHaveSkills.length === 0 && <span className="text-sm text-stone-400">None detected</span>}
                {extraction.data.mustHaveSkills.map((s) => (
                  <span key={s} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">{s}</span>
                ))}
              </div>
              {extraction.data.niceToHaveSkills.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Nice to have</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {extraction.data.niceToHaveSkills.map((s) => (
                      <span key={s} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">{s}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <PrimaryButton onClick={handleSave} disabled={saved}>
                <Save className="h-4 w-4" /> {saved ? 'Saved to tracker' : 'Save to tracker'}
              </PrimaryButton>
            </div>
          </Card>
          ) : (
          <Card className="p-5">
            <SectionHeading title="What the posting says" />
            <p className="text-sm text-red-700">{extractError}</p>
            <div className="mt-3">
              <GhostButton onClick={() => void retryExtract()} disabled={running !== null}>
                <RotateCcw className="h-4 w-4" /> Retry extraction
              </GhostButton>
            </div>
          </Card>
          )}

          {scam ? (
          <Card className="p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <SectionHeading
                title="Scam check"
                subtitle={
                  scam.source === 'on-device' || scam.source === 'mock-on-device'
                    ? 'Runs on-device, instantly.'
                    : 'Ran in the cloud.'
                }
              />
              <SourceBadge source={scam.source} latencyMs={scam.latencyMs} fallback={scam.fallback} />
            </div>
            <div
              className={`flex items-start gap-3 rounded-xl p-3.5 ${
                scamLevel === 'green'
                  ? 'bg-emerald-50 text-emerald-900'
                  : scamLevel === 'amber'
                    ? 'bg-amber-50 text-amber-900'
                    : 'bg-red-50 text-red-900'
              }`}
            >
              {scamLevel === 'green' ? (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              ) : scamLevel === 'amber' ? (
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {scamLevel === 'green'
                    ? 'Looks clean'
                    : scamLevel === 'amber'
                      ? 'Proceed with caution'
                      : 'Do not apply or pay anything'}
                </p>
                <p className="mt-0.5 text-sm opacity-90">{scam.data.explanation}</p>
              </div>
            </div>
            {scam.data.signals.length > 0 && (
              <ul className="mt-3 space-y-2">
                {scam.data.signals.map((s) => (
                  <li key={s.id} className="rounded-xl border border-stone-200 px-3 py-2 text-sm">
                    <span className="font-semibold text-stone-800">{s.label}</span>
                    <span className="block text-stone-500">“{s.evidence}”</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          ) : scamError ? (
          <Card className="p-5">
            <SectionHeading title="Scam check" />
            <p className="text-sm text-red-700">{scamError}</p>
            <div className="mt-3">
              <GhostButton onClick={() => void retryScam()} disabled={running !== null}>
                <RotateCcw className="h-4 w-4" /> Retry scam check
              </GhostButton>
            </div>
          </Card>
          ) : scamUnavailable ? (
          <Card className="p-5">
            <SectionHeading title="Scam check" />
            <p className="text-sm text-stone-600">
              Scam check needs the posting text. Paste the posting text to run it.
            </p>
          </Card>
          ) : null}
        </div>
      )}

      {/* On-device tailoring */}
      {hasExtraction && (
        <Card className="p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <SectionHeading
              title="Tailor my application"
              subtitle={
                status.nanoAvailable
                  ? 'Built on-device from your stored profile. Your profile never leaves this device for these.'
                  : 'Built from your stored profile. On-device AI is not set up, so these run in the cloud only if you allow it in the cloud section below, and stay blocked otherwise.'
              }
            />
            {status.nanoAvailable ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                <Cpu className="h-3.5 w-3.5" /> On-device
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                <Cloud className="h-3.5 w-3.5" /> Cloud, opt-in only
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton
              onClick={() => void runTask<string[]>('bullets', setBullets)}
              disabled={running !== null}
            >
              {running === 'bullets' ? <><Spinner /> Writing bullets...</> : <><ListChecks className="h-4 w-4" /> Resume bullets</>}
            </PrimaryButton>
            <GhostButton
              onClick={() => void runTask<string>('note', setNote)}
              disabled={running !== null}
            >
              {running === 'note' ? <><Spinner /> Writing note...</> : <><MessageSquare className="h-4 w-4" /> Short cover note</>}
            </GhostButton>
          </div>
          {bullets && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <SourceBadge source={bullets.source} latencyMs={bullets.latencyMs} fallback={bullets.fallback} />
                <CopyButton text={bullets.data.map((b) => `• ${b}`).join('\n')} />
              </div>
              <ul className="space-y-2">
                {bullets.data.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm text-stone-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {note && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <SourceBadge source={note.source} latencyMs={note.latencyMs} fallback={note.fallback} />
                <CopyButton text={note.data} />
              </div>
              <p className="rounded-xl bg-stone-50 p-3 text-sm leading-relaxed text-stone-700">{note.data}</p>
            </div>
          )}
        </Card>
      )}

      {/* Cloud features */}
      {hasExtraction && (
        <Card className="p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <SectionHeading
              title="Deep work, in the cloud"
              subtitle="Long-context analysis runs on Gemini in the cloud. The job posting is public text; your profile is sent only if you allow it."
            />
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
              <Cloud className="h-3.5 w-3.5" /> Cloud
            </span>
          </div>
          <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm">
            <input
              type="checkbox"
              checked={cloudOptIn}
              onChange={(e) => setCloudOptIn(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-amber-600"
            />
            <span className="text-stone-700">
              <span className="font-semibold">Allow my profile to be sent to the cloud</span> for deep
              analysis, interview prep, and the cover letter. Without this, these features stay
              off. You can switch it off any time.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton
              onClick={() => void runTask<DeepAnalysis>('deep', setDeep)}
              disabled={running !== null || !cloudOptIn}
            >
              {running === 'deep' ? <><Spinner /> Analysing fit...</> : <><Sparkles className="h-4 w-4" /> Deep match analysis</>}
            </PrimaryButton>
            <GhostButton
              onClick={() => void runTask<InterviewQA[]>('interview', setInterview)}
              disabled={running !== null || !cloudOptIn}
            >
              {running === 'interview' ? <><Spinner /> Preparing questions...</> : <><MessageSquare className="h-4 w-4" /> Interview prep</>}
            </GhostButton>
            <GhostButton
              onClick={() => void runTask<string>('letter', setLetter)}
              disabled={running !== null || !cloudOptIn}
            >
              {running === 'letter' ? <><Spinner /> Writing letter...</> : <><FileText className="h-4 w-4" /> Full cover letter</>}
            </GhostButton>
          </div>
          {!cloudOptIn && (
            <p className="mt-3 text-sm text-stone-500">
              Turn on the checkbox above to use the cloud features. Your profile stays on this
              device until you do.
            </p>
          )}
          {deep && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <SourceBadge source={deep.source} latencyMs={deep.latencyMs} fallback={deep.fallback} />
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display text-4xl font-bold text-stone-900">{deep.data.fitScore}</span>
                <span className="text-sm text-stone-500">/ 100 fit score</span>
              </div>
              <p className="mt-1 text-sm text-stone-700">{deep.data.verdict}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Strengths</p>
                  <ul className="mt-1 space-y-1 text-sm text-stone-700">
                    {deep.data.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Gaps</p>
                  <ul className="mt-1 space-y-1 text-sm text-stone-700">
                    {deep.data.gaps.length === 0 ? <li>None found.</li> : deep.data.gaps.map((s, i) => <li key={i}>• {s}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Learn next</p>
                  <ul className="mt-1 space-y-1 text-sm text-stone-700">
                    {deep.data.learnNext.length === 0 ? <li>Nothing urgent.</li> : deep.data.learnNext.map((s, i) => <li key={i}>• {s}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}
          {interview && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <SourceBadge source={interview.source} latencyMs={interview.latencyMs} fallback={interview.fallback} />
              </div>
              <div className="space-y-3">
                {interview.data.map((qa, i) => (
                  <div key={i} className="rounded-xl border border-stone-200 p-3">
                    <p className="text-sm font-semibold text-stone-900">Q{i + 1}. {qa.question}</p>
                    <p className="mt-1 text-sm leading-relaxed text-stone-600">{qa.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {letter && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <SourceBadge source={letter.source} latencyMs={letter.latencyMs} fallback={letter.fallback} />
                <CopyButton text={letter.data} />
              </div>
              <p className="whitespace-pre-line rounded-xl bg-stone-50 p-4 text-sm leading-relaxed text-stone-700">{letter.data}</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
