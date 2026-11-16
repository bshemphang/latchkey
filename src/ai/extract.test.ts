import { describe, expect, it } from 'vitest';
import { extractJobPost } from './extract';
import { SAMPLE_JOBS } from '../data/samples';

const CLEAN = SAMPLE_JOBS[0].text;
const SCAMMY = SAMPLE_JOBS[1].text;

describe('extractJobPost', () => {
  it('extracts the clean sample', () => {
    const ex = extractJobPost(CLEAN);
    expect(ex.role).toMatch(/Customer Support Associate/i);
    expect(ex.company).toMatch(/Northwind/i);
    expect(ex.remoteEligible).toBe(true);
    expect(ex.location).toMatch(/remote/i);
    expect(ex.salaryHint).toContain('25,000');
    expect(ex.deadline).toMatch(/Dec 15, 2026/);
    expect(ex.mustHaveSkills).toEqual(
      expect.arrayContaining(['customer support', 'communication', 'excel']),
    );
    expect(ex.summary.length).toBeGreaterThan(10);
  });

  it('puts preferred skills in nice-to-have, not must-have', () => {
    const ex = extractJobPost(CLEAN);
    expect(ex.niceToHaveSkills).toEqual(
      expect.arrayContaining(['zendesk', 'html']),
    );
    expect(ex.mustHaveSkills).not.toContain('zendesk');
  });

  it('extracts the scammy sample without crashing', () => {
    const ex = extractJobPost(SCAMMY);
    expect(ex.role.length).toBeGreaterThan(3);
    expect(ex.salaryHint).not.toBe('Not stated');
    expect(ex.summary.length).toBeGreaterThan(10);
  });

  it('handles an empty posting gracefully', () => {
    const ex = extractJobPost('');
    expect(ex.role).toBe('Not stated');
    expect(ex.company).toBe('Not stated');
    expect(ex.mustHaveSkills).toEqual([]);
    expect(ex.remoteEligible).toBe(false);
  });

  it('detects a salary in dollars and LPA', () => {
    const usd = extractJobPost('Software Engineer\nSalary: $1,200 - $1,500 per month\nRemote');
    expect(usd.salaryHint).toContain('$1,200');
    const lpa = extractJobPost('Developer\nSalary: 6 LPA\nBengaluru');
    expect(lpa.salaryHint).toMatch(/6 LPA/);
    expect(lpa.location).toMatch(/bengaluru/i);
  });

  it('detects a deadline line', () => {
    const ex = extractJobPost('Designer role\nApply by: Nov 30, 2026\nRemote');
    expect(ex.deadline).toMatch(/Nov 30, 2026/);
  });
});
