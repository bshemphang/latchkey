/**
 * Firebase configuration and lazy initialisation.
 *
 * The web config comes from environment variables (see .env.example). It
 * contains no secrets: the Firebase web config is public by design, and the
 * App Check debug token must never be committed. Until the Firebase project
 * is created (his step), `isFirebaseConfigured()` is false and the app runs
 * entirely against the mock AI layer.
 *
 * NOTE (2026-11-17): the plan named the import path `firebase/ai-logic`, but
 * in the installed Firebase JS SDK v13 the module is `firebase/ai`. The
 * exports are identical (getAI, getGenerativeModel, GoogleAIBackend,
 * InferenceMode, InferenceSource).
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import { getFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

export function getFirebaseConfig(): FirebaseWebConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as
    | string
    | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as
    | string
    | undefined;
  if (!apiKey || !authDomain || !projectId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as
      | string
      | undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as
      | string
      | undefined,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as
      | string
      | undefined,
  };
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfig() !== null;
}

let app: FirebaseApp | null = null;

/** Lazily initialise the Firebase app. Returns null until config exists. */
export function getFirebaseApp(): FirebaseApp | null {
  const config = getFirebaseConfig();
  if (!config) return null;
  if (!app) app = initializeApp(config);
  return app;
}

let ai: AI | null = null;

let db: Firestore | null = null;

/** Lazily create the Firestore client for the tracker. Null until configured. */
export function getFirestoreDb(): Firestore | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!db) db = getFirestore(firebaseApp);
  return db;
}

/**
 * Lazily create the Firebase AI Logic client (Gemini Developer API backend).
 * This is the import-and-call site the hackathon rules require: the app
 * imports Firebase AI Logic and actually calls it at runtime once configured.
 */
export function getAIClient(): AI | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!ai) ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
  return ai;
}
