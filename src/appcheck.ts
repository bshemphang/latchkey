/**
 * Firebase App Check.
 *
 * Firebase AI Logic requires App Check. In development the debug provider is
 * used (the SDK logs a debug token to the console, which is registered in the
 * Firebase console; the token itself is never committed). In production the
 * reCAPTCHA v3 provider is used, with the site key from the environment.
 *
 * Until the Firebase project is wired this is a no-op.
 */

import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getFirebaseApp, isFirebaseConfigured } from './config/firebase';

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
  }
}

let initialised = false;

export type AppCheckState =
  | 'not-configured'
  | 'ready'
  | 'missing-site-key'
  | 'error';

let appCheckState: AppCheckState = 'not-configured';
let appCheckError: string | null = null;

/** Current App Check state, for the EngineStatus banner and diagnostics. */
export function getAppCheckState(): {
  state: AppCheckState;
  error: string | null;
} {
  return { state: appCheckState, error: appCheckError };
}

/**
 * The App Check debug token for the dev provider.
 *
 * Development only: when the registered debug token is present in
 * `.env.local` (VITE_FIREBASE_APPCHECK_DEBUG_TOKEN) it is used; otherwise
 * `true` makes the SDK print a fresh token to the console for registration
 * in the Firebase console. Returns undefined outside DEV, so the token
 * value is never referenced by the production build (and never ships in
 * the deployed bundle — verify with a grep of dist/ after every build).
 */
export function resolveDebugToken(): string | true | undefined {
  if (!import.meta.env.DEV) return undefined;
  const token = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN as
    | string
    | undefined;
  return token || true;
}

export function initAppCheck(): void {
  if (initialised || !isFirebaseConfigured()) return;
  const app = getFirebaseApp();
  if (!app) return;
  try {
    const debugToken = resolveDebugToken();
    if (debugToken !== undefined) {
      // Debug provider: the SDK uses this token instead of reCAPTCHA.
      // Register the token in the Firebase console; never commit it.
      window.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }
    const siteKey = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY as
      | string
      | undefined;
    if (!siteKey && !import.meta.env.DEV) {
      // Production without a site key: App Check silently never starts and
      // every AI call then fails with a raw 401/403. Say so loudly instead.
      appCheckState = 'missing-site-key';
      console.warn(
        'Latchkey: VITE_RECAPTCHA_V3_SITE_KEY is not set, so App Check is disabled in production and AI calls may be rejected. Add the reCAPTCHA v3 site key to finish setup.',
      );
      return;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey ?? 'debug'),
      isTokenAutoRefreshEnabled: true,
    });
    initialised = true;
    appCheckState = 'ready';
  } catch (e) {
    appCheckState = 'error';
    appCheckError = e instanceof Error ? e.message : String(e ?? '');
    console.warn('Latchkey: App Check failed to initialise', e);
  }
}
