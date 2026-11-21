import { describe, expect, it } from 'vitest';
import {
  buildBulletsPrompt,
  buildExtractionPrompt,
  buildScamPrompt,
  parseExtractionJson,
} from './prompts';
import { SAMPLE_PROFILE } from '../store/profile';
import { extractJobPost } from './extract';
import { SAMPLE_JOBS } from '../data/samples';

describe('parseExtractionJson', () => {
  it('parses clean JSON', () => {
    const json = JSON.stringify({
      role: 'Support Associate',
      company: 'Northwind',
      mustHaveSkills: ['communication'],
      niceToHaveSkills: [],
      salaryHint: 'Not stated',
      location: 'Remote',
      remoteEligible: true,
      deadline: 'Not stated',
      summary: 'Support Associate at Northwind, remote.',
    });
    const parsed = parseExtractionJson(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data.role).toBe('Support Associate');
  });

  it('parses JSON wrapped in markdown fences', () => {
    const json = '```json\n{"role":"X","company":"Y","mustHaveSkills":[],"niceToHaveSkills":[],"salaryHint":"Not stated","location":"Remote","remoteEligible":true,"deadline":"Not stated","summary":"S."}\n```';
    const parsed = parseExtractionJson(json);
    expect(parsed.ok).toBe(true);
  });

  it('rejects malformed JSON', () => {
    expect(parseExtractionJson('not json at all').ok).toBe(false);
    expect(parseExtractionJson('{"role": "X"}').ok).toBe(false);
  });

  it('coerces wrong-typed fields instead of crashing the render', () => {
    const parsed = parseExtractionJson(
      JSON.stringify({
        role: 42,
        company: 'Northwind',
        mustHaveSkills: 'communication',
        niceToHaveSkills: ['email', 7, null],
        salaryHint: 'Not stated',
        location: 'Remote',
        remoteEligible: 'true',
        deadline: 'Not stated',
        summary: 'S.',
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.role).toBe('Not stated');
      expect(parsed.data.mustHaveSkills).toEqual([]);
      expect(parsed.data.niceToHaveSkills).toEqual(['email']);
      expect(parsed.data.remoteEligible).toBe(true);
    }
  });
});

describe('prompt builders', () => {
  it('extraction and scam prompts take only the posting, never the profile', () => {
    const jd = SAMPLE_JOBS[0].text;
    const ex = buildExtractionPrompt(jd);
    const sc = buildScamPrompt(jd);
    // The candidate name must never appear in a prompt that does not take a profile.
    expect(ex).not.toContain(SAMPLE_PROFILE.fullName);
    expect(sc).not.toContain(SAMPLE_PROFILE.fullName);
    expect(ex).toContain(jd.slice(0, 40));
  });

  it('bullet and note prompts use the profile and the extraction', () => {
    const extraction = extractJobPost(SAMPLE_JOBS[0].text);
    const bullets = buildBulletsPrompt(SAMPLE_PROFILE, extraction);
    expect(bullets).toContain(SAMPLE_PROFILE.fullName);
    expect(bullets).toContain(extraction.role);
  });
});
