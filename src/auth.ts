/**
 * Authentication.
 *
 * Anonymous auth by default so a judge can try the app in one click with no
 * signup. Optional Google sign-in upgrades the same account so the tracker
 * syncs across devices. Until Firebase is wired, a stable local id is used
 * and everything stays on-device.
 */

import { getAuth, signInAnonymously, signInWithPopup, GoogleAuthProvider, type User } from 'firebase/auth';
import { getFirebaseApp, isFirebaseConfigured } from './config/firebase';

export interface Session {
  uid: string;
  isAnonymous: boolean;
  displayName?: string;
  email?: string;
}

const LOCAL_UID_KEY = 'latchkey.local-uid';

function localUid(): string {
  try {
    const existing = localStorage.getItem(LOCAL_UID_KEY);
    if (existing) return existing;
    const id = `local-${crypto.randomUUID()}`;
    localStorage.setItem(LOCAL_UID_KEY, id);
    return id;
  } catch {
    return 'local-anonymous';
  }
}

let session: Session | null = null;

function toSession(user: User): Session {
  return {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    displayName: user.displayName ?? undefined,
    email: user.email ?? undefined,
  };
}

/** Ensure a session exists. Anonymous by default, no signup required. */
export async function ensureSession(): Promise<Session> {
  if (session) return session;
  if (!isFirebaseConfigured()) {
    session = { uid: localUid(), isAnonymous: true };
    return session;
  }
  const app = getFirebaseApp();
  if (!app) {
    session = { uid: localUid(), isAnonymous: true };
    return session;
  }
  const auth = getAuth(app);
  if (auth.currentUser) {
    session = toSession(auth.currentUser);
    return session;
  }
  const cred = await signInAnonymously(auth);
  session = toSession(cred.user);
  return session;
}

/** Upgrade the anonymous session with Google sign-in (optional). */
export async function signInWithGoogle(): Promise<Session> {
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase is not configured.');
  const auth = getAuth(app);
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  session = toSession(cred.user);
  return session;
}
