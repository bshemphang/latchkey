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

export function initAppCheck(): void {
  if (initialised || !isFirebaseConfigured()) return;
  const app = getFirebaseApp();
  if (!app) return;
  try {
    if (import.meta.env.DEV) {
      // Debug provider: the SDK prints a debug token to the console on first
      // use. Register that token in the Firebase console; never commit it.
      window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    const siteKey = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY as
      | string
      | undefined;
    if (!siteKey && !import.meta.env.DEV) return;
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey ?? 'debug'),
      isTokenAutoRefreshEnabled: true,
    });
    initialised = true;
  } catch {
    // App Check is best-effort at startup; AI calls surface real failures.
  }
}
