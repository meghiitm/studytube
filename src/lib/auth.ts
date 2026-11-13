import { initializeApp, getApps, getApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  User,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  Firestore,
} from 'firebase/firestore';
import { Course, UserProgress, StudyStats, CourseRoadmap } from '@/types/course';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  firstName: string;
  email: string | null;
  photoURL: string | null;
}

export interface CloudUserData {
  courses: Course[];
  progress: Record<string, UserProgress>;
  stats: StudyStats;
  roadmaps: CourseRoadmap[];
  updatedAt?: string;
}

const STORAGE_KEY_FB_CONFIG = 'studytube_firebase_config';

/**
 * Returns Firebase options from framework environment variables (NEXT_PUBLIC_FIREBASE_*).
 */
export function getEnvFirebaseConfig(): FirebaseOptions | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) return null;

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || undefined,
    appId,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
  };
}

/**
 * Parses user-pasted Firebase web configuration snippet (JSON or object literal).
 */
export function parseFirebaseConfigInput(raw: string): FirebaseOptions | null {
  if (!raw || !raw.trim()) return null;
  try {
    let normalized = raw.trim();
    if (normalized.includes('firebaseConfig')) {
      const idx = normalized.indexOf('{');
      const end = normalized.lastIndexOf('}');
      if (idx !== -1 && end !== -1) {
        normalized = normalized.slice(idx, end + 1);
      }
    }
    const jsonLike = normalized
      .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
      .replace(/'/g, '"')
      .replace(/,\s*([}\]])/g, '$1');

    const parsed = JSON.parse(jsonLike);
    if (parsed?.apiKey && parsed?.authDomain && parsed?.projectId && parsed?.appId) {
      return {
        apiKey: String(parsed.apiKey),
        authDomain: String(parsed.authDomain),
        projectId: String(parsed.projectId),
        storageBucket: parsed.storageBucket ? String(parsed.storageBucket) : undefined,
        messagingSenderId: parsed.messagingSenderId ? String(parsed.messagingSenderId) : undefined,
        appId: String(parsed.appId),
        measurementId: parsed.measurementId ? String(parsed.measurementId) : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves active Firebase config from environment variables or local storage.
 */
export function getActiveFirebaseConfig(): {
  config: FirebaseOptions | null;
  source: 'env' | 'local' | null;
} {
  const envCfg = getEnvFirebaseConfig();
  if (envCfg) return { config: envCfg, source: 'env' };

  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_FB_CONFIG);
    if (saved) {
      const parsed = parseFirebaseConfigInput(saved);
      if (parsed) return { config: parsed, source: 'local' };
    }
  }
  return { config: null, source: null };
}

let firebaseAppInstance: FirebaseApp | null = null;
let firebaseAuthInstance: Auth | null = null;
let firestoreDbInstance: Firestore | null = null;

export function getFirebaseInstances(): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
} | null {
  if (typeof window === 'undefined') return null;

  if (firebaseAppInstance && firebaseAuthInstance && firestoreDbInstance) {
    return {
      app: firebaseAppInstance,
      auth: firebaseAuthInstance,
      db: firestoreDbInstance,
    };
  }

  const { config } = getActiveFirebaseConfig();
  if (!config) return null;

  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    const auth = getAuth(app);
    const db = getFirestore(app);

    firebaseAppInstance = app;
    firebaseAuthInstance = auth;
    firestoreDbInstance = db;

    return { app, auth, db };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Firebase initialization error:', err);
    }
    return null;
  }
}

/**
 * Returns Firebase Auth instance if configured, or null.
 */
export function getFirebaseAuth(): Auth | null {
  const instances = getFirebaseInstances();
  return instances ? instances.auth : null;
}

// Export auth getter for consumers
export const auth = typeof window !== 'undefined' ? getFirebaseAuth() : null;

export function toAuthUser(u: User): AuthUser {
  const displayName = u.displayName || null;
  const firstName = displayName
    ? displayName.trim().split(' ')[0]
    : u.email
    ? u.email.split('@')[0]
    : 'Student';

  return {
    uid: u.uid,
    displayName,
    firstName,
    email: u.email || null,
    photoURL: u.photoURL || null,
  };
}

/**
 * Detects mobile browsers to prefer redirect over popup.
 */
export function isMobileBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Maps Firebase Auth error codes to user-friendly messages.
 */
export function getFriendlyAuthErrorMessage(err: any): string {
  const code = err?.code || '';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in cancelled. The Google popup was closed before completing.';
    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked by your browser. Please allow popups for this site or try again.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connection and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Console. Please add studytube-psi.vercel.app and localhost to Firebase Console > Authentication > Settings > Authorized domains.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/user-disabled':
      return 'This Google account has been disabled.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled in Firebase Console. Please enable Google in Firebase > Authentication > Sign-in method.';
    default:
      return err?.message || 'Failed to sign in with Google. Please try again.';
  }
}

/**
 * Single-option Google Login:
 * - Uses signInWithPopup on desktop
 * - Uses signInWithRedirect on mobile browsers
 */
export async function loginWithGoogle(): Promise<AuthUser | null> {
  const instances = getFirebaseInstances();
  if (!instances) {
    throw new Error(
      'Firebase is not configured. Please add NEXT_PUBLIC_FIREBASE_* in your environment or Settings.'
    );
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  if (isMobileBrowser()) {
    await signInWithRedirect(instances.auth, provider);
    return null; // Page will redirect and reload
  }

  try {
    const cred = await signInWithPopup(instances.auth, provider);
    return toAuthUser(cred.user);
  } catch (err: any) {
    throw new Error(getFriendlyAuthErrorMessage(err));
  }
}

/**
 * Handles redirect sign-in result when returning on mobile browsers.
 */
export async function handleRedirectResult(): Promise<AuthUser | null> {
  const instances = getFirebaseInstances();
  if (!instances) return null;

  try {
    const result = await getRedirectResult(instances.auth);
    if (result && result.user) {
      return toAuthUser(result.user);
    }
    return null;
  } catch (err: any) {
    throw new Error(getFriendlyAuthErrorMessage(err));
  }
}

/**
 * Sign in using Google ID token credential (used by Google One Tap).
 */
export async function loginWithGoogleCredential(idToken: string): Promise<AuthUser> {
  const instances = getFirebaseInstances();
  if (!instances) {
    throw new Error('Firebase is not configured.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(instances.auth, credential);
  return toAuthUser(result.user);
}

/**
 * Sign out the currently authenticated user.
 */
export async function logout(): Promise<void> {
  const instances = getFirebaseInstances();
  if (!instances) return;
  await signOut(instances.auth);
}

/**
 * Subscribes to auth state changes across reloads.
 */
export function subscribeToAuth(
  callback: (user: AuthUser | null) => void
): () => void {
  const instances = getFirebaseInstances();
  if (!instances) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(instances.auth, (fbUser) => {
    callback(fbUser ? toAuthUser(fbUser) : null);
  });
}

/**
 * Loads user data from Firestore users/{uid}.
 */
export async function loadCloudUserData(uid: string): Promise<CloudUserData | null> {
  const instances = getFirebaseInstances();
  if (!instances) return null;
  const ref = doc(instances.db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as CloudUserData;
}

/**
 * Saves user data to Firestore users/{uid}.
 */
export async function saveCloudUserData(uid: string, data: CloudUserData): Promise<void> {
  const instances = getFirebaseInstances();
  if (!instances) return;
  const ref = doc(instances.db, 'users', uid);
  const sanitized = JSON.parse(
    JSON.stringify({
      ...data,
      updatedAt: new Date().toISOString(),
    })
  );
  await setDoc(ref, sanitized, { merge: true });
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          cancel: () => void;
        };
      };
    };
  }
}

/**
 * Initializes Google One Tap with FedCM flags enabled.
 * If One Tap or FedCM is unsupported, dismissed, or disabled, falls back silently.
 */
export function initGoogleOneTap(onSuccess?: (user: AuthUser) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('studytube_google_client_id') || ''
      : '');

  if (!clientId) {
    // Client ID not provided; silently skip One Tap without error
    return () => {};
  }

  let isMounted = true;

  const setupOneTap = () => {
    if (!window.google?.accounts?.id || !isMounted) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential?: string }) => {
          if (!response?.credential || !isMounted) return;
          try {
            const user = await loginWithGoogleCredential(response.credential);
            if (isMounted && onSuccess) {
              onSuccess(user);
            }
          } catch {
            // Silently fall back to standard button
          }
        },
        use_fedcm_for_prompt: true,
        use_fedcm_for_button: true,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.prompt((notification: any) => {
        // Silently handle dismissal or unsupported states without throwing
        if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
          // Fall back silently
        }
      });
    } catch {
      // Silently fall back
    }
  };

  if (window.google?.accounts?.id) {
    setupOneTap();
  } else {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (isMounted) setupOneTap();
      };
      script.onerror = () => {
        // Silently fall back
      };
      document.head.appendChild(script);
    } else {
      existing.addEventListener('load', () => {
        if (isMounted) setupOneTap();
      }, { once: true });
    }
  }

  return () => {
    isMounted = false;
    try {
      window.google?.accounts?.id?.cancel();
    } catch {
      // Ignore
    }
  };
}
