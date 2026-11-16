import { describe, expect, it } from 'vitest';
import { routeTask, TASK_PREFERENCE } from './router';
import { DEFAULT_THRESHOLDS } from './types';

const base = {
  nanoAvailable: true,
  online: true,
  jdLength: 500,
  thresholds: DEFAULT_THRESHOLDS,
};

describe('routeTask', () => {
  it('sends on-device tasks on-device when Nano is available', () => {
    for (const task of ['extract', 'scam', 'bullets', 'note'] as const) {
      expect(TASK_PREFERENCE[task]).toBe('on-device');
      const d = routeTask(task, base);
      expect(d.mode).toBe('on-device');
      expect(d.blocked).toBeUndefined();
    }
  });

  it('sends cloud tasks to the cloud', () => {
    for (const task of ['deep', 'interview', 'letter'] as const) {
      expect(TASK_PREFERENCE[task]).toBe('cloud');
      const d = routeTask(task, base);
      expect(d.mode).toBe('cloud');
    }
  });

  it('routes long postings to the cloud even for on-device tasks', () => {
    const d = routeTask('extract', {
      ...base,
      jdLength: DEFAULT_THRESHOLDS.cloudMinChars + 1,
    });
    expect(d.mode).toBe('cloud');
    expect(d.fallback).toBe(true);
  });

  it('falls back to the cloud when Nano is unavailable', () => {
    const d = routeTask('scam', { ...base, nanoAvailable: false });
    expect(d.mode).toBe('cloud');
    expect(d.fallback).toBe(true);
  });

  it('blocks cloud tasks when offline but keeps on-device tasks running', () => {
    const cloud = routeTask('deep', { ...base, online: false });
    expect(cloud.blocked).toBe(true);
    const local = routeTask('extract', { ...base, online: false });
    expect(local.mode).toBe('on-device');
    expect(local.blocked).toBeUndefined();
  });
});
