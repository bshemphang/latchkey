/**
 * Firebase Remote Config wrapper.
 *
 * Routing thresholds (cloudMinChars, model names, feature flags) are tunable
 * without a redeploy. Until the Firebase project is wired, the local
 * defaults in ./types.ts are used, so the app works fully in demo mode.
 */

import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';
import { getFirebaseApp, isFirebaseConfigured } from './firebase';
import { DEFAULT_THRESHOLDS, type RoutingThresholds } from '../ai/types';

let cached: RoutingThresholds | null = null;
let fetched = false;

/**
 * Parse raw Remote Config string values into thresholds. A non-numeric or
 * non-finite value falls back to the matching default instead of poisoning
 * the routing math (a NaN cloudMinChars makes `jdLength > NaN` false
 * forever, so long postings never route to the cloud).
 */
export function parseThresholds(values: {
  cloudMinChars?: string;
  cloudModel?: string;
  deviceModel?: string;
  photoUploadEnabled?: string;
}): RoutingThresholds {
  const minChars = Number(values.cloudMinChars);
  return {
    cloudMinChars:
      Number.isFinite(minChars) && minChars > 0
        ? minChars
        : DEFAULT_THRESHOLDS.cloudMinChars,
    cloudModel: values.cloudModel?.trim() || DEFAULT_THRESHOLDS.cloudModel,
    deviceModel: values.deviceModel?.trim() || DEFAULT_THRESHOLDS.deviceModel,
    photoUploadEnabled: values.photoUploadEnabled !== 'false',
  };
}

/** Current thresholds: Remote Config values when available, else defaults. */
export async function getThresholds(): Promise<RoutingThresholds> {
  if (cached) return cached;
  if (!isFirebaseConfigured()) return DEFAULT_THRESHOLDS;
  try {
    const app = getFirebaseApp();
    if (!app) return DEFAULT_THRESHOLDS;
    const rc = getRemoteConfig(app);
    rc.settings.minimumFetchIntervalMillis = 60_000;
    rc.defaultConfig = {
      cloud_min_chars: String(DEFAULT_THRESHOLDS.cloudMinChars),
      cloud_model: DEFAULT_THRESHOLDS.cloudModel,
      device_model: DEFAULT_THRESHOLDS.deviceModel,
      photo_upload_enabled: String(DEFAULT_THRESHOLDS.photoUploadEnabled),
    };
    if (!fetched) {
      await fetchAndActivate(rc);
      fetched = true;
    }
    cached = parseThresholds({
      cloudMinChars: getValue(rc, 'cloud_min_chars').asString(),
      cloudModel: getValue(rc, 'cloud_model').asString(),
      deviceModel: getValue(rc, 'device_model').asString(),
      photoUploadEnabled: getValue(rc, 'photo_upload_enabled').asString(),
    });
    return cached;
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}
