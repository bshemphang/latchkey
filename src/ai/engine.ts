/**
 * Hybrid inference engine.
 *
 * The core of Latchkey. Every AI task is routed by privacy, not just by
 * availability (see ./router.ts): on-device tasks touch the user's own data,
 * cloud tasks do the long-context heavy work. The engine calls Firebase AI
 * Logic for real (getAI + getGenerativeModel with InferenceMode) once the
 * Firebase project is wired, and runs a deterministic mock layer until then.
 *
 * Real path (configured):
 *   const ai = getAI(app, { backend: new GoogleAIBackend() })
 *   const model = getGenerativeModel(ai, {
 *     mode: InferenceMode.PREFER_ON_DEVICE,   // or PREFER_IN_CLOUD
 *     inCloudParams: { model: 'gemini-3.8-flash' },
 *   })
 *   await model.initializeDeviceModel(onProgress)   // after a user gesture
 *   const result = await model.generateContent(prompt)
 *   result.response.inferenceSource // 'on_device' | 'in_cloud'
 *
 * Mock path (not configured): deterministic results from the same rule sets
 * the on-device model is prompted with, with simulated latency, labelled
 * mock-on-device / mock-cloud so the demo is honest about what ran.
 */

import {
  getGenerativeModel,
  InferenceMode,
  type GenerativeModel,
} from 'firebase/ai';
import { getAIClient, isFirebaseConfigured } from '../config/firebase';
import { getThresholds } from '../config/remote';
import { routeTask } from './router';
import { runMockTask, type MockInput } from './mock';
import {
  buildBulletsPrompt,
  buildDeepPrompt,
  buildExtractionPrompt,
  buildInterviewPrompt,
  buildLetterPrompt,
  buildNotePrompt,
  buildScamPrompt,
  parseExtractionJson,
} from './prompts';
import { checkScam } from './scamRules';
import type {
  AIResult,
  AITask,
  CandidateProfile,
  DeepAnalysis,
  InferenceSourceLabel,
  InterviewQA,
  JobExtraction,
  ScamVerdict,
} from './types';

export interface EngineStatus {
  /** True once the Firebase web config is present. */
  configured: boolean;
  /** Browser online state. */
  online: boolean;
  /** Gemini Nano availability: null = not checked yet. */
  nanoAvailable: boolean | null;
  /** 0-1 while the on-device model downloads, null otherwise. */
  nanoDownloadProgress: number | null;
}

export interface GenerateInput extends MockInput {
  profile?: CandidateProfile;
  extraction?: JobExtraction;
  /** Data URL of an uploaded job-post photo (JPEG/PNG). */
  imageDataUrl?: string;
  /** The user explicitly allows their profile to be sent to the cloud. */
  cloudProfileOptIn?: boolean;
}

function parseJsonLoose<T>(text: string): T {
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in response.');
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

/**
 * True for transient cloud failures (capacity spikes, deadlines) that are
 * worth retrying. Auth, App Check, and model-availability errors are NOT
 * transient: retrying them only burns quota. The SDK reports the HTTP
 * status in brackets, e.g. "[500 Internal Server Error] This model is
 * currently experiencing high demand."
 */
export function isTransientCloudError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/\[400|\[401|\[403|\[404/.test(message)) return false;
  return /\[500|\[502|\[503|\[504|high demand|Deadline expired|overloaded|temporarily unavailable/i.test(
    message,
  );
}

export class HybridEngine {
  private nanoAvailable: boolean | null = null;
  private nanoDownloadProgress: number | null = null;
  private deviceModel: GenerativeModel | null = null;
  private cloudModel: GenerativeModel | null = null;
  /** Simulated Nano availability while running in mock/demo mode. */
  private mockNano = true;

  get configured(): boolean {
    return isFirebaseConfigured();
  }

  get online(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }

  get status(): EngineStatus {
    return {
      configured: this.configured,
      online: this.online,
      nanoAvailable: this.configured ? this.nanoAvailable : this.mockNano,
      nanoDownloadProgress: this.nanoDownloadProgress,
    };
  }

  /** Demo-mode toggle: pretend Nano is / is not available, to preview fallback. */
  setMockNano(available: boolean): void {
    this.mockNano = available;
  }

  private async getModel(
    mode: 'on-device' | 'cloud',
    cloudModelName: string,
  ): Promise<GenerativeModel> {
    const ai = getAIClient();
    if (!ai) throw new Error('Firebase AI Logic is not configured.');
    if (mode === 'on-device') {
      if (!this.deviceModel) {
        this.deviceModel = getGenerativeModel(ai, {
          mode: InferenceMode.PREFER_ON_DEVICE,
          inCloudParams: { model: cloudModelName },
        });
      }
      return this.deviceModel;
    }
    if (!this.cloudModel) {
      this.cloudModel = getGenerativeModel(ai, {
        mode: InferenceMode.PREFER_IN_CLOUD,
        inCloudParams: { model: cloudModelName },
      });
    }
    return this.cloudModel;
  }

  /**
   * Download / initialise the on-device model. Must be called after a user
   * gesture (every call site in the UI is a button click). In demo mode this
   * simulates the download progress.
   */
  async ensureDeviceModel(
    onProgress?: (progress: number) => void,
  ): Promise<boolean> {
    if (!this.configured) {
      this.nanoDownloadProgress = 0;
      onProgress?.(0);
      for (let p = 0.2; p <= 1; p += 0.2) {
        await new Promise((r) => setTimeout(r, 120));
        this.nanoDownloadProgress = p;
        onProgress?.(p);
      }
      this.nanoAvailable = this.mockNano;
      this.nanoDownloadProgress = null;
      return this.mockNano;
    }
    try {
      const thresholds = await getThresholds();
      const model = await this.getModel('on-device', thresholds.cloudModel);
      await model.initializeDeviceModel((progress) => {
        this.nanoDownloadProgress = progress;
        onProgress?.(progress);
      });
      this.nanoAvailable = true;
      this.nanoDownloadProgress = null;
      return true;
    } catch {
      this.nanoAvailable = false;
      this.nanoDownloadProgress = null;
      return false;
    }
  }

  private promptFor(task: AITask, input: GenerateInput): string {
    switch (task) {
      case 'extract':
        return buildExtractionPrompt(input.jdText ?? '');
      case 'scam':
        return buildScamPrompt(input.jdText ?? '');
      case 'bullets':
        return buildBulletsPrompt(input.profile!, input.extraction!);
      case 'note':
        return buildNotePrompt(input.profile!, input.extraction!);
      case 'deep':
        return buildDeepPrompt(input.profile!, input.extraction!, input.jdText ?? '');
      case 'interview':
        return buildInterviewPrompt(input.profile!, input.extraction!, input.jdText ?? '');
      case 'letter':
        return buildLetterPrompt(input.profile!, input.extraction!, input.jdText ?? '');
    }
  }

  private parseRealResponse(task: AITask, text: string, input: GenerateInput): unknown {
    switch (task) {
      case 'extract': {
        const parsed = parseExtractionJson(text);
        if (!parsed.ok) throw new Error(`Extraction failed: ${parsed.error}`);
        return parsed.data;
      }
      case 'scam': {
        try {
          return parseJsonLoose<ScamVerdict>(text);
        } catch {
          // Degraded path: fall back to the deterministic rule engine.
          return checkScam(input.jdText ?? '');
        }
      }
      case 'bullets':
        return (parseJsonLoose<{ bullets: string[] }>(text).bullets ?? []).slice(0, 6);
      case 'note':
      case 'letter':
        return text.trim();
      case 'deep':
        return parseJsonLoose<DeepAnalysis>(text);
      case 'interview':
        return (parseJsonLoose<{ qa: InterviewQA[] }>(text).qa ?? []).slice(0, 5);
    }
  }

  /**
   * One generateContent call, retried (max 3 attempts, 2s then 4s backoff)
   * when the cloud reports a transient capacity/deadline error. The new
   * cloud model is capacity-constrained at launch, so a single spike must
   * not fail the whole analysis. Auth/App Check/404 errors throw at once.
   */
  private async generateWithRetry(
    model: GenerativeModel,
    task: AITask,
    input: GenerateInput,
    prompt: string,
  ) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (task === 'extract' && input.imageDataUrl) {
          const [header, data] = input.imageDataUrl.split(',');
          const mimeType =
            header?.match(/data:(.*);base64/)?.[1] ?? 'image/jpeg';
          return await model.generateContent([
            { type: 'text', text: prompt },
            { type: 'inlineData', inlineData: { mimeType, data: data ?? '' } },
          ]);
        }
        return await model.generateContent(prompt);
      } catch (e) {
        lastError = e;
        if (attempt < 2 && isTransientCloudError(e)) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    throw lastError;
  }

  /**
   * Run one single-turn task. Routes by policy, then runs the real Firebase
   * AI Logic call when configured, otherwise the mock layer. The returned
   * result always says where it ran and how long it took.
   */
  async generate<T>(task: AITask, input: GenerateInput): Promise<AIResult<T>> {
    const thresholds = await getThresholds();
    const nanoAvailable = this.configured
      ? (this.nanoAvailable ?? false)
      : this.mockNano;
    const decision = routeTask(task, {
      nanoAvailable,
      online: this.online,
      jdLength: (input.jdText ?? '').length,
      thresholds,
    });
    if (decision.blocked) {
      throw new Error(
        'This feature needs the cloud, and you are offline. On-device features still work.',
      );
    }

    if (!this.configured) {
      const result = await runMockTask<T>(
        task,
        decision.mode,
        input,
        thresholds,
      );
      if (decision.fallback) result.fallback = true;
      return result;
    }

    // Real Firebase AI Logic path.
    const started = performance.now();
    const model = await this.getModel(decision.mode, thresholds.cloudModel);
    if (decision.mode === 'on-device' && this.nanoAvailable !== true) {
      await this.ensureDeviceModel();
    }
    const prompt = this.promptFor(task, input);
    const result = await this.generateWithRetry(model, task, input, prompt);
    const text = result.response.text();
    const rawSource = result.response.inferenceSource;
    const source: InferenceSourceLabel =
      rawSource === 'on_device' ? 'on-device' : 'cloud';
    const data = this.parseRealResponse(task, text, input);
    return {
      data: data as T,
      source,
      latencyMs: Math.round(performance.now() - started),
      model:
        source === 'on-device'
          ? thresholds.deviceModel
          : thresholds.cloudModel,
      fallback: decision.fallback ?? source === 'cloud',
    };
  }
}

/** Single shared engine instance for the app. */
export const engine = new HybridEngine();
