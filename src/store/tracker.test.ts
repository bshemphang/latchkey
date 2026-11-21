import { describe, expect, it } from 'vitest';
import { addApplication, daysUntil } from './tracker';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function dateString(daysFromToday: number): string {
  const d = new Date(Date.now() + daysFromToday * 86_400_000);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

describe('addApplication', () => {
  it('tags the new application with the current uid', () => {
    const app = addApplication({ role: 'Support Associate', company: 'Northwind' });
    expect(app.role).toBe('Support Associate');
    expect(app.status).toBe('saved');
    expect(typeof app.uid).toBe('string');
    expect(app.uid.length).toBeGreaterThan(0);
  });
});

describe('daysUntil', () => {
  it('counts whole calendar days', () => {
    expect(daysUntil(dateString(0))).toBe(0);
    expect(daysUntil(dateString(1))).toBe(1);
    expect(daysUntil(dateString(5))).toBe(5);
    expect(daysUntil(dateString(-1))).toBe(-1);
  });

  it('returns null for missing or unparseable deadlines', () => {
    expect(daysUntil('Not stated')).toBe(null);
    expect(daysUntil('')).toBe(null);
    expect(daysUntil('someday')).toBe(null);
  });
});
