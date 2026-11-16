import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveDebugToken } from './appcheck';

describe('resolveDebugToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the registered debug token from the environment when present', () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_DEBUG_TOKEN', 'TEST-TOKEN-123');
    expect(resolveDebugToken()).toBe('TEST-TOKEN-123');
  });

  it('falls back to true (SDK prints a fresh token) when no token is set', () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_DEBUG_TOKEN', '');
    expect(resolveDebugToken()).toBe(true);
  });
});
