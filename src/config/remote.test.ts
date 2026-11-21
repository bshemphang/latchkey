import { describe, expect, it } from 'vitest';
import { parseThresholds } from './remote';
import { DEFAULT_THRESHOLDS } from '../ai/types';

describe('parseThresholds', () => {
  it('falls back to the default when cloudMinChars is not a number', () => {
    expect(parseThresholds({ cloudMinChars: 'abc' }).cloudMinChars).toBe(
      DEFAULT_THRESHOLDS.cloudMinChars,
    );
    expect(parseThresholds({ cloudMinChars: 'NaN' }).cloudMinChars).toBe(
      DEFAULT_THRESHOLDS.cloudMinChars,
    );
    expect(parseThresholds({}).cloudMinChars).toBe(
      DEFAULT_THRESHOLDS.cloudMinChars,
    );
  });

  it('keeps a valid numeric cloudMinChars', () => {
    expect(parseThresholds({ cloudMinChars: '12000' }).cloudMinChars).toBe(12000);
  });

  it('falls back to defaults for blank model names', () => {
    const parsed = parseThresholds({ cloudModel: '  ', deviceModel: '' });
    expect(parsed.cloudModel).toBe(DEFAULT_THRESHOLDS.cloudModel);
    expect(parsed.deviceModel).toBe(DEFAULT_THRESHOLDS.deviceModel);
  });

  it('parses the photo upload flag', () => {
    expect(parseThresholds({ photoUploadEnabled: 'false' }).photoUploadEnabled).toBe(false);
    expect(parseThresholds({ photoUploadEnabled: 'true' }).photoUploadEnabled).toBe(true);
    expect(parseThresholds({}).photoUploadEnabled).toBe(true);
  });
});
