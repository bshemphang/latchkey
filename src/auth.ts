/**
 * Authentication.
 *
 * Anonymous auth by default so a judge can try the app in one click with no
 * signup. Optional Google sign-in upgrades the same account so the tracker
 * syncs across devices. Until Firebase is wired, a stable local id is used
 * and everything stays on-device.
 */

import { getAuth, signInAnonymously, linkWithPopup, GoogleAuthProvider, type User } from 'firebase/auth';
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

/**
 * The uid of the current session, synchronously. Falls back to the stable
 * local id when no session exists yet (demo mode). Used to tag tracker
 * documents before the async session is ready.
 */
export function currentUid(): string {
  return session?.uid ?? localUid();
}

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

/**
 * Upgrade the anonymous session with Google sign-in (optional). Uses
 * linkWithPopup so the Google credential is linked to the SAME anonymous
 * account: the uid (and every tracker document owned by it) survives the
 * upgrade instead of being discarded for a fresh uid.
 */
export async function signInWithGoogle(): Promise<Session> {
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase is not configured.');
  const auth = getAuth(app);
  const user = auth.currentUser;
  if (!user) {
    // No anonymous session to upgrade; fall back to a fresh sign-in.
    const cred = await signInAnonymously(auth);
    session = toSession(cred.user);
    return session;
  }
  const cred = await linkWithPopup(user, new GoogleAuthProvider());
  session = toSession(cred.user);
  return session;
}
