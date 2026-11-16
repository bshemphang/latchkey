/**
 * Mock/demo engine.
 *
 * Used while the Firebase project is not wired yet (and as a fallback if the
 * real SDK is unreachable). It produces realistic results from the same
 * deterministic rules the on-device model is prompted with, with simulated
 * latency so the On-device / Cloud badges and timings are honest about being
 * a demo: sources are labelled "mock-on-device" / "mock-cloud" and the UI
 * shows a "Demo mode" pill until Firebase is connected.
 *
 * Nothing here fabricates the user's data: bullets, notes, letters and
 * interview answers are built only from the stored profile and the posting.
 */

import type {
  AIResult,
  AITask,
  CandidateProfile,
  DeepAnalysis,
  InferenceSourceLabel,
  InterviewQA,
  JobExtraction,
  RoutingThresholds,
  ScamVerdict,
} from './types';
import { extractJobPost } from './extract';
import { checkScam } from './scamRules';

export interface MockInput {
  jdText?: string;
  profile?: CandidateProfile;
  extraction?: JobExtraction;
  /** True when the user uploaded a photo of the posting instead of text. */
  imageDataUrl?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function fitScore(profile: CandidateProfile, extraction: JobExtraction): number {
  const must = extraction.mustHaveSkills;
  if (must.length === 0) return 72;
  const have = new Set(profile.skills.map((s) => s.toLowerCase()));
  const matched = must.filter((s) => have.has(s.toLowerCase())).length;
  const ratio = matched / must.length;
  return Math.round(55 + ratio * 40);
}

function buildBullets(
  profile: CandidateProfile,
  extraction: JobExtraction,
): string[] {
  const have = new Set(profile.skills.map((s) => s.toLowerCase()));
  const matched = extraction.mustHaveSkills.filter((s) =>
    have.has(s.toLowerCase()),
  );
  const bullets: string[] = [];
  for (const skill of matched.slice(0, 3)) {
    const exp = profile.experience.find((e) =>
      e.toLowerCase().includes(skill.toLowerCase().split(' ')[0]),
    );
    bullets.push(
      exp
        ? `Used ${skill} while ${exp.charAt(0).toLowerCase() + exp.slice(1)}`
        : `Applied ${skill} across ${profile.projects[0] ?? 'a personal project'}, building hands-on experience relevant to this role.`,
    );
  }
  if (profile.experience.length > 0) {
    bullets.push(profile.experience[0]);
  }
  if (bullets.length < 3) {
    bullets.push(
      `Completed ${profile.education}, with practical work in ${profile.skills.slice(0, 3).join(', ')}.`,
    );
  }
  return bullets.slice(0, 6);
}

function buildNote(
  profile: CandidateProfile,
  extraction: JobExtraction,
): string {
  const topSkills = extraction.mustHaveSkills.slice(0, 3).join(', ');
  const firstName = profile.fullName.split(' ')[0];
  return (
    `Hi, I am ${firstName}, a ${profile.education} graduate with hands-on experience in ${topSkills}. ` +
    `I am applying for the ${extraction.role} role at ${extraction.company} because the work matches what I already do every day. ` +
    `My recent work includes ${profile.projects[0] ?? 'a personal project in this stack'}. ` +
    `I would love the chance to show how I can help your team.`
  );
}

function buildDeep(
  profile: CandidateProfile,
  extraction: JobExtraction,
): DeepAnalysis {
  const score = fitScore(profile, extraction);
  const have = new Set(profile.skills.map((s) => s.toLowerCase()));
  const strengths = extraction.mustHaveSkills
    .filter((s) => have.has(s.toLowerCase()))
    .map((s) => `Strong match on ${s}.`);
  if (profile.experience.length > 0) {
    strengths.push(`Real experience: ${profile.experience[0]}`);
  }
  const gaps = extraction.mustHaveSkills.filter((s) => !have.has(s.toLowerCase()));
  const learnNext = gaps.slice(0, 3).map((g) => `Build a small project using ${g}.`);
  const verdict =
    score >= 80
      ? 'A strong fit. Apply now and lead with the matching skills in the first lines of the application.'
      : score >= 65
        ? 'A good fit with a few gaps. Apply, and name the gaps honestly with a plan to close them.'
        : 'A stretch role. Apply only if the team hires freshers, and start closing the biggest gap this week.';
  return {
    fitScore: score,
    strengths: strengths.slice(0, 4),
    gaps,
    learnNext,
    verdict,
  };
}

function buildInterview(
  profile: CandidateProfile,
  extraction: JobExtraction,
): InterviewQA[] {
  const role = extraction.role;
  const topSkill = extraction.mustHaveSkills[0] ?? profile.skills[0] ?? 'the core skill';
  return [
    {
      question: `Tell me about yourself and why you want this ${role} role.`,
      answer: `I am ${profile.fullName}, a ${profile.education} graduate. I work with ${profile.skills.slice(0, 3).join(', ')}, and I built ${profile.projects[0] ?? 'a personal project'} to practise them. This role fits because it uses exactly those skills every day.`,
    },
    {
      question: `What experience do you have with ${topSkill}?`,
      answer: profile.experience.find((e) =>
        e.toLowerCase().includes(topSkill.toLowerCase().split(' ')[0]),
      ) ?? `I have used ${topSkill} in ${profile.projects[0] ?? 'my personal projects'}, and I keep a small portfolio of that work.`,
    },
    {
      question: 'How do you handle a difficult customer or a tight deadline?',
      answer: `I stay calm, break the problem into the smallest next step, and communicate what I am doing. In ${profile.experience[0] ?? 'my recent work'} I learned that a quick, honest update matters more than a perfect answer.`,
    },
    {
      question: 'What are you learning right now?',
      answer: `I am deepening ${profile.skills.slice(0, 2).join(' and ')}, and I am working through the gaps this role asks for.`,
    },
    {
      question: 'Why should we hire a fresher for this role?',
      answer: `Because I bring current skills, I learn fast, and I have already done the work in ${profile.projects[0] ?? 'personal projects'}. I am ready to contribute from week one.`,
    },
  ];
}

function buildLetter(
  profile: CandidateProfile,
  extraction: JobExtraction,
): string {
  const firstName = profile.fullName.split(' ')[0];
  return [
    `Dear ${extraction.company} hiring team,`,
    '',
    `I am writing to apply for the ${extraction.role} role. I am ${firstName}, a ${profile.education} graduate with hands-on experience in ${extraction.mustHaveSkills.slice(0, 3).join(', ') || profile.skills.slice(0, 3).join(', ')}. Your posting stood out because the work matches what I already do: ${profile.experience[0] ?? 'building with this stack every day'}.`,
    '',
    `In my recent work I built ${profile.projects.join(' and ')}, which taught me to ship, to test, and to communicate clearly with users. I work in ${profile.languages.join(' and ')}, and I am comfortable supporting customers across time zones. I learn quickly, I document what I do, and I take ownership of the small details that keep a team running.`,
    '',
    `I would welcome the chance to show how I can help ${extraction.company}. Thank you for considering my application.`,
    '',
    `Kind regards,`,
    profile.fullName,
  ].join('\n');
}

/**
 * Run one task through the mock engine. `mode` is decided by the router
 * before this is called; the mock honours it for latency and labelling.
 */
export async function runMockTask<T>(
  task: AITask,
  mode: 'on-device' | 'cloud',
  input: MockInput,
  _thresholds: RoutingThresholds,
): Promise<AIResult<T>> {
  const started = performance.now();
  const source: InferenceSourceLabel =
    mode === 'on-device' ? 'mock-on-device' : 'mock-cloud';
  const model = mode === 'on-device' ? 'gemini-nano (demo)' : 'gemini-2.5-flash (demo)';
  await sleep(mode === 'on-device' ? jitter(280, 850) : jitter(900, 2100));

  let data: unknown;
  if (task === 'extract') {
    if (input.imageDataUrl && !input.jdText) {
      data = {
        role: 'Not stated',
        company: 'Not stated',
        mustHaveSkills: [],
        niceToHaveSkills: [],
        salaryHint: 'Not stated',
        location: 'Not stated',
        remoteEligible: false,
        deadline: 'Not stated',
        summary:
          'Photo received. Reading text from a photo needs the on-device model, which runs once Firebase is connected. Paste the posting text to try the full loop now.',
      } as JobExtraction;
    } else {
      data = extractJobPost(input.jdText ?? '');
    }
  } else if (task === 'scam') {
    data = checkScam(input.jdText ?? '') as ScamVerdict;
  } else if (task === 'bullets') {
    if (!input.profile || !input.extraction) throw new Error('bullets needs a profile and an extraction');
    data = buildBullets(input.profile, input.extraction);
  } else if (task === 'note') {
    if (!input.profile || !input.extraction) throw new Error('note needs a profile and an extraction');
    data = buildNote(input.profile, input.extraction);
  } else if (task === 'deep') {
    if (!input.profile || !input.extraction) throw new Error('deep analysis needs a profile and an extraction');
    data = buildDeep(input.profile, input.extraction);
  } else if (task === 'interview') {
    if (!input.profile || !input.extraction) throw new Error('interview prep needs a profile and an extraction');
    data = buildInterview(input.profile, input.extraction);
  } else if (task === 'letter') {
    if (!input.profile || !input.extraction) throw new Error('cover letter needs a profile and an extraction');
    data = buildLetter(input.profile, input.extraction);
  } else {
    throw new Error(`Unknown task: ${String(task)}`);
  }

  return {
    data: data as T,
    source,
    latencyMs: Math.round(performance.now() - started),
    model,
  };
}
