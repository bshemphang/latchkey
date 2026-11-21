import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLOUD_OPT_IN_ERROR,
  engine,
  isTransientCloudError,
  parseModelResponse,
} from './engine';
import { extractJobPost } from './extract';
import { SAMPLE_PROFILE } from '../store/profile';
import { SAMPLE_JOBS } from '../data/samples';
import type { JobExtraction } from './types';

/**
 * The test runner loads the real Firebase web config from the environment,
 * so without stubbing, generate() would take the real path and hit the
 * network. Stub the config away (demo/mock mode) and report the browser
 * online: the opt-in gate, routing, and fallback behaviour are what these
 * tests cover, not the live SDK.
 */
beforeEach(() => {
  vi.stubEnv('VITE_FIREBASE_API_KEY', '');
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', '');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
  vi.stubGlobal('navigator', { onLine: true });
  engine.setMockNano(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  engine.setMockNano(true);
});

describe('isTransientCloudError', () => {
  it('retries 500 capacity errors', () => {
    expect(
      isTransientCloudError(
        new Error(
          'AI: Error fetching from https://example.com: [500 Internal Server Error] This model is currently experiencing high demand.',
        ),
      ),
    ).toBe(true);
  });

  it('retries 503 deadline errors', () => {
    expect(
      isTransientCloudError(
        new Error('[503 Service Unavailable] Deadline expired before operation could complete.'),
      ),
    ).toBe(true);
  });

  it('does not retry auth, App Check, or model-availability errors', () => {
    expect(
      isTransientCloudError(
        new Error('[401 Unauthorized] Firebase App Check token is invalid.'),
      ),
    ).toBe(false);
    expect(
      isTransientCloudError(
        new Error('[404 Not Found] This model models/gemini-2.5-flash is no longer available.'),
      ),
    ).toBe(false);
    expect(isTransientCloudError(new Error('[403 Forbidden] API key not valid.'))).toBe(false);
  });

  it('does not retry plain network failures or non-errors', () => {
    expect(isTransientCloudError(new Error('fetch failed'))).toBe(false);
    expect(isTransientCloudError('something broke')).toBe(false);
    expect(isTransientCloudError(null)).toBe(false);
  });
});

describe('cloud profile opt-in gate', () => {
  const extraction = extractJobPost(SAMPLE_JOBS[0].text);

  it('blocks bullets in the cloud without opt-in when Nano is unavailable', async () => {
    engine.setMockNano(false);
    try {
      await expect(
        engine.generate('bullets', {
          profile: SAMPLE_PROFILE,
          extraction,
          cloudProfileOptIn: false,
        }),
      ).rejects.toThrow(CLOUD_OPT_IN_ERROR);
    } finally {
      engine.setMockNano(true);
    }
  });

  it('blocks cloud-preferred profile tasks without opt-in', async () => {
    await expect(
      engine.generate('deep', {
        profile: SAMPLE_PROFILE,
        extraction,
        cloudProfileOptIn: false,
      }),
    ).rejects.toThrow(CLOUD_OPT_IN_ERROR);
  });

  it('allows bullets in the cloud with opt-in', async () => {
    engine.setMockNano(false);
    try {
      const result = await engine.generate<string[]>('bullets', {
        profile: SAMPLE_PROFILE,
        extraction,
        cloudProfileOptIn: true,
      });
      expect(result.source).toBe('mock-cloud');
      expect(Array.isArray(result.data)).toBe(true);
    } finally {
      engine.setMockNano(true);
    }
  });

  it('still allows posting-only tasks in the cloud without opt-in', async () => {
    // The posting is public text; only the candidate profile is gated.
    engine.setMockNano(false);
    try {
      const result = await engine.generate<JobExtraction>('extract', {
        jdText: SAMPLE_JOBS[0].text,
      });
      expect(result.source).toBe('mock-cloud');
      expect(result.data.role).toBeTruthy();
    } finally {
      engine.setMockNano(true);
    }
  });
});

describe('fallback badge', () => {
  const extraction = extractJobPost(SAMPLE_JOBS[0].text);

  it('does not mark a cloud-preferred task as a fallback', async () => {
    const result = await engine.generate('deep', {
      profile: SAMPLE_PROFILE,
      extraction,
      cloudProfileOptIn: true,
    });
    expect(result.fallback).toBeFalsy();
  });

  it('marks an on-device task that fell back to the cloud', async () => {
    engine.setMockNano(false);
    try {
      const result = await engine.generate<string[]>('bullets', {
        profile: SAMPLE_PROFILE,
        extraction,
        cloudProfileOptIn: true,
      });
      expect(result.fallback).toBe(true);
    } finally {
      engine.setMockNano(true);
    }
  });
});

describe('parseModelResponse validation', () => {
  it('coerces non-array bullets to an empty list', () => {
    expect(parseModelResponse('bullets', '{"bullets": "not an array"}', {})).toEqual([]);
    expect(
      parseModelResponse('bullets', '{"bullets": ["a", 42, null, "b"]}', {}),
    ).toEqual(['a', 'b']);
  });

  it('clamps fitScore and coerces deep-analysis fields', () => {
    const data = parseModelResponse(
      'deep',
      '{"fitScore": 250, "strengths": "x", "gaps": [], "learnNext": ["a"], "verdict": 5}',
      {},
    ) as { fitScore: number; strengths: string[]; verdict: string };
    expect(data.fitScore).toBe(100);
    expect(data.strengths).toEqual([]);
    expect(data.verdict).toBe('No verdict returned.');
    const low = parseModelResponse(
      'deep',
      '{"fitScore": -20, "strengths": [], "gaps": [], "learnNext": [], "verdict": "ok"}',
      {},
    ) as { fitScore: number };
    expect(low.fitScore).toBe(0);
  });

  it('falls back to the rule engine on an unknown scam level', () => {
    const data = parseModelResponse(
      'scam',
      '{"level": "safe", "signals": [], "explanation": "looks fine"}',
      { jdText: 'Pay a registration fee of Rs 500 to apply now.' },
    ) as { level: string; signals: { id: string }[] };
    expect(data.level).toBe('red');
    expect(data.signals.some((s) => s.id === 'fee-demand')).toBe(true);
  });

  it('keeps a valid scam verdict and drops malformed signals', () => {
    const data = parseModelResponse(
      'scam',
      '{"level": "amber", "signals": [{"id": 1}], "explanation": "caution"}',
      { jdText: '' },
    ) as { level: string; signals: unknown[]; explanation: string };
    expect(data.level).toBe('amber');
    expect(data.signals).toEqual([]);
    expect(data.explanation).toBe('caution');
  });

  it('strips markdown fences from note and letter text', () => {
    expect(parseModelResponse('note', '```\nHello there.\n```', {})).toBe('Hello there.');
    expect(parseModelResponse('letter', '```text\nDear team,\n```', {})).toBe('Dear team,');
  });

  it('coerces malformed interview qa to a list', () => {
    expect(parseModelResponse('interview', '{"qa": "nope"}', {})).toEqual([]);
    expect(
      parseModelResponse(
        'interview',
        '{"qa": [{"question": "Q?", "answer": "A"}, {"question": 1, "answer": "B"}]}',
        {},
      ),
    ).toEqual([{ question: 'Q?', answer: 'A' }]);
  });
});
