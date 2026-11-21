/**
 * Shared types for the Latchkey hybrid inference layer.
 *
 * Every AI call in the app is a single-turn generation (on-device Gemini Nano
 * does not support chat). Every result carries where it ran and how long it
 * took, so the hybrid split is visible to the user and to judges.
 */

export type AITask =
  | 'extract'
  | 'scam'
  | 'bullets'
  | 'note'
  | 'deep'
  | 'interview'
  | 'letter';

/** Where an inference actually ran. */
export type InferenceSourceLabel =
  | 'on-device' // real Gemini Nano, via Firebase AI Logic
  | 'cloud' // real Gemini in the cloud, via Firebase AI Logic
  | 'mock-on-device' // demo stand-in while the Firebase project is not wired
  | 'mock-cloud'; // demo stand-in while the Firebase project is not wired

export interface AIResult<T> {
  data: T;
  /** Where the inference ran. */
  source: InferenceSourceLabel;
  /** Wall-clock time of the call, in milliseconds. */
  latencyMs: number;
  /** Model name reported by the engine (e.g. gemini-nano, gemini-3.8-flash). */
  model: string;
  /** True when on-device was preferred but the call fell back to the cloud. */
  fallback?: boolean;
}

/** Structured job-post extraction (JSON schema output on-device). */
export interface JobExtraction {
  role: string;
  company: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  salaryHint: string;
  location: string;
  remoteEligible: boolean;
  deadline: string;
  /** Short human-readable summary of the role, one sentence. */
  summary: string;
}

export type ScamLevel = 'green' | 'amber' | 'red';

export interface ScamSignal {
  /** Machine-readable signal id, e.g. "fee-demand". */
  id: string;
  /** Short label shown in the verdict card. */
  label: string;
  /** The exact text from the posting that triggered the signal. */
  evidence: string;
}

export interface ScamVerdict {
  level: ScamLevel;
  signals: ScamSignal[];
  /** One-sentence plain-language explanation. */
  explanation: string;
}

export interface DeepAnalysis {
  fitScore: number; // 0-100
  strengths: string[];
  gaps: string[];
  learnNext: string[];
  verdict: string;
}

export interface InterviewQA {
  question: string;
  answer: string;
}

/** Minimal candidate profile. Stored locally on-device by default. */
export interface CandidateProfile {
  fullName: string;
  headline: string;
  education: string;
  skills: string[];
  experience: string[];
  projects: string[];
  languages: string[];
}

export interface TrackerApplication {
  id: string;
  /** Firebase uid that owns this document (Firestore rules enforce it). */
  uid: string;
  role: string;
  company: string;
  status: 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';
  deadline: string;
  notes: string;
  scamLevel: ScamLevel;
  createdAt: number;
  updatedAt: number;
}

/** Routing thresholds, tunable via Firebase Remote Config. */
export interface RoutingThresholds {
  /** Job descriptions longer than this go to the cloud even for on-device tasks. */
  cloudMinChars: number;
  /** Model used for cloud calls. */
  cloudModel: string;
  /** Model name shown for on-device calls. */
  deviceModel: string;
  /** Feature flag: allow photo upload of job posts. */
  photoUploadEnabled: boolean;
}

export const DEFAULT_THRESHOLDS: RoutingThresholds = {
  cloudMinChars: 6000,
  cloudModel: 'gemini-3.8-flash',
  deviceModel: 'gemini-nano',
  photoUploadEnabled: true,
};
