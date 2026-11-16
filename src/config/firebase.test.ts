import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFirebaseConfig, isFirebaseConfigured } from './firebase';

describe('getFirebaseConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the web config when the required variables are set', () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test-app.firebaseapp.com');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-app');
    vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:abc');
    const config = getFirebaseConfig();
    expect(config).not.toBeNull();
    expect(config?.apiKey).toBe('test-key');
    expect(config?.projectId).toBe('test-app');
    expect(isFirebaseConfigured()).toBe(true);
  });

  it('returns null when any required variable is missing', () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', '');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test-app.firebaseapp.com');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-app');
    expect(getFirebaseConfig()).toBeNull();
    expect(isFirebaseConfigured()).toBe(false);
  });
});
