/**
 * The main analysis flow:
 *   paste a job post (or upload a photo) -> extraction + scam check
 *   (on-device) -> resume bullets + short note (on-device) -> deep analysis,
 *   interview prep, cover letter (cloud, profile opt-in) -> save to tracker.
 *
 * Every AI result shows its inference badge and latency.
 */

import { useRef, useState } from 'react';
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
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { engine } from '../ai/engine';
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
  const [cloudOptIn, setCloudOptIn] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nanoProgress, setNanoProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canAnalyse = (jdText.trim().length >= 20 || imageDataUrl !== null) && running === null;
  const hasExtraction = extraction !== null;

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
  }

  async function handleImage(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a JPEG or PNG photo of the job posting.');
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
    setRunning('analyze');
    setSaved(false);
    try {
      const [ex, sc] = await Promise.all([
        engine.generate<JobExtraction>('extract', { jdText, imageDataUrl: imageDataUrl ?? undefined }),
        engine.generate<ScamVerdict>('scam', { jdText }),
      ]);
      setExtraction(ex);
      setScam(sc);
      setBullets(null);
      setNote(null);
      setDeep(null);
      setInterview(null);
      setLetter(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed. Please try again.');
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
      setError(e instanceof Error ? e.message : 'That feature failed. Please try again.');
    } finally {
      setRunning(null);
      refresh();
    }
  }

  async function handleNanoSetup() {
    setNanoProgress(0);
    await engine.ensureDeviceModel((p) => setNanoProgress(p));
    setNanoProgress(null);
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
                ? 'Gemini Nano runs in Chrome on this device. Your profile and the posting never leave the device for on-device tasks.'
                : 'Demo mode: Nano is simulated until the Firebase project is connected. The routing and badges work the same way.'}
            </p>
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
          subtitle="Or upload a photo of one. Extraction and the scam check run on your device, so the posting text never leaves it."
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
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImage(f);
            }}
          />
          <GhostButton onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-4 w-4" /> Upload a photo
          </GhostButton>
          {imageName && (
            <span className="text-xs font-medium text-stone-500">
              {imageName} attached
            </span>
          )}
          <span className="flex-1" />
          <PrimaryButton onClick={handleAnalyse} disabled={!canAnalyse}>
            {running === 'analyze' ? (
              <>
                <Spinner /> Analysing on-device...
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
      {hasExtraction && extraction && scam && (
        <div className="grid gap-6 lg:grid-cols-2">
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

          <Card className="p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <SectionHeading title="Scam check" subtitle="Runs on-device, instantly." />
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
        </div>
      )}

      {/* On-device tailoring */}
      {hasExtraction && (
        <Card className="p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <SectionHeading
              title="Tailor my application"
              subtitle="Built on-device from your stored profile. Your profile never leaves this device for these."
            />
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <Cpu className="h-3.5 w-3.5" /> On-device
            </span>
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
