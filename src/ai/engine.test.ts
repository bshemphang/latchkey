import { describe, expect, it } from 'vitest';
import { isTransientCloudError } from './engine';

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
