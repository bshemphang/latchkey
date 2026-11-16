/**
 * Deterministic scam-signal rules for job postings.
 *
 * These are the same signals the on-device model is prompted to look for
 * (see prompts.ts). The rule engine runs in the mock/demo path and doubles as
 * a fast local pre-check. Pure functions, fully unit tested.
 */

import type { ScamLevel, ScamSignal, ScamVerdict } from './types';

interface SignalRule {
  id: string;
  label: string;
  severity: 'red' | 'amber';
  patterns: RegExp[];
}

const RULES: SignalRule[] = [
  {
    id: 'fee-demand',
    label: 'Demands a fee',
    severity: 'red',
    patterns: [
      /(registration|training|security|laptop|deposit|processing|verification|joining)\s*(fee|charge|amount|deposit)/i,
      /(pay|payable|payment of)\s*(₹|\$|rs\.?|inr)\s*[\d,]+/i,
      /refundable\s*(deposit|security|amount)/i,
      /fee\s*(of)?\s*(₹|\$|rs\.?|inr)\s*[\d,]+/i,
    ],
  },
  {
    id: 'telegram-whatsapp-only',
    label: 'Telegram / WhatsApp-only recruiter',
    severity: 'red',
    patterns: [
      /apply\s+(only\s+)?(on|via|through|by)\s+(whatsapp|telegram)/i,
      /(whatsapp|telegram)\s*(only|number|me|us|for details|to apply)/i,
      /contact\s+(only\s+)?(on|via|through)\s+(whatsapp|telegram)/i,
      /message\s+(us\s+)?(on\s+)?(whatsapp|telegram)/i,
    ],
  },
  {
    id: 'mlm-commission',
    label: 'MLM / commission-only pay',
    severity: 'red',
    patterns: [
      /commission[\s-]*only/i,
      /multi[\s-]?level\s+marketing/i,
      /\bmlm\b/i,
      /earn\s+per\s+(referral|joining|member)/i,
      /recruit\s+.*\bearn\b/i,
      /no\s+(fixed\s+)?salary.*commission/i,
    ],
  },
  {
    id: 'free-gmail-hr',
    label: 'HR contact on a free Gmail address',
    severity: 'amber',
    patterns: [
      /(hr|recruiter|hiring|jobs|careers|apply)\s*@\s*gmail\.com/i,
      /send\s+(your\s+)?(cv|resume)\s+to\s+\S+@gmail\.com/i,
      /mail\s+(your\s+)?(cv|resume)\s+to\s+\S+@gmail\.com/i,
    ],
  },
  {
    id: 'form-filling',
    label: 'Vague form-filling / copy-paste work',
    severity: 'amber',
    patterns: [
      /form\s*filling/i,
      /copy[\s-]*paste\s+work/i,
      /type\s+\d+\s*pages/i,
      /data\s*entry.*per\s+(page|form)/i,
    ],
  },
  {
    id: 'unrealistic-pay',
    label: 'Pay is unrealistically high for the role',
    severity: 'amber',
    patterns: [
      /(₹|\$|rs\.?|inr)\s*[\d,]{5,}\s*(per|a|\/)\s*(day|daily)/i,
      /(₹|\$|rs\.?|inr)\s*[\d,]{5,}\s*(per|a|\/)\s*(week|weekly)/i,
      /earn\s*(up to\s*)?(₹|\$|rs\.?)\s*[\d,]{6,}/i,
    ],
  },
  {
    id: 'vague-listing',
    label: 'Vague listing, no real company details',
    severity: 'amber',
    patterns: [
      /immediate\s+joining/i,
      /no\s+experience\s+(needed|required)/i,
      /anyone\s+can\s+apply/i,
      /work\s+from\s+(your\s+)?mobile/i,
      /no\s+interview/i,
    ],
  },
];

/**
 * Run every rule against the posting text. Returns all matching signals with
 * the exact quoted evidence from the posting.
 */
export function findScamSignals(jdText: string): ScamSignal[] {
  const signals: ScamSignal[] = [];
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = jdText.match(pattern);
      if (match) {
        signals.push({
          id: rule.id,
          label: rule.label,
          evidence: match[0].trim(),
        });
        break; // one signal per rule, first matching pattern wins
      }
    }
  }
  return signals;
}

function levelFor(signals: ScamSignal[]): ScamLevel {
  const ids = new Set(signals.map((s) => s.id));
  const hasRed = RULES.some(
    (r) => r.severity === 'red' && ids.has(r.id),
  );
  if (hasRed) return 'red';
  if (signals.length > 0) return 'amber';
  return 'green';
}

/** Full verdict for a posting: level, signals found, and a plain explanation. */
export function checkScam(jdText: string): ScamVerdict {
  const signals = findScamSignals(jdText);
  const level = levelFor(signals);
  const explanation =
    level === 'green'
      ? 'No common scam signals found in this posting. Still verify the company on its own website before sharing personal documents.'
      : level === 'red'
        ? `Do not pay anything and do not share documents. This posting shows: ${signals.map((s) => s.label.toLowerCase()).join('; ')}.`
        : `Proceed with caution. This posting shows: ${signals.map((s) => s.label.toLowerCase()).join('; ')}. Verify the company before applying.`;
  return { level, signals, explanation };
}
