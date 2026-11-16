/**
 * Deterministic job-post extraction heuristics.
 *
 * The mock/demo engine uses these to turn a pasted job posting into the same
 * structured shape the on-device model returns (see prompts.ts
 * EXTRACTION_JSON_SCHEMA). Pure functions, fully unit tested.
 */

import type { JobExtraction } from './types';

/** Skills the extractor recognises. Kept in sync with the fresher job market. */
export const SKILL_VOCABULARY = [
  'react',
  'next.js',
  'typescript',
  'javascript',
  'node.js',
  'python',
  'java',
  'spring boot',
  'html',
  'css',
  'tailwind',
  'sql',
  'mysql',
  'postgresql',
  'mongodb',
  'firebase',
  'git',
  'github',
  'aws',
  'docker',
  'rest api',
  'graphql',
  'excel',
  'spreadsheets',
  'google sheets',
  'data entry',
  'customer support',
  'email support',
  'chat support',
  'technical support',
  'troubleshooting',
  'communication',
  'documentation',
  'qa testing',
  'manual testing',
  'selenium',
  'figma',
  'photoshop',
  'content writing',
  'seo',
  'social media',
  'video editing',
  'machine learning',
  'data analysis',
  'power bi',
  'tableau',
  'linux',
  'bash',
  'c++',
  'c#',
  '.net',
  'php',
  'laravel',
  'vue.js',
  'angular',
  'flutter',
  'react native',
  'kubernetes',
  'terraform',
  'jira',
  'notion',
  'slack',
  'zendesk',
  'freshdesk',
  'salesforce',
  'hubspot',
  'typescript',
  'redux',
  'vite',
  'jest',
  'vitest',
  'playwright',
  'cypress',
  'web3',
  'solidity',
  'rust',
  'go',
  'ruby on rails',
] as const;

const CITIES = [
  'shillong',
  'bengaluru',
  'bangalore',
  'mumbai',
  'delhi',
  'hyderabad',
  'pune',
  'chennai',
  'kolkata',
  'gurugram',
  'noida',
  'ahmedabad',
  'jaipur',
  'kochi',
  'indore',
];

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return (match[1] ?? match[0]).trim();
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Split a posting into a "must-have" section and the rest, by headings. */
function splitSections(jdText: string): { mustHave: string; rest: string } {
  const lines = jdText.split('\n');
  let inMustHave = false;
  const mustHave: string[] = [];
  const rest: string[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      /must[\s-]?have|required skills|requirements|what you.?ll need|you must/i.test(
        line,
      )
    ) {
      inMustHave = true;
      continue;
    }
    if (
      /nice[\s-]?to[\s-]?have|preferred|bonus|good to have|benefits|about the role|responsibilities|how to apply/i.test(
        line,
      )
    ) {
      inMustHave = false;
      continue;
    }
    if (lower.trim().length === 0) continue;
    (inMustHave ? mustHave : rest).push(line);
  }
  return { mustHave: mustHave.join('\n'), rest: rest.join('\n') };
}

function findSkills(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  for (const skill of SKILL_VOCABULARY) {
    const pattern = new RegExp(
      `[^a-z0-9]${escapeRegExp(skill.toLowerCase())}[^a-z0-9]`,
    );
    if (pattern.test(lower)) found.push(skill);
  }
  return [...new Set(found)];
}

function titleCase(s: string): string {
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');
}

/** Extract structured fields from a pasted job posting. */
export function extractJobPost(jdText: string): JobExtraction {
  const text = jdText.trim();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const role =
    firstMatch(text, [
      // First line as the title, with a trailing "(Remote, India)" style
      // parenthetical stripped off.
      /^([A-Z][A-Za-z\s&/-]{3,48}?)(?:\s*\([^)]*\))?\s*$/m,
      /(?:role|position|job title)\s*:\s*(.+)/i,
      /(?:hiring|looking for|opening for|we are hiring)\s+(?:a\s+|an\s+)?([A-Za-z][\w\s&/-]{2,48})/i,
    ]) ?? lines[0]?.slice(0, 60) ??
    'Not stated';

  const company =
    firstMatch(text, [
      /(?:company|organisation|organization)\s*:\s*(.+)/i,
      /([A-Z][\w\s&.'-]{2,40})\s+is\s+(?:hiring|looking)/i,
      /at\s+([A-Z][\w\s&.'-]{2,40})/,
    ]) ?? 'Not stated';

  const { mustHave, rest } = splitSections(text);
  const mustHaveSkills = findSkills(mustHave.length > 0 ? mustHave : text);
  const niceToHaveSkills = findSkills(rest).filter(
    (s) => !mustHaveSkills.includes(s),
  );

  const salaryHint =
    firstMatch(text, [
      /((?:₹|rs\.?|inr)\s*[\d,]+(?:\s*-\s*(?:₹|rs\.?|inr)?\s*[\d,]+)?\s*(?:per month|\/month|p\.m\.|per week|\/week|per annum|LPA|lakh)?)/i,
      /(\$\s*[\d,]+(?:\s*-\s*\$?\s*[\d,]+)?\s*(?:per month|\/month|per year|per annum)?)/i,
      /((?:\d+(?:\.\d+)?)\s*LPA)/i,
      /(salary\s*:?\s*(?:of\s+)?(?:₹|rs\.?|inr|\$)?\s*[\d,]+[^\n]{0,24})/i,
    ]) ?? 'Not stated';

  const location =
    firstMatch(text, [
      /(remote|work from home|wfh|work from anywhere|hybrid|on-site|onsite)/i,
      new RegExp(`\\b(${CITIES.join('|')})\\b`, 'i'),
      /(?:location|based in|based at)\s*:\s*([^\n]{2,48})/i,
    ]) ?? 'Not stated';

  const remoteEligible =
    /remote|work from home|\bwfh\b|work from anywhere|anywhere in india/i.test(
      text,
    );

  const deadline =
    firstMatch(text, [
      /apply\s+(?:by|before)\s*:?\s+([A-Za-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?)/i,
      /deadline\s*:?\s*([A-Za-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?)/i,
      /(\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{4})/i,
    ]) ?? 'Not stated';

  const cleanRole =
    role === 'Not stated'
      ? 'Not stated'
      : titleCase(role.replace(/\s+/g, ' ').trim());
  const summary =
    company !== 'Not stated'
      ? `${cleanRole} at ${company}${remoteEligible ? ', remote' : ''}${salaryHint !== 'Not stated' ? `, ${salaryHint}` : ''}.`
      : `${cleanRole}${remoteEligible ? ', remote role' : ''}.`;

  return {
    role: cleanRole,
    company: company.replace(/\s+/g, ' ').trim(),
    mustHaveSkills,
    niceToHaveSkills,
    salaryHint,
    location,
    remoteEligible,
    deadline,
    summary,
  };
}
