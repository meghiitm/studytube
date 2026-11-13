'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Course,
  UserProgress,
  StudyStats,
  Flashcard,
  CourseRoadmap,
} from '@/types/course';
import { SAMPLE_COURSES } from '@/lib/sampleCourses';
import {
  AuthUser,
  getActiveFirebaseConfig,
  parseFirebaseConfigInput,
  subscribeFirebaseAuth,
  signInWithGooglePopup,
  signOutFirebase,
  loadCloudUserData,
  saveCloudUserData,
  CloudUserData,
} from '@/lib/firebase';
import {
  loadPuterScript,
  getPuterUserIfSignedIn,
  signInWithPuter,
  signOutPuter,
  loadPuterCloudData,
  savePuterCloudData,
} from '@/lib/puter';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';
export type AuthProviderKind = 'firebase' | 'puter' | null;

interface CourseContextType {
  courses: Course[];
  progress: Record<string, UserProgress>;
  stats: StudyStats;
  roadmaps: CourseRoadmap[];
  apiKey: string;
  darkMode: boolean;
  isLoaded: boolean;
  user: AuthUser | null;
  authProvider: AuthProviderKind;
  authLoading: boolean;
  firebaseConfigured: boolean;
  firebaseConfigSource: 'env' | 'local' | null;
  firebaseConfigText: string;
  syncStatus: SyncStatus;
  syncError: string | null;
  setApiKey: (key: string) => void;
  toggleDarkMode: () => void;
  saveFirebaseConfig: (rawConfig: string) => boolean;
  clearFirebaseConfig: () => void;
  signInOneClick: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  addCourse: (course: Course) => void;
  deleteCourse: (id: string) => void;
  getCourse: (id: string) => Course | undefined;
  markLessonCompleted: (courseId: string, lessonId: string, completed?: boolean) => void;
  markLessonsKnown: (courseId: string, lessonIds: string[]) => void;
  toggleLessonKnown: (courseId: string, lessonId: string) => void;
  toggleLessonBookmark: (courseId: string, lessonId: string) => void;
  setDailyPace: (courseId: string, minutes: 30 | 60 | 90 | 120) => void;
  saveQuizScore: (courseId: string, lessonId: string, score: number) => void;
  savePersonalNote: (courseId: string, lessonId: string, note: string) => void;
  setCourseFlashcards: (courseId: string, cards: Flashcard[]) => void;
  addFlashcard: (courseId: string, front: string, back: string, lessonId?: string) => void;
  reviewFlashcard: (courseId: string, cardId: string, knewIt: boolean) => void;
  addRoadmap: (roadmap: CourseRoadmap) => void;
  deleteRoadmap: (id: string) => void;
  importFullBackup: (payload: {
    courses?: Course[];
    progress?: Record<string, UserProgress>;
    stats?: StudyStats;
    roadmaps?: CourseRoadmap[];
  }) => void;
  resetProgress: (courseId: string) => void;
}

const DEFAULT_STATS: StudyStats = {
  currentStreak: 0,
  bestStreak: 0,
  lastStudyDate: null,
  studyDates: [],
};

const CourseContext = createContext<CourseContextType | undefined>(undefined);

function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function emptyProgress(courseId: string): UserProgress {
  return {
    courseId,
    completedLessonIds: [],
    knownLessonIds: [],
    bookmarkedLessonIds: [],
    dailyPaceMinutes: 60,
    quizScores: {},
    personalNotes: {},
    flashcards: [],
  };
}

function mergeCourses(localList: Course[], cloudList: Course[]): Course[] {
  const map = new Map<string, Course>();
  for (const c of cloudList) map.set(c.id, c);
  for (const c of localList) {
    if (!map.has(c.id)) map.set(c.id, c);
  }
  for (const s of SAMPLE_COURSES) {
    if (!map.has(s.id)) map.set(s.id, s);
  }
  return Array.from(map.values());
}

function mergeProgress(
  localProg: Record<string, UserProgress>,
  cloudProg: Record<string, UserProgress>
): Record<string, UserProgress> {
  const allIds = new Set([...Object.keys(localProg), ...Object.keys(cloudProg)]);
  const merged: Record<string, UserProgress> = {};

  for (const cid of allIds) {
    const l = localProg[cid] || emptyProgress(cid);
    const c = cloudProg[cid] || emptyProgress(cid);

    const cardMap = new Map<string, Flashcard>();
    for (const fc of c.flashcards || []) cardMap.set(fc.id, fc);
    for (const fc of l.flashcards || []) {
      if (!cardMap.has(fc.id)) cardMap.set(fc.id, fc);
    }

    const quizScores = { ...(c.quizScores || {}) };
    for (const [lid, score] of Object.entries(l.quizScores || {})) {
      quizScores[lid] = Math.max(quizScores[lid] ?? 0, score);
    }

    const personalNotes = { ...(c.personalNotes || {}) };
    for (const [lid, text] of Object.entries(l.personalNotes || {})) {
      if (text && (!personalNotes[lid] || text.length > personalNotes[lid].length)) {
        personalNotes[lid] = text;
      }
    }

    merged[cid] = {
      courseId: cid,
      completedLessonIds: Array.from(
        new Set([...(c.completedLessonIds || []), ...(l.completedLessonIds || [])])
      ),
      knownLessonIds: Array.from(
        new Set([...(c.knownLessonIds || []), ...(l.knownLessonIds || [])])
      ),
      bookmarkedLessonIds: Array.from(
        new Set([...(c.bookmarkedLessonIds || []), ...(l.bookmarkedLessonIds || [])])
      ),
      dailyPaceMinutes: l.dailyPaceMinutes || c.dailyPaceMinutes || 60,
      quizScores,
      personalNotes,
      flashcards: Array.from(cardMap.values()),
      lastVisitedLessonId: l.lastVisitedLessonId || c.lastVisitedLessonId,
    };
  }

  return merged;
}

function mergeStats(localStats: StudyStats, cloudStats?: StudyStats): StudyStats {
  if (!cloudStats) return localStats;
  const dates = Array.from(
    new Set([...(cloudStats.studyDates || []), ...(localStats.studyDates || [])])
  )
    .sort()
    .slice(-90);
  const lastStudyDate =
    [cloudStats.lastStudyDate, localStats.lastStudyDate].filter(Boolean).sort().pop() || null;

  return {
    currentStreak: Math.max(cloudStats.currentStreak || 0, localStats.currentStreak || 0),
    bestStreak: Math.max(cloudStats.bestStreak || 0, localStats.bestStreak || 0),
    lastStudyDate,
    studyDates: dates,
  };
}

export function CourseProvider({ children }: { children: React.ReactNode }) {
  const [courses, setCourses] = useState<Course[]>(SAMPLE_COURSES);
  const [progress, setProgress] = useState<Record<string, UserProgress>>({});
  const [stats, setStats] = useState<StudyStats>(DEFAULT_STATS);
  const [roadmaps, setRoadmaps] = useState<CourseRoadmap[]>([]);
  const [apiKey, setApiKey] = useState<string>('');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Auth & Sync state (Firebase Google Sign-In or zero-config 1-click Puter Cloud Sync)
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authProvider, setAuthProvider] = useState<AuthProviderKind>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [firebaseConfigured, setFirebaseConfigured] = useState(false);
  const [firebaseConfigSource, setFirebaseConfigSource] = useState<'env' | 'local' | null>(null);
  const [firebaseConfigText, setFirebaseConfigText] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [syncError, setSyncError] = useState<string | null>(null);

  const cloudHydratedUidRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from LocalStorage (with fallback migration from legacy keys)
  useEffect(() => {
    try {
      const storedCourses =
        localStorage.getItem('studytube_courses') || localStorage.getItem('opencourseit_courses');
      if (storedCourses) {
        const parsed = JSON.parse(storedCourses);
        const combined = [...parsed];
        for (const sample of SAMPLE_COURSES) {
          if (!combined.some((c: Course) => c.id === sample.id)) {
            combined.push(sample);
          }
        }
        setCourses(combined);
      }

      const storedProgress =
        localStorage.getItem('studytube_progress') || localStorage.getItem('opencourseit_progress');
      if (storedProgress) {
        setProgress(JSON.parse(storedProgress));
      }

      const storedStats = localStorage.getItem('studytube_stats');
      if (storedStats) {
        setStats(JSON.parse(storedStats));
      }

      const storedRoadmaps = localStorage.getItem('studytube_roadmaps');
      if (storedRoadmaps) {
        setRoadmaps(JSON.parse(storedRoadmaps));
      }

      const storedKey =
        localStorage.getItem('studytube_gemini_api_key') ||
        localStorage.getItem('opencourseit_gemini_api_key');
      if (storedKey) {
        setApiKey(storedKey);
      }

      const storedDark = localStorage.getItem('studytube_dark_mode');
      if (storedDark === 'true') {
        setDarkMode(true);
      }

      const savedFb = localStorage.getItem('studytube_firebase_config') || '';
      setFirebaseConfigText(savedFb);
      const { config, source } = getActiveFirebaseConfig();
      setFirebaseConfigured(Boolean(config));
      setFirebaseConfigSource(source);
    } catch (e) {
      console.error('Error loading data from localStorage', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const applyMergedCloudData = (cloud: CloudUserData | null) => {
    if (!cloud) return;
    setCourses((prev) => mergeCourses(prev, cloud.courses || []));
    setProgress((prev) => mergeProgress(prev, cloud.progress || {}));
    setStats((prev) => mergeStats(prev, cloud.stats));
    setRoadmaps((prev) => {
      const map = new Map<string, CourseRoadmap>();
      for (const r of cloud.roadmaps || []) map.set(r.id, r);
      for (const r of prev) if (!map.has(r.id)) map.set(r.id, r);
      return Array.from(map.values());
    });
  };

  // Subscribe to Firebase Auth when configured, otherwise preload Puter 1-click auth & restore session
  useEffect(() => {
    if (!isLoaded) return;

    if (!firebaseConfigured) {
      let cancelled = false;
      loadPuterScript()
        .then(() => getPuterUserIfSignedIn())
        .then(async (puterUser) => {
          if (cancelled || !puterUser) return;
          setUser(puterUser);
          setAuthProvider('puter');
          setSyncStatus('syncing');
          setSyncError(null);
          try {
            const cloud = await loadPuterCloudData();
            if (!cancelled) {
              applyMergedCloudData(cloud);
              cloudHydratedUidRef.current = puterUser.uid;
              setSyncStatus('synced');
            }
          } catch (err: any) {
            if (!cancelled) {
              setSyncStatus('error');
              setSyncError(err?.message || 'Failed to sync with Puter Cloud.');
            }
          }
        })
        .catch(() => {
          // Silently stay local if Puter CDN is unreachable offline
        });

      return () => {
        cancelled = true;
      };
    }

    setAuthLoading(true);
    const unsub = subscribeFirebaseAuth(async (fbUser) => {
      setUser(fbUser);
      setAuthProvider(fbUser ? 'firebase' : null);
      setAuthLoading(false);

      if (!fbUser) {
        cloudHydratedUidRef.current = null;
        setSyncStatus('local');
        return;
      }

      if (cloudHydratedUidRef.current === fbUser.uid) return;
      setSyncStatus('syncing');
      setSyncError(null);

      try {
        const cloud = await loadCloudUserData(fbUser.uid);
        applyMergedCloudData(cloud);
        cloudHydratedUidRef.current = fbUser.uid;
        setSyncStatus('synced');
      } catch (err: any) {
        console.error('Cloud sync load error:', err);
        setSyncStatus('error');
        setSyncError(err?.message || 'Failed to sync with Firestore.');
      }
    });

    return () => unsub();
  }, [isLoaded, firebaseConfigured]);

  // Apply dark mode class to root html
  useEffect(() => {
    if (!isLoaded) return;
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('studytube_dark_mode', darkMode ? 'true' : 'false');
  }, [darkMode, isLoaded]);

  // Save to LocalStorage + Debounced Save to Cloud (Firestore or Puter KV) when signed in
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem('studytube_courses', JSON.stringify(courses));
      localStorage.setItem('studytube_progress', JSON.stringify(progress));
      localStorage.setItem('studytube_stats', JSON.stringify(stats));
      localStorage.setItem('studytube_roadmaps', JSON.stringify(roadmaps));
      if (apiKey) {
        localStorage.setItem('studytube_gemini_api_key', apiKey);
      } else {
        localStorage.removeItem('studytube_gemini_api_key');
      }
    } catch (e) {
      console.error('Error saving data to localStorage', e);
    }

    const canSyncFirebase = authProvider === 'firebase' && firebaseConfigured;
    const canSyncPuter = authProvider === 'puter';

    if (user && (canSyncFirebase || canSyncPuter) && cloudHydratedUidRef.current === user.uid) {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      setSyncStatus('syncing');
      syncTimerRef.current = setTimeout(async () => {
        try {
          const payload: CloudUserData = {
            courses,
            progress,
            stats,
            roadmaps,
            updatedAt: new Date().toISOString(),
          };
          if (canSyncFirebase) {
            await saveCloudUserData(user.uid, payload);
          } else {
            await savePuterCloudData(payload);
          }
          setSyncStatus('synced');
          setSyncError(null);
        } catch (err: any) {
          console.error('Cloud sync save error:', err);
          setSyncStatus('error');
          setSyncError(err?.message || 'Failed to save changes to cloud.');
        }
      }, 800);
    }
  }, [courses, progress, stats, roadmaps, apiKey, isLoaded, user, authProvider, firebaseConfigured]);

  const saveFirebaseConfig = (rawConfig: string): boolean => {
    const parsed = parseFirebaseConfigInput(rawConfig);
    if (!parsed) return false;
    const serialized = JSON.stringify(parsed, null, 2);
    localStorage.setItem('studytube_firebase_config', serialized);
    setFirebaseConfigText(serialized);
    setFirebaseConfigured(true);
    setFirebaseConfigSource('local');
    setSyncError(null);
    return true;
  };

  const clearFirebaseConfig = () => {
    localStorage.removeItem('studytube_firebase_config');
    setFirebaseConfigText('');
    const { config, source } = getActiveFirebaseConfig();
    setFirebaseConfigured(Boolean(config));
    setFirebaseConfigSource(source);
    if (!config) {
      cloudHydratedUidRef.current = null;
      setUser(null);
      setAuthProvider(null);
      setSyncStatus('local');
    }
  };

  const signInWithGoogle = async () => {
    setSyncError(null);
    await signInWithGooglePopup();
  };

  const signInOneClick = async () => {
    setSyncError(null);
    if (firebaseConfigured) {
      await signInWithGooglePopup();
      return;
    }

    const puterUser = await signInWithPuter();
    setUser(puterUser);
    setAuthProvider('puter');
    setSyncStatus('syncing');

    try {
      const cloud = await loadPuterCloudData();
      applyMergedCloudData(cloud);
      cloudHydratedUidRef.current = puterUser.uid;
      setSyncStatus('synced');
    } catch (err: any) {
      setSyncStatus('error');
      setSyncError(err?.message || 'Signed in, but cloud sync failed.');
    }
  };

  const signOutUser = async () => {
    if (authProvider === 'puter') {
      await signOutPuter();
    } else if (firebaseConfigured) {
      await signOutFirebase();
    }
    cloudHydratedUidRef.current = null;
    setUser(null);
    setAuthProvider(null);
    setSyncStatus('local');
  };

  const recordStudyActivity = () => {
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();
    setStats((prev) => {
      if (prev.lastStudyDate === today) return prev;
      const nextStreak =
        prev.lastStudyDate === yesterday ? prev.currentStreak + 1 : 1;
      const dates = prev.studyDates.includes(today)
        ? prev.studyDates
        : [...prev.studyDates, today];
      return {
        currentStreak: nextStreak,
        bestStreak: Math.max(prev.bestStreak, nextStreak),
        lastStudyDate: today,
        studyDates: dates.slice(-90),
      };
    });
  };

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  const addCourse = (newCourse: Course) => {
    setCourses((prev) => {
      const filtered = prev.filter((c) => c.id !== newCourse.id);
      return [newCourse, ...filtered];
    });
  };

  const deleteCourse = (id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const getCourse = (id: string) => {
    return courses.find((c) => c.id === id);
  };

  const markLessonCompleted = (courseId: string, lessonId: string, completed: boolean = true) => {
    if (completed) recordStudyActivity();
    setProgress((prev) => {
      const current = prev[courseId] || emptyProgress(courseId);
      const set = new Set(current.completedLessonIds);
      if (completed) {
        set.add(lessonId);
      } else {
        set.delete(lessonId);
      }

      return {
        ...prev,
        [courseId]: {
          ...current,
          completedLessonIds: Array.from(set),
          lastVisitedLessonId: lessonId,
        },
      };
    });
  };

  const markLessonsKnown = (courseId: string, lessonIds: string[]) => {
    recordStudyActivity();
    setProgress((prev) => {
      const current = prev[courseId] || emptyProgress(courseId);
      const knownSet = new Set(lessonIds);
      return {
        ...prev,
        [courseId]: {
          ...current,
          knownLessonIds: Array.from(knownSet),
        },
      };
    });
  };

  const toggleLessonKnown = (courseId: string, lessonId: string) => {
    setProgress((prev) => {
      const current = prev[courseId] || emptyProgress(courseId);
      const set = new Set(current.knownLessonIds || []);
      if (set.has(lessonId)) set.delete(lessonId);
      else set.add(lessonId);
      return {
        ...prev,
        [courseId]: {
          ...current,
          knownLessonIds: Array.from(set),
        },
      };
    });
  };

  const toggleLessonBookmark = (courseId: string, lessonId: string) => {
    setProgress((prev) => {
      const current = prev[courseId] || emptyProgress(courseId);
      const set = new Set(current.bookmarkedLessonIds || []);
      if (set.has(lessonId)) set.delete(lessonId);
      else set.add(lessonId);
      return {
        ...prev,
        [courseId]: {
          ...current,
          bookmarkedLessonIds: Array.from(set),
        },
      };
    });
  };

  const setDailyPace = (courseId: string, minutes: 30 | 60 | 90 | 120) => {
    setProgress((prev) => {
      const current = prev[courseId] || emptyProgress(courseId);
      return {
        ...prev,
        [courseId]: {
          ...current,
          dailyPaceMinutes: minutes,
        },
      };
    });
  };

  const saveQuizScore = (courseId: string, lessonId: string, score: number) => {
    recordStudyActivity();
    setProgress((prev) => {
      const current = prev[courseId] || emptyProgress(courseId);
      return {
        ...prev,
        [courseId]: {
          ...current,
          quizScores: {
            ...current.quizScores,
            [lessonId]: score,
          },
        },
      };
    });
  };

  const savePersonalNote = (courseId: string, lessonId: string, note: string) => {
    setProgress((prev) => {
      const current = prev[courseId] || emptyProgress(courseId);
      return {
        ...prev,
        [courseId]: {
          ...current,
          personalNotes: {
            ...current.personalNotes,
            [lessonId]: note,
          },
        },
      };
    });
  };

  const setCourseFlashcards = (courseId: string, cards: Flashcard[]) => {
    setProgress((prev) => {
      const current = prev[courseId] || emptyProgress(courseId);
      return {
        ...prev,
        [courseId]: {
          ...current,
          flashcards: cards,
        },
      };
    });
  };

  const addFlashcard = (courseId: string, front: string, back: string, lessonId?: string) => {
    const newCard: Flashcard = {
      id: `fc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      front: front.trim(),
      back: back.trim(),
      box: 1,
      nextReviewAt: new Date().toISOString(),
      lessonId,
    };
    setProgress((prev) => {
      const current = prev[courseId] || emptyProgress(courseId);
      return {
        ...prev,
        [courseId]: {
          ...current,
          flashcards: [newCard, ...(current.flashcards || [])],
        },
      };
    });
  };

  const reviewFlashcard = (courseId: string, cardId: string, knewIt: boolean) => {
    recordStudyActivity();
    const daysByBox: Record<number, number> = { 1: 0, 2: 2, 3: 5, 4: 14 };
    setProgress((prev) => {
      const current = prev[courseId] || emptyProgress(courseId);
      const updated = (current.flashcards || []).map((card) => {
        if (card.id !== cardId) return card;
        const nextBox = knewIt
          ? (Math.min(4, card.box + 1) as 1 | 2 | 3 | 4)
          : 1;
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + daysByBox[nextBox]);
        return {
          ...card,
          box: nextBox,
          nextReviewAt: nextDate.toISOString(),
        };
      });
      return {
        ...prev,
        [courseId]: {
          ...current,
          flashcards: updated,
        },
      };
    });
  };

  const addRoadmap = (roadmap: CourseRoadmap) => {
    setRoadmaps((prev) => {
      const filtered = prev.filter((r) => r.id !== roadmap.id);
      return [roadmap, ...filtered];
    });
  };

  const deleteRoadmap = (id: string) => {
    setRoadmaps((prev) => prev.filter((r) => r.id !== id));
  };

  const importFullBackup = (payload: {
    courses?: Course[];
    progress?: Record<string, UserProgress>;
    stats?: StudyStats;
    roadmaps?: CourseRoadmap[];
  }) => {
    if (Array.isArray(payload.courses)) {
      payload.courses.forEach((c) => addCourse(c));
    }
    if (payload.progress && typeof payload.progress === 'object') {
      setProgress((prev) => ({ ...prev, ...payload.progress }));
    }
    if (payload.stats) {
      setStats(payload.stats);
    }
    if (Array.isArray(payload.roadmaps)) {
      payload.roadmaps.forEach((r) => addRoadmap(r));
    }
  };

  const resetProgress = (courseId: string) => {
    setProgress((prev) => {
      const updated = { ...prev };
      delete updated[courseId];
      return updated;
    });
  };

  return (
    <CourseContext.Provider
      value={{
        courses,
        progress,
        stats,
        roadmaps,
        apiKey,
        darkMode,
        isLoaded,
        user,
        authProvider,
        authLoading,
        firebaseConfigured,
        firebaseConfigSource,
        firebaseConfigText,
        syncStatus,
        syncError,
        setApiKey,
        toggleDarkMode,
        saveFirebaseConfig,
        clearFirebaseConfig,
        signInOneClick,
        signInWithGoogle,
        signOut: signOutUser,
        addCourse,
        deleteCourse,
        getCourse,
        markLessonCompleted,
        markLessonsKnown,
        toggleLessonKnown,
        toggleLessonBookmark,
        setDailyPace,
        saveQuizScore,
        savePersonalNote,
        setCourseFlashcards,
        addFlashcard,
        reviewFlashcard,
        addRoadmap,
        deleteRoadmap,
        importFullBackup,
        resetProgress,
      }}
    >
      {children}
    </CourseContext.Provider>
  );
}

export function useCourses() {
  const context = useContext(CourseContext);
  if (!context) {
    throw new Error('useCourses must be used within a CourseProvider');
  }
  return context;
}
