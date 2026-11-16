import { describe, expect, it } from 'vitest';
import { checkScam, findScamSignals } from './scamRules';
import { SAMPLE_JOBS } from '../data/samples';

const CLEAN = SAMPLE_JOBS[0].text;
const SCAMMY = SAMPLE_JOBS[1].text;

describe('checkScam', () => {
  it('marks the clean sample green with no signals', () => {
    const verdict = checkScam(CLEAN);
    expect(verdict.level).toBe('green');
    expect(verdict.signals).toHaveLength(0);
  });

  it('marks the scammy sample red with several signals', () => {
    const verdict = checkScam(SCAMMY);
    expect(verdict.level).toBe('red');
    const ids = verdict.signals.map((s) => s.id);
    expect(ids).toContain('fee-demand');
    expect(ids).toContain('telegram-whatsapp-only');
    expect(ids).toContain('free-gmail-hr');
    expect(ids).toContain('form-filling');
    expect(ids).toContain('unrealistic-pay');
    expect(ids).toContain('vague-listing');
  });

  it('quotes the exact evidence from the posting', () => {
    const signals = findScamSignals(SCAMMY);
    const fee = signals.find((s) => s.id === 'fee-demand');
    expect(fee).toBeDefined();
    expect(SCAMMY.toLowerCase()).toContain(fee!.evidence.toLowerCase());
  });

  it('flags a fee demand alone as red', () => {
    const verdict = checkScam(
      'Customer support role. Pay a registration fee of Rs. 2,000 to start.',
    );
    expect(verdict.level).toBe('red');
    expect(verdict.signals.map((s) => s.id)).toContain('fee-demand');
  });

  it('flags Telegram-only recruitment alone as red', () => {
    const verdict = checkScam(
      'We are hiring data entry operators. Apply only on WhatsApp, message us there.',
    );
    expect(verdict.level).toBe('red');
    expect(verdict.signals.map((s) => s.id)).toContain('telegram-whatsapp-only');
  });

  it('flags MLM / commission-only as red', () => {
    const verdict = checkScam(
      'Earn big with our team. Commission-only role, recruit members and earn per joining.',
    );
    expect(verdict.level).toBe('red');
    expect(verdict.signals.map((s) => s.id)).toContain('mlm-commission');
  });

  it('flags a free-Gmail HR contact alone as amber, not red', () => {
    const verdict = checkScam(
      'Support executive role at a startup. Send your CV to hiring.team@gmail.com.',
    );
    expect(verdict.level).toBe('amber');
    expect(verdict.signals.map((s) => s.id)).toContain('free-gmail-hr');
  });

  it('does not flag a company-domain email', () => {
    const verdict = checkScam(
      'Support executive role. Apply at careers@northwind.example.com.',
    );
    expect(verdict.level).toBe('green');
  });

  it('does not flag a normal posting that mentions WhatsApp as one channel', () => {
    const verdict = checkScam(
      'Customer Support Associate. Apply on our careers page or reach us on WhatsApp for questions.',
    );
    // "reach us on WhatsApp" is not an apply-only pattern.
    expect(verdict.level).toBe('green');
  });
});
