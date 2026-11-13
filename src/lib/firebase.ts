import { initializeApp, getApps, getApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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

export interface CloudUserData {
  courses: Course[];
  progress: Record<string, UserProgress>;
  stats: StudyStats;
  roadmaps: CourseRoadmap[];
  updatedAt?: string;
}

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

const STORAGE_KEY_FB_CONFIG = 'studytube_firebase_config';

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
  };
}

export function parseFirebaseConfigInput(raw: string): FirebaseOptions | null {
  if (!raw || !raw.trim()) return null;
  try {
    // Allow pasting either strict JSON or JS object snippet from Firebase Console
    let normalized = raw.trim();
    if (normalized.includes('firebaseConfig')) {
      const idx = normalized.indexOf('{');
      const end = normalized.lastIndexOf('}');
      if (idx !== -1 && end !== -1) {
        normalized = normalized.slice(idx, end + 1);
      }
    }
    // Quote unquoted keys if user pasted JS object literal
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
      };
    }
    return null;
  } catch {
    return null;
  }
}

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

function getFirebaseInstances(): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
} | null {
  if (typeof window === 'undefined') return null;
  const { config } = getActiveFirebaseConfig();
  if (!config) return null;

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  return { app, auth, db };
}

export async function signInWithGooglePopup(): Promise<AuthUser> {
  const instances = getFirebaseInstances();
  if (!instances) {
    throw new Error('Firebase is not configured yet. Add your Firebase config in Settings.');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(instances.auth, provider);
  return toAuthUser(cred.user);
}

export async function signOutFirebase(): Promise<void> {
  const instances = getFirebaseInstances();
  if (!instances) return;
  await signOut(instances.auth);
}

export function subscribeFirebaseAuth(
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

function toAuthUser(u: User): AuthUser {
  return {
    uid: u.uid,
    displayName: u.displayName,
    email: u.email,
    photoURL: u.photoURL,
  };
}

export async function loadCloudUserData(uid: string): Promise<CloudUserData | null> {
  const instances = getFirebaseInstances();
  if (!instances) return null;
  const ref = doc(instances.db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as CloudUserData;
}

export async function saveCloudUserData(uid: string, data: CloudUserData): Promise<void> {
  const instances = getFirebaseInstances();
  if (!instances) return;
  const ref = doc(instances.db, 'users', uid);
  // Firestore does not allow undefined fields anywhere in nested documents
  const sanitized = JSON.parse(
    JSON.stringify({
      ...data,
      updatedAt: new Date().toISOString(),
    })
  );
  await setDoc(ref, sanitized, { merge: true });
}
