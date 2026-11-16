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
    cached = {
      cloudMinChars: Number(
        getValue(rc, 'cloud_min_chars').asString() ||
          DEFAULT_THRESHOLDS.cloudMinChars,
      ),
      cloudModel:
        getValue(rc, 'cloud_model').asString() || DEFAULT_THRESHOLDS.cloudModel,
      deviceModel:
        getValue(rc, 'device_model').asString() ||
        DEFAULT_THRESHOLDS.deviceModel,
      photoUploadEnabled:
        getValue(rc, 'photo_upload_enabled').asString() !== 'false',
    };
    return cached;
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}
