/**
 * Routing policy: which tasks prefer on-device inference, which prefer the
 * cloud, and when the policy is overridden.
 *
 * The routing story is the product: private data stays on the device, heavy
 * work goes to the cloud. Thresholds come from Firebase Remote Config
 * (defaults in ./types.ts) so they can be tuned without a redeploy.
 */

import type { AITask, RoutingThresholds } from './types';

/** Default preference per task. On-device tasks touch the user's own data. */
export const TASK_PREFERENCE: Record<AITask, 'on-device' | 'cloud'> = {
  extract: 'on-device',
  scam: 'on-device',
  bullets: 'on-device',
  note: 'on-device',
  deep: 'cloud',
  interview: 'cloud',
  letter: 'cloud',
};

export interface RoutingContext {
  /** Whether Gemini Nano is available on this device/browser. */
  nanoAvailable: boolean;
  /** Whether the browser is online. */
  online: boolean;
  /** Length of the job description text, in characters. */
  jdLength: number;
  thresholds: RoutingThresholds;
}

export interface RouteDecision {
  mode: 'on-device' | 'cloud';
  /** Human-readable reason, shown in the UI next to the badge. */
  reason: string;
  /** True when the task cannot run at all in the current state. */
  blocked?: boolean;
  /** True when on-device was preferred but the cloud was used instead. */
  fallback?: boolean;
}

export function routeTask(task: AITask, ctx: RoutingContext): RouteDecision {
  const preferred = TASK_PREFERENCE[task];

  // Offline: cloud tasks cannot run; on-device tasks still work.
  if (!ctx.online) {
    if (preferred === 'cloud') {
      return {
        mode: 'on-device',
        reason: 'You are offline, so the cloud feature is unavailable.',
        blocked: true,
      };
    }
    return {
      mode: 'on-device',
      reason: 'Offline: running on-device only.',
    };
  }

  // Long job descriptions go to the cloud even for on-device tasks, because
  // the on-device model has a small context window.
  if (
    preferred === 'on-device' &&
    ctx.jdLength > ctx.thresholds.cloudMinChars
  ) {
    return {
      mode: 'cloud',
      reason: `Long posting (${ctx.jdLength.toLocaleString()} chars) exceeds the on-device limit of ${ctx.thresholds.cloudMinChars.toLocaleString()} chars.`,
      fallback: true,
    };
  }

  // No Nano on this device/browser: everything falls back to the cloud.
  if (preferred === 'on-device' && !ctx.nanoAvailable) {
    return {
      mode: 'cloud',
      reason: 'Gemini Nano is not available on this device, so this ran in the cloud.',
      fallback: true,
    };
  }

  if (preferred === 'on-device') {
    return {
      mode: 'on-device',
      reason: 'Private data stays on this device.',
    };
  }
  return {
    mode: 'cloud',
    reason: 'Long-context work runs in the cloud.',
  };
}

/** Short label for a route decision, used in telemetry. */
export function describeRoute(d: RouteDecision): string {
  return d.mode === 'on-device' ? 'On-device' : 'Cloud';
}
