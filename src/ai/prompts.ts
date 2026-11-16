/**
 * Single-turn prompt templates for every Latchkey AI task.
 *
 * These builders are pure functions (no Firebase import) so they are unit
 * testable in Node. The engine feeds the built prompt to the model, on-device
 * or in the cloud, and the response is parsed back into the typed shapes in
 * ./types.ts.
 *
 * Privacy rule enforced here and tested: cloud prompts never include the
 * candidate profile unless the caller explicitly opts in (deep analysis,
 * interview prep and the long letter use the profile only when the user has
 * opted into cloud use of it).
 */

import type { CandidateProfile, JobExtraction } from './types';

/** Plain JSON-schema description of the extraction output (for docs and mock validation). */
export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    role: { type: 'string' },
    company: { type: 'string' },
    mustHaveSkills: { type: 'array', items: { type: 'string' } },
    niceToHaveSkills: { type: 'array', items: { type: 'string' } },
    salaryHint: { type: 'string' },
    location: { type: 'string' },
    remoteEligible: { type: 'boolean' },
    deadline: { type: 'string' },
    summary: { type: 'string' },
  },
  required: [
    'role',
    'company',
    'mustHaveSkills',
    'niceToHaveSkills',
    'salaryHint',
    'location',
    'remoteEligible',
    'deadline',
    'summary',
  ],
} as const;

/** Safely parse a model response that should be the extraction JSON object. */
export function parseExtractionJson(
  text: string,
): { ok: true; data: JobExtraction } | { ok: false; error: string } {
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, error: 'No JSON object found in the model response.' };
  }
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
    const required = [
      'role',
      'company',
      'mustHaveSkills',
      'niceToHaveSkills',
      'salaryHint',
      'location',
      'remoteEligible',
      'deadline',
      'summary',
    ];
    for (const key of required) {
      if (!(key in parsed)) {
        return { ok: false, error: `Missing required field: ${key}.` };
      }
    }
    return { ok: true, data: parsed as unknown as JobExtraction };
  } catch {
    return { ok: false, error: 'Model response was not valid JSON.' };
  }
}

export function buildExtractionPrompt(jdText: string): string {
  return [
    'Extract the structured details from this job posting. Reply with JSON only, matching this schema:',
    JSON.stringify(EXTRACTION_JSON_SCHEMA),
    'Rules: use "Not stated" for any field the posting does not mention. mustHaveSkills are skills the posting marks required or must-have; niceToHaveSkills are preferred or bonus skills. remoteEligible is true only if the posting says remote, work from home, or anywhere. summary is one sentence.',
    '',
    'Job posting:',
    jdText,
  ].join('\n');
}

export function buildScamPrompt(jdText: string): string {
  return [
    'You are a scam detector for job postings aimed at freshers in India.',
    'Flag these signals if present: a registration, training, security, laptop or deposit fee; recruiters reachable only on Telegram or WhatsApp; an HR contact on a free Gmail address with no company domain; MLM or commission-only pay; vague form-filling or copy-paste work with no real company; pay that is unrealistically high for the role.',
    'Reply with JSON only: { "level": "green" | "amber" | "red", "signals": [{ "id": string, "label": string, "evidence": string }], "explanation": string }.',
    'level is red if any fee demand, Telegram/WhatsApp-only recruiter, or MLM signal is present; amber if only weaker signals are present; green if none are present. evidence must quote the exact words from the posting.',
    '',
    'Job posting:',
    jdText,
  ].join('\n');
}

export function profileToText(profile: CandidateProfile): string {
  return [
    `Name: ${profile.fullName}`,
    `Headline: ${profile.headline}`,
    `Education: ${profile.education}`,
    `Skills: ${profile.skills.join(', ')}`,
    `Experience: ${profile.experience.join('; ')}`,
    `Projects: ${profile.projects.join('; ')}`,
    `Languages: ${profile.languages.join(', ')}`,
  ].join('\n');
}

export function buildBulletsPrompt(
  profile: CandidateProfile,
  extraction: JobExtraction,
): string {
  return [
    'Write 4 to 6 tailored resume bullet points for this candidate for this job. Each bullet starts with a strong action verb, mentions a concrete skill or result from the candidate, and maps to one of the job must-haves. Plain human wording, no em dashes, no invented employers, no invented numbers. Reply with JSON only: { "bullets": string[] }.',
    '',
    'Candidate:',
    profileToText(profile),
    '',
    'Job must-haves: ' + extraction.mustHaveSkills.join(', '),
    `Role: ${extraction.role} at ${extraction.company}`,
  ].join('\n');
}

export function buildNotePrompt(
  profile: CandidateProfile,
  extraction: JobExtraction,
): string {
  return [
    'Write a short cover note of 3 to 4 sentences for this candidate applying to this job. Human tone, specific to the role, no em dashes, no invented experience, no generic filler. Reply with the note text only.',
    '',
    'Candidate:',
    profileToText(profile),
    '',
    `Role: ${extraction.role} at ${extraction.company}`,
    'Job must-haves: ' + extraction.mustHaveSkills.join(', '),
  ].join('\n');
}

export function buildDeepPrompt(
  profile: CandidateProfile,
  extraction: JobExtraction,
  jdText: string,
): string {
  return [
    'Analyse how well this candidate fits this job. Reply with JSON only: { "fitScore": number 0-100, "strengths": string[], "gaps": string[], "learnNext": string[], "verdict": string }. strengths are real matches between the candidate and the posting. gaps are must-have skills the candidate does not have. learnNext is what to learn first to close the biggest gap. verdict is two sentences, honest and specific.',
    '',
    `Role: ${extraction.role} at ${extraction.company}`,
    '',
    'Candidate:',
    profileToText(profile),
    '',
    'Job posting:',
    jdText,
  ].join('\n');
}

export function buildInterviewPrompt(
  profile: CandidateProfile,
  extraction: JobExtraction,
  jdText: string,
): string {
  return [
    'Write 5 likely interview questions for this specific role, each with a model answer drawn from this candidate real experience. Reply with JSON only: { "qa": [{ "question": string, "answer": string }] }. Answers must use only the candidate real experience and projects, no invented jobs, no invented numbers.',
    '',
    `Role: ${extraction.role} at ${extraction.company}`,
    '',
    'Candidate:',
    profileToText(profile),
    '',
    'Job posting:',
    jdText,
  ].join('\n');
}

export function buildLetterPrompt(
  profile: CandidateProfile,
  extraction: JobExtraction,
  jdText: string,
): string {
  return [
    'Write a full cover letter for this candidate for this job, 3 short paragraphs plus a closing line. Human tone, specific to the role and company, no em dashes, no invented experience, no generic filler. Reply with the letter text only.',
    '',
    `Role: ${extraction.role} at ${extraction.company}`,
    '',
    'Candidate:',
    profileToText(profile),
    '',
    'Job posting:',
    jdText,
  ].join('\n');
}
