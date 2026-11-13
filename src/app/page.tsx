'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { CourseImporter } from '@/components/CourseImporter';
import { SettingsModal } from '@/components/SettingsModal';
import { RoadmapModal, decodeRoadmapFromParam } from '@/components/RoadmapModal';
import { AuthButton } from '@/components/AuthButton';
import { useCourses } from '@/context/CourseContext';
import { Course, Lesson, UserProgress } from '@/types/course';
import {
  Settings,
  Play,
  Sparkles,
  ArrowRight,
  BookOpen,
  Trash2,
  GraduationCap,
  Flame,
  Sun,
  Moon,
  Map,
  Search,
  X,
  CheckCircle2,
  Bookmark,
  FileText,
  Brain,
  Award,
  Clock,
  BarChart3,
  CalendarDays,
  Plus,
} from 'lucide-react';
import Link from 'next/link';

type CatalogFilter = 'all' | 'in_progress' | 'completed' | 'not_started';

interface CourseSummary {
  course: Course;
  prog?: UserProgress;
  completedCount: number;
  knownCount: number;
  coveredCount: number;
  totalLessons: number;
  percent: number;
  notesCount: number;
  bookmarksCount: number;
  quizzesCompleted: number;
  avgQuizScore: number | null;
  flashcardsTotal: number;
  flashcardsDue: number;
  paceMinutes?: 30 | 60 | 90 | 120;
  resumeLesson: Lesson | undefined;
  resumeIndex: number;
}

function summarizeCourse(course: Course, prog: UserProgress | undefined, nowIso: string): CourseSummary {
  const completedSet = new Set(prog?.completedLessonIds || []);
  const knownSet = new Set(prog?.knownLessonIds || []);
  const coveredSet = new Set([...completedSet, ...knownSet]);

  const completedCount = completedSet.size;
  const knownCount = knownSet.size;
  const coveredCount = coveredSet.size;
  const totalLessons = course.lessons.length;
  const percent =
    totalLessons > 0 ? Math.min(100, Math.round((coveredCount / totalLessons) * 100)) : 0;

  const notesCount = Object.values(prog?.personalNotes || {}).filter(
    (txt) => txt && txt.trim().length > 0
  ).length;
  const bookmarksCount = (prog?.bookmarkedLessonIds || []).length;

  const quizValues = Object.values(prog?.quizScores || {});
  const quizzesCompleted = quizValues.length;
  const avgQuizScore =
    quizzesCompleted > 0
      ? Math.round(quizValues.reduce((sum, v) => sum + v, 0) / quizzesCompleted)
      : null;

  const cards = prog?.flashcards || [];
  const flashcardsTotal = cards.length;
  const flashcardsDue = nowIso
    ? cards.filter((c) => !c.nextReviewAt || c.nextReviewAt <= nowIso).length
    : 0;

  let resumeIndex = -1;
  if (prog?.lastVisitedLessonId) {
    resumeIndex = course.lessons.findIndex((l) => l.id === prog.lastVisitedLessonId);
  }
  if (resumeIndex === -1) {
    resumeIndex = course.lessons.findIndex((l) => !coveredSet.has(l.id));
  }
  if (resumeIndex === -1 && course.lessons.length > 0) {
    resumeIndex = 0;
  }

  return {
    course,
    prog,
    completedCount,
    knownCount,
    coveredCount,
    totalLessons,
    percent,
    notesCount,
    bookmarksCount,
    quizzesCompleted,
    avgQuizScore,
    flashcardsTotal,
    flashcardsDue,
    paceMinutes: prog?.dailyPaceMinutes,
    resumeLesson: resumeIndex >= 0 ? course.lessons[resumeIndex] : undefined,
    resumeIndex,
  };
}

function getLast14Days(
  studyDates: string[],
  anchorIso: string
): { date: string; label: string; active: boolean }[] {
  if (!anchorIso) {
    return Array.from({ length: 14 }, (_, idx) => ({
      date: `day-${idx}`,
      label: '',
      active: false,
    }));
  }
  const activeSet = new Set(studyDates);
  const anchor = new Date(anchorIso);
  const days: { date: string; label: string; active: boolean }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    days.push({ date: iso, label, active: activeSet.has(iso) });
  }
  return days;
}

export default function HomePage() {
  const {
    courses,
    progress,
    stats,
    roadmaps,
    darkMode,
    isLoaded,
    toggleDarkMode,
    deleteCourse,
    addRoadmap,
    deleteRoadmap,
  } = useCourses();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');
  const [clientNowIso, setClientNowIso] = useState('');
  const [sharedRoadmap, setSharedRoadmap] = useState<{
    title: string;
    description: string;
    items: { id: string; title: string; url: string }[];
  } | null>(null);

  useEffect(() => {
    setClientNowIso(new Date().toISOString());
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const rmParam = sp.get('roadmap');
    if (rmParam) {
      const decoded = decodeRoadmapFromParam(rmParam);
      if (decoded) setSharedRoadmap(decoded);
    }
  }, []);

  const courseSummaries = useMemo(
    () => courses.map((c) => summarizeCourse(c, progress[c.id], clientNowIso)),
    [courses, progress, clientNowIso]
  );

  const overallStats = useMemo(() => {
    let totalLessons = 0;
    let totalCompleted = 0;
    let totalKnown = 0;
    let totalCovered = 0;
    let totalNotes = 0;
    let totalBookmarks = 0;
    let totalQuizzesTaken = 0;
    let quizScoreSum = 0;
    let flashcardsTotal = 0;
    let flashcardsDue = 0;
    let completedCourses = 0;
    let inProgressCourses = 0;
    let notStartedCourses = 0;

    for (const s of courseSummaries) {
      totalLessons += s.totalLessons;
      totalCompleted += s.completedCount;
      totalKnown += s.knownCount;
      totalCovered += s.coveredCount;
      totalNotes += s.notesCount;
      totalBookmarks += s.bookmarksCount;
      flashcardsTotal += s.flashcardsTotal;
      flashcardsDue += s.flashcardsDue;

      const scores = Object.values(s.prog?.quizScores || {});
      totalQuizzesTaken += scores.length;
      quizScoreSum += scores.reduce((a, b) => a + b, 0);

      if (s.totalLessons > 0 && s.percent >= 100) {
        completedCourses += 1;
      } else if (s.coveredCount > 0 || s.notesCount > 0 || s.quizzesCompleted > 0 || s.prog?.lastVisitedLessonId) {
        inProgressCourses += 1;
      } else {
        notStartedCourses += 1;
      }
    }

    const overallPercent =
      totalLessons > 0 ? Math.min(100, Math.round((totalCovered / totalLessons) * 100)) : 0;
    const avgQuizScore =
      totalQuizzesTaken > 0 ? Math.round(quizScoreSum / totalQuizzesTaken) : null;

    return {
      totalLessons,
      totalCompleted,
      totalKnown,
      totalCovered,
      overallPercent,
      totalNotes,
      totalBookmarks,
      totalQuizzesTaken,
      avgQuizScore,
      flashcardsTotal,
      flashcardsDue,
      completedCourses,
      inProgressCourses,
      notStartedCourses,
    };
  }, [courseSummaries]);

  const activeSpotlight = useMemo(() => {
    if (courseSummaries.length === 0) return null;
    return (
      courseSummaries.find((s) => s.prog?.lastVisitedLessonId && s.percent < 100) ||
      courseSummaries.find((s) => s.percent > 0 && s.percent < 100) ||
      courseSummaries.find((s) => s.percent < 100) ||
      courseSummaries[0]
    );
  }, [courseSummaries]);

  const savedItems = useMemo(() => {
    const items: {
      courseId: string;
      courseTitle: string;
      lessonId: string;
      lessonTitle: string;
      bookmarked: boolean;
      notePreview: string;
    }[] = [];

    for (const s of courseSummaries) {
      const bmSet = new Set(s.prog?.bookmarkedLessonIds || []);
      const notesMap = s.prog?.personalNotes || {};

      for (const lesson of s.course.lessons) {
        const isBm = bmSet.has(lesson.id);
        const noteText = (notesMap[lesson.id] || '').trim();
        if (isBm || noteText.length > 0) {
          items.push({
            courseId: s.course.id,
            courseTitle: s.course.title,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            bookmarked: isBm,
            notePreview: noteText,
          });
        }
      }
    }
    return items.slice(0, 6);
  }, [courseSummaries]);

  const filteredSummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return courseSummaries.filter((s) => {
      if (catalogFilter === 'completed' && !(s.totalLessons > 0 && s.percent >= 100)) {
        return false;
      }
      if (
        catalogFilter === 'in_progress' &&
        !(
          s.percent < 100 &&
          (s.coveredCount > 0 ||
            s.notesCount > 0 ||
            s.quizzesCompleted > 0 ||
            Boolean(s.prog?.lastVisitedLessonId))
        )
      ) {
        return false;
      }
      if (
        catalogFilter === 'not_started' &&
        (s.coveredCount > 0 ||
          s.notesCount > 0 ||
          s.quizzesCompleted > 0 ||
          Boolean(s.prog?.lastVisitedLessonId))
      ) {
        return false;
      }

      if (!q) return true;
      return (
        s.course.title.toLowerCase().includes(q) ||
        (s.course.author || '').toLowerCase().includes(q) ||
        s.course.description.toLowerCase().includes(q) ||
        s.course.lessons.some((l) => l.title.toLowerCase().includes(q))
      );
    });
  }, [courseSummaries, searchQuery, catalogFilter]);

  const last14Days = useMemo(
    () => getLast14Days(stats.studyDates, clientNowIso),
    [stats.studyDates, clientNowIso]
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white font-sans transition-colors">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white font-extrabold text-sm h-9 w-9 flex items-center justify-center rounded-xl shadow-md border border-slate-700/40 group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
                ST
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
                StudyTube
              </span>
            </Link>

            <div className="hidden lg:flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <a
                href="#progress"
                className="px-3 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
              >
                Progress
              </a>
              <a
                href="#catalog"
                className="px-3 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
              >
                My Courses ({courses.length})
              </a>
              <a
                href="#saved"
                className="px-3 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
              >
                Saved & Roadmaps
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Study Streak Badge */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 text-xs font-bold"
              title={`Best streak: ${stats.bestStreak} days`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-current" />
              <span>{stats.currentStreak}d streak</span>
            </div>

            {/* Roadmaps */}
            <button
              type="button"
              onClick={() => setRoadmapOpen(true)}
              className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2 px-3 rounded-full transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Map className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Roadmaps</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 p-2 rounded-full transition-all shadow-sm cursor-pointer"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* 1-Click Sign In / Sync Status */}
            <AuthButton onOpenSettings={() => setSettingsOpen(true)} />

            {/* Settings */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2 px-3 rounded-full transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer"
              title="Platform Settings & Backup"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden md:inline">Settings</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-12">
        {/* Shared Roadmap Banner (from URL ?roadmap=...) */}
        {sharedRoadmap && (
          <div className="p-5 rounded-3xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Shared Study Roadmap
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {sharedRoadmap.title}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {sharedRoadmap.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSharedRoadmap(null)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {sharedRoadmap.items.map((item, idx) => {
                const exists = courses.find((c) => c.id === item.id || c.sourceUrl === item.url);
                return exists ? (
                  <Link
                    key={item.id}
                    href={`/course/${exists.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white transition"
                  >
                    <span>
                      {idx + 1}. {item.title}
                    </span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                ) : (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/70 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
                  >
                    {idx + 1}. {item.title}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Compact Hero & Playlist Importer */}
        <section className="text-center max-w-3xl mx-auto pt-2">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight leading-[1.15]">
            Make your online learning{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              easy & focused.
            </span>
          </h1>

          <p className="text-sm sm:text-base font-bold tracking-tight mb-5 flex flex-wrap items-center justify-center gap-2">
            <span className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-2xl shadow-sm">
              No ads,
            </span>
            <span className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 px-3 py-1 rounded-2xl shadow-sm">
              no distractions,
            </span>
            <span className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-2xl shadow-sm">
              structured learning.
            </span>
          </p>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto mb-6 leading-relaxed">
            Turn any YouTube video or playlist into a complete course with timestamps, transcripts, spaced-repetition flashcards, quizzes, and a daily study pace.
          </p>

          <CourseImporter />
        </section>

        {/* Visible Progress & Study Overview Dashboard */}
        <section id="progress" className="space-y-5 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Your Learning Progress
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isLoaded
                ? `${courses.length} course${courses.length === 1 ? '' : 's'} tracked · ${stats.studyDates.length} active study day${stats.studyDates.length === 1 ? '' : 's'}`
                : 'Loading your study progress...'}
            </span>
          </div>

          {/* 4 KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Overall Completion */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Course Completion
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    {overallStats.overallPercent}%
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {overallStats.totalCovered}/{overallStats.totalLessons} lessons
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2.5">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${overallStats.overallPercent}%` }}
                  />
                </div>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>{overallStats.totalCompleted} done</span>
                <span>{overallStats.totalKnown} skipped</span>
              </div>
            </div>

            {/* Quiz Mastery */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Quiz Mastery
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    {overallStats.avgQuizScore !== null ? `${overallStats.avgQuizScore}%` : '—'}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    avg score
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2.5">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${overallStats.avgQuizScore ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {overallStats.totalQuizzesTaken} lesson quiz
                {overallStats.totalQuizzesTaken === 1 ? '' : 'zes'} completed
              </div>
            </div>

            {/* Notes & Bookmarks */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Notes & Bookmarks
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-4">
                <div>
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    {overallStats.totalNotes}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">
                    notes
                  </span>
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    {overallStats.totalBookmarks}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">
                    saved
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Timestamped Markdown notes & clips
              </div>
            </div>

            {/* Flashcards & Streak */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Streak & Flashcards
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center">
                  <Brain className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-4">
                <div>
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    {stats.currentStreak}d
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">
                    streak
                  </span>
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    {overallStats.flashcardsDue}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">
                    due
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Best: {stats.bestStreak}d</span>
                <span>{overallStats.flashcardsTotal} total cards</span>
              </div>
            </div>
          </div>

          {/* Continue Learning Spotlight + 14-Day Activity Tracker */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {activeSpotlight ? (
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-5 items-stretch">
                <div className="relative sm:w-56 aspect-video sm:aspect-auto rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                  <img
                    src={activeSpotlight.course.thumbnail}
                    alt={activeSpotlight.course.title}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-slate-900/80 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider">
                    {activeSpotlight.percent > 0 ? 'Continue Learning' : 'Recommended Next'}
                  </span>
                </div>

                <div className="flex-1 flex flex-col justify-between gap-3 min-w-0">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {activeSpotlight.course.author || 'Course'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {activeSpotlight.paceMinutes && (
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {activeSpotlight.paceMinutes}m/day
                          </span>
                        )}
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                          {activeSpotlight.percent}% Done
                        </span>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                      {activeSpotlight.course.title}
                    </h3>

                    {activeSpotlight.resumeLesson && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        Up next: <strong className="text-slate-700 dark:text-slate-200">Lesson {activeSpotlight.resumeIndex + 1} — {activeSpotlight.resumeLesson.title}</strong>
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>
                          {activeSpotlight.coveredCount} of {activeSpotlight.totalLessons} lessons covered
                        </span>
                        <span>
                          {activeSpotlight.notesCount} notes · {activeSpotlight.quizzesCompleted} quizzes
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${activeSpotlight.percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Link
                        href={
                          activeSpotlight.resumeLesson
                            ? `/course/${activeSpotlight.course.id}?lesson=${encodeURIComponent(activeSpotlight.resumeLesson.id)}`
                            : `/course/${activeSpotlight.course.id}`
                        }
                        className="bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-semibold py-2 px-4 rounded-full transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>
                          {activeSpotlight.percent > 0 ? 'Resume Lesson' : 'Start First Lesson'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {activeSpotlight.course.totalDuration || `${activeSpotlight.totalLessons} lessons`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Paste any YouTube playlist link above to create your first structured course.
                </p>
              </div>
            )}

            {/* 14-Day Study Activity Card */}
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Last 14 Days Activity
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  Best: {stats.bestStreak}d
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {last14Days.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.label}: ${day.active ? 'Studied' : 'No activity'}`}
                    className={`h-8 rounded-xl border flex flex-col items-center justify-center text-[10px] font-semibold transition ${
                      day.active
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-gray-100 dark:border-slate-800 text-slate-400'
                    }`}
                  >
                    {day.label ? day.date.slice(8) : '·'}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-gray-100 dark:border-slate-800">
                <span>Complete a lesson, quiz, or card daily</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {last14Days.filter((d) => d.active).length}/14 days
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Course Catalog Section with Progress Bars, Status Tabs & Search */}
        <section id="catalog" className="space-y-6 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2.5 flex-wrap">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Your Courses
              </h2>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                {filteredSummaries.length}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Segmented Filter Tabs */}
              <div className="inline-flex p-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-gray-200/70 dark:border-slate-800 text-[11px] font-semibold overflow-x-auto">
                {[
                  { id: 'all', label: `All (${courses.length})` },
                  { id: 'in_progress', label: `In Progress (${overallStats.inProgressCourses})` },
                  { id: 'completed', label: `Done (${overallStats.completedCourses})` },
                  { id: 'not_started', label: `New (${overallStats.notStartedCourses})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCatalogFilter(tab.id as CatalogFilter)}
                    className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
                      catalogFilter === tab.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Client-Side Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search courses or topics..."
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-full text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {filteredSummaries.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl border border-gray-100 dark:border-slate-800 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                No courses match this filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCatalogFilter('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-100 transition cursor-pointer"
              >
                Show all courses
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredSummaries.map((s) => {
                const statusBadge =
                  s.percent >= 100
                    ? {
                        label: 'Completed',
                        cls: 'bg-emerald-500 text-white',
                      }
                    : s.coveredCount > 0 || s.notesCount > 0 || s.quizzesCompleted > 0 || s.prog?.lastVisitedLessonId
                    ? {
                        label: `${s.percent}% Complete`,
                        cls: 'bg-blue-600 text-white',
                      }
                    : {
                        label: 'Not Started',
                        cls: 'bg-slate-900/80 text-white',
                      };

                return (
                  <div
                    key={s.course.id}
                    className="group bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <img
                          src={s.course.thumbnail}
                          alt={s.course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <span
                          className={`absolute top-3 left-3 px-3 py-1 rounded-full backdrop-blur text-[11px] font-bold shadow-sm ${statusBadge.cls}`}
                        >
                          {statusBadge.label}
                        </span>
                        <span className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur text-white text-xs font-mono font-medium">
                          {s.course.totalDuration || `${s.totalLessons} Lessons`}
                        </span>
                      </div>

                      <div className="p-6 space-y-3.5">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
                          <span className="font-semibold text-blue-600 dark:text-blue-400 truncate">
                            {s.course.author || 'Instructor'}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {s.paceMinutes && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold text-[11px]">
                                {s.paceMinutes}m/day
                              </span>
                            )}
                            {s.knownCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
                                {s.knownCount} known
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                            {s.course.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mt-1">
                            {s.course.description}
                          </p>
                        </div>

                        {/* Always-Visible Per-Course Progress Bar */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold">
                            <span className="text-slate-700 dark:text-slate-200">
                              {s.coveredCount} / {s.totalLessons} lessons covered
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {s.percent}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                s.percent >= 100
                                  ? 'bg-emerald-500'
                                  : 'bg-gradient-to-r from-blue-600 to-indigo-500'
                              }`}
                              style={{ width: `${s.percent}%` }}
                            />
                          </div>
                        </div>

                        {/* Granular Course Metrics Row */}
                        <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                          <div className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {s.quizzesCompleted}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {s.avgQuizScore !== null ? `${s.avgQuizScore}% avg` : 'Quizzes'}
                            </div>
                          </div>
                          <div className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {s.notesCount}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">Notes</div>
                          </div>
                          <div className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {s.bookmarksCount}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">Saved</div>
                          </div>
                          <div className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {s.flashcardsTotal}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {s.flashcardsDue > 0 ? `${s.flashcardsDue} due` : 'Cards'}
                            </div>
                          </div>
                        </div>

                        {s.resumeLesson && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            Next: <span className="font-semibold text-slate-700 dark:text-slate-300">{s.resumeIndex + 1}. {s.resumeLesson.title}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-6 pb-5 pt-2 border-t border-gray-50 dark:border-slate-800 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove "${s.course.title}"?`)) {
                            deleteCourse(s.course.id);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-500 p-2 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        title="Remove course"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <Link
                        href={`/course/${s.course.id}`}
                        className="bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold py-2.5 px-5 rounded-full transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                      >
                        <span>
                          {s.percent >= 100
                            ? 'Review Course'
                            : s.coveredCount > 0 || s.prog?.lastVisitedLessonId
                            ? 'Continue Studying'
                            : 'Start Course'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Bookmarks, Saved Notes & Study Roadmaps Section */}
        <section id="saved" className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-24">
          {/* Bookmarked Lessons & Notes */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Bookmarks & Quick Notes
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {savedItems.length} item{savedItems.length === 1 ? '' : 's'}
              </span>
            </div>

            {savedItems.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-gray-200 dark:border-slate-700 text-center space-y-1.5">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  No bookmarks or personal notes yet
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Open any lesson to bookmark key videos or write timestamped Markdown notes—they will appear here for 1-click access.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {savedItems.map((item) => (
                  <Link
                    key={`${item.courseId}:${item.lessonId}`}
                    href={`/course/${item.courseId}?lesson=${encodeURIComponent(item.lessonId)}`}
                    className="block p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50/70 dark:hover:bg-blue-950/30 border border-gray-100 dark:border-slate-800 transition group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 truncate">
                        {item.courseTitle}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.bookmarked && (
                          <Bookmark className="w-3.5 h-3.5 text-amber-500 fill-current" />
                        )}
                        {item.notePreview && (
                          <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        )}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate mt-0.5">
                      {item.lessonTitle}
                    </div>
                    {item.notePreview && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                        {item.notePreview}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Study Roadmaps */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Map className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Study Roadmaps
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRoadmapOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[11px] font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Manage Roadmaps
              </button>
            </div>

            {roadmaps.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-gray-200 dark:border-slate-700 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Combine multiple courses into a shareable Semester or Subject Roadmap
                </p>
                <button
                  type="button"
                  onClick={() => setRoadmapOpen(true)}
                  className="px-4 py-1.5 rounded-full bg-slate-900 dark:bg-blue-600 text-white text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                >
                  Create Your First Roadmap
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {roadmaps.slice(0, 3).map((rm) => (
                  <div
                    key={rm.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {rm.title}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                        {rm.courseIds.length} courses
                      </span>
                    </div>
                    {rm.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {rm.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {rm.courseIds.map((cid, idx) => {
                        const c = courses.find((x) => x.id === cid);
                        if (!c) return null;
                        return (
                          <Link
                            key={cid}
                            href={`/course/${c.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-blue-500 transition"
                          >
                            {idx + 1}. {c.title}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 3 Feature Pillars (Everything Built-In) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
          <div className="group bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
                <Play className="w-5 h-5 fill-current" />
              </div>
              <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                01
              </span>
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1.5">
              Pace Planner & Placement
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Test out of topics you already know and split remaining lessons into a 30–120 min/day roadmap.
            </p>
          </div>

          <div className="group bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                02
              </span>
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1.5">
              Replay & Timestamp Notes
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Capture live timestamps with spoken transcripts, export Markdown, and replay exact quiz explanations.
            </p>
          </div>

          <div className="group bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                03
              </span>
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1.5">
              Flashcards & Cloud Sync
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Leitner spaced-repetition flashcards, Pomodoro focus timer, and 1-click cross-device cloud sync.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 py-8 text-center text-xs text-slate-400 mt-12">
        <p className="font-medium text-slate-500 dark:text-slate-400">
          StudyTube &bull; Distraction-Free YouTube Learning
        </p>
      </footer>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RoadmapModal
        isOpen={roadmapOpen}
        onClose={() => setRoadmapOpen(false)}
        courses={courses}
        roadmaps={roadmaps}
        onAddRoadmap={addRoadmap}
        onDeleteRoadmap={deleteRoadmap}
      />
    </div>
  );
}
