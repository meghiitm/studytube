import type { Course, CourseRoadmap, StudyStats, UserProgress } from '@/types/course';
import type { AuthUser, CloudUserData } from './firebase';

export interface PuterUserRecord {
  uuid?: string;
  username?: string;
  email?: string;
}

declare global {
  interface Window {
    puter?: {
      ai?: {
        chat: (prompt: string) => Promise<any>;
      };
      auth?: {
        isSignedIn?: () => boolean;
        signIn: (options?: { attempt_temp_user_creation?: boolean }) => Promise<any>;
        getUser: () => Promise<PuterUserRecord>;
        signOut: () => Promise<void>;
      };
      kv?: {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string) => Promise<boolean>;
      };
    };
  }
}

const PUTER_SCRIPT_URL = 'https://js.puter.com/v2/';
const PUTER_COURSES_KEY = 'studytube_courses_v1';
const PUTER_STATE_KEY = 'studytube_state_v1';

let puterLoadPromise: Promise<void> | null = null;

/**
 * Loads the Puter.js client SDK once per session so auth.signIn() can run
 * synchronously inside click handlers without popup blocking.
 */
export function loadPuterScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Puter SDK only runs in the browser'));
  }
  if (window.puter) return Promise.resolve();
  if (puterLoadPromise) return puterLoadPromise;

  puterLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PUTER_SCRIPT_URL}"]`
    );
    if (existing) {
      if (window.puter) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Puter.js')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = PUTER_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      puterLoadPromise = null;
      reject(new Error('Failed to load Puter.js'));
    };
    document.head.appendChild(script);
  });

  return puterLoadPromise;
}

export function mapPuterUserToAuthUser(record: PuterUserRecord): AuthUser {
  const username = record.username || 'Student';
  return {
    uid: `puter:${record.uuid || username}`,
    displayName: username,
    email: record.email || `${username}@puter.cloud`,
    photoURL: null,
  };
}

export async function getPuterUserIfSignedIn(): Promise<AuthUser | null> {
  await loadPuterScript();
  const auth = window.puter?.auth;
  if (!auth) return null;
  if (typeof auth.isSignedIn === 'function' && !auth.isSignedIn()) {
    return null;
  }
  try {
    const user = await auth.getUser();
    if (!user || (!user.uuid && !user.username)) return null;
    return mapPuterUserToAuthUser(user);
  } catch {
    return null;
  }
}

export async function signInWithPuter(): Promise<AuthUser> {
  if (!window.puter?.auth) {
    await loadPuterScript();
  }
  const auth = window.puter?.auth;
  if (!auth) {
    throw new Error('Puter 1-click sign-in SDK could not be loaded.');
  }
  await auth.signIn();
  const user = await auth.getUser();
  if (!user || (!user.uuid && !user.username)) {
    throw new Error('Sign-in was cancelled or did not return an account.');
  }
  return mapPuterUserToAuthUser(user);
}

export async function signOutPuter(): Promise<void> {
  if (!window.puter?.auth) return;
  try {
    await window.puter.auth.signOut();
  } catch {
    // Ignore sign-out errors if session already cleared
  }
}

export async function loadPuterCloudData(): Promise<CloudUserData | null> {
  await loadPuterScript();
  const kv = window.puter?.kv;
  if (!kv) return null;

  const [rawCourses, rawState] = await Promise.all([
    kv.get(PUTER_COURSES_KEY),
    kv.get(PUTER_STATE_KEY),
  ]);

  if (!rawCourses && !rawState) return null;

  let courses: Course[] = [];
  let state: {
    progress?: Record<string, UserProgress>;
    stats?: StudyStats;
    roadmaps?: CourseRoadmap[];
    updatedAt?: string;
  } = {};

  if (rawCourses) {
    try {
      const parsed = JSON.parse(rawCourses);
      if (Array.isArray(parsed)) courses = parsed;
    } catch {
      courses = [];
    }
  }

  if (rawState) {
    try {
      state = JSON.parse(rawState) || {};
    } catch {
      state = {};
    }
  }

  return {
    courses,
    progress: state.progress || {},
    stats: state.stats || {
      currentStreak: 0,
      bestStreak: 0,
      lastStudyDate: null,
      studyDates: [],
    },
    roadmaps: state.roadmaps || [],
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
}

/**
 * Splits courses and study state across two Puter KV keys so payloads stay
 * well below Puter KV's per-key size limit (~399 KB).
 */
export async function savePuterCloudData(data: CloudUserData): Promise<void> {
  await loadPuterScript();
  const kv = window.puter?.kv;
  if (!kv) {
    throw new Error('Puter cloud storage is unavailable.');
  }

  const statePayload = JSON.stringify({
    progress: data.progress,
    stats: data.stats,
    roadmaps: data.roadmaps,
    updatedAt: data.updatedAt,
  });

  const coursesPayload = JSON.stringify(data.courses);

  await Promise.all([
    kv.set(PUTER_STATE_KEY, statePayload),
    kv.set(PUTER_COURSES_KEY, coursesPayload),
  ]);
}
