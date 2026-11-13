'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useCourses } from '@/context/CourseContext';
import { YouTubePlayer, SeekRequest, PlayerHandle } from '@/components/YouTubePlayer';
import { QuizCard } from '@/components/QuizCard';
import { TranscriptViewer } from '@/components/TranscriptViewer';
import { NoteEditor } from '@/components/NoteEditor';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { DailyPacePlanner } from '@/components/DailyPacePlanner';
import { PlacementTestModal } from '@/components/PlacementTestModal';
import { FlashcardsDeck } from '@/components/FlashcardsDeck';
import { PuterAIHelper } from '@/components/PuterAIHelper';
import { AuthButton } from '@/components/AuthButton';
import { SettingsModal } from '@/components/SettingsModal';
import { TranscriptSegment, formatSecondsToTime } from '@/lib/youtube';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  FileText,
  HelpCircle,
  Edit3,
  Captions,
  Calendar,
  Layers,
  ChevronRight,
  ChevronLeft,
  Bookmark,
  Printer,
  Share2,
  Sparkles,
  Sun,
  Moon,
  Flame,
  Search,
  Check,
} from 'lucide-react';
import Link from 'next/link';

type CourseTab = 'notes' | 'transcript' | 'quiz' | 'personal' | 'plan' | 'flashcards';

function CoursePlayerContent() {
  const params = useParams();
  const courseId = params?.id as string;
  const {
    getCourse,
    progress,
    stats,
    apiKey,
    darkMode,
    isLoaded,
    toggleDarkMode,
    markLessonCompleted,
    markLessonsKnown,
    toggleLessonBookmark,
    setDailyPace,
    savePersonalNote,
    saveQuizScore,
    setCourseFlashcards,
    addFlashcard,
    reviewFlashcard,
  } = useCourses();

  const course = getCourse(courseId);

  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<CourseTab>('notes');
  const [seekRequest, setSeekRequest] = useState<SeekRequest | null>(null);
  const [initializedLesson, setInitializedLesson] = useState(false);
  const [placementOpen, setPlacementOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syllabusSearch, setSyllabusSearch] = useState('');
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const playerHandleRef = useRef<PlayerHandle | null>(null);

  const [transcriptCache, setTranscriptCache] = useState<
    Record<string, { segments: TranscriptSegment[]; language: string | null }>
  >({});
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  // Restore target ?lesson= query param or last visited lesson once loaded
  useEffect(() => {
    if (isLoaded && course && !initializedLesson) {
      const urlLessonId =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('lesson')
          : null;
      const targetId = urlLessonId || progress[course.id]?.lastVisitedLessonId;
      if (targetId) {
        const idx = course.lessons.findIndex((l) => l.id === targetId);
        if (idx !== -1) setActiveLessonIndex(idx);
      }
      setInitializedLesson(true);
    }
  }, [isLoaded, course, progress, initializedLesson]);

  const currentVideoId = course?.lessons[activeLessonIndex]?.videoId || course?.lessons[0]?.videoId;

  // Fetch real YouTube transcript (no API key needed) and cache per videoId
  useEffect(() => {
    if (!currentVideoId || transcriptCache[currentVideoId]) return;
    let cancelled = false;
    setLoadingTranscript(true);

    fetch(`/api/transcript?videoId=${encodeURIComponent(currentVideoId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setTranscriptCache((prev) => ({
            ...prev,
            [currentVideoId]: {
              segments: Array.isArray(data.segments) ? data.segments : [],
              language: data.language || null,
            },
          }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTranscriptCache((prev) => ({
            ...prev,
            [currentVideoId]: { segments: [], language: null },
          }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTranscript(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentVideoId, transcriptCache]);

  const userProgress = course
    ? progress[course.id] || {
        courseId: course.id,
        completedLessonIds: [],
        knownLessonIds: [],
        bookmarkedLessonIds: [],
        dailyPaceMinutes: 60 as const,
        quizScores: {},
        personalNotes: {},
        flashcards: [],
      }
    : null;

  const filteredLessons = useMemo(() => {
    if (!course || !userProgress) return [];
    const q = syllabusSearch.trim().toLowerCase();
    const bookmarkedSet = new Set(userProgress.bookmarkedLessonIds || []);
    return course.lessons
      .map((lesson, idx) => ({ lesson, idx }))
      .filter(({ lesson }) => {
        if (onlyBookmarked && !bookmarkedSet.has(lesson.id)) return false;
        if (q && !lesson.title.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [course, userProgress, syllabusSearch, onlyBookmarked]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-500 text-sm font-medium">
        Loading course...
      </div>
    );
  }

  if (!course || !userProgress) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col items-center justify-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Course Not Found</h2>
        <p className="text-slate-500 text-sm">The requested course could not be loaded.</p>
        <Link
          href="/"
          className="px-5 py-2.5 bg-slate-900 dark:bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-slate-800 shadow-md transition"
        >
          Back to Courses
        </Link>
      </div>
    );
  }

  const currentLesson = course.lessons[activeLessonIndex] || course.lessons[0];
  const isCurrentCompleted = userProgress.completedLessonIds.includes(currentLesson.id);
  const knownLessonIds = userProgress.knownLessonIds || [];
  const bookmarkedIds = userProgress.bookmarkedLessonIds || [];
  const isCurrentBookmarked = bookmarkedIds.includes(currentLesson.id);

  const completedCount = userProgress.completedLessonIds.length;
  const progressPercent = Math.round((completedCount / course.lessons.length) * 100);

  const currentTranscript = transcriptCache[currentLesson.videoId] || {
    segments: [],
    language: null,
  };

  const handleSeek = (timeSeconds: number) => {
    setSeekRequest((prev) => ({ time: timeSeconds, seq: (prev?.seq || 0) + 1 }));
  };

  const handleClipToNotes = (timeSeconds: number, text: string) => {
    const existing = userProgress.personalNotes[currentLesson.id] || '';
    const line = `- **[${formatSecondsToTime(timeSeconds)}]** ${text}`;
    const updated = existing.trim() ? `${existing.trimEnd()}\n${line}\n` : `${line}\n`;
    savePersonalNote(course.id, currentLesson.id, updated);
  };

  const handleSelectLesson = (idx: number) => {
    setActiveLessonIndex(idx);
    setSeekRequest(null);
  };

  const handleNextLesson = () => {
    if (activeLessonIndex < course.lessons.length - 1) {
      handleSelectLesson(activeLessonIndex + 1);
    }
  };

  const handlePrevLesson = () => {
    if (activeLessonIndex > 0) {
      handleSelectLesson(activeLessonIndex - 1);
    }
  };

  const handleShareCourse = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: course.title,
          text: `Studying ${course.title} on StudyTube`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 transition-all no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/"
              className="h-9 w-9 bg-gray-50 dark:bg-slate-800 hover:bg-slate-900 dark:hover:bg-blue-600 hover:text-white rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all shadow-sm shrink-0"
              title="Back to Courses"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="h-4 w-px bg-gray-200 dark:bg-slate-700 shrink-0" />

            <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate max-w-[160px] sm:max-w-xs">
              {course.title}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PomodoroTimer />

            <div
              className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 text-xs font-bold"
              title="Daily study streak"
            >
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-current" />
              <span>{stats.currentStreak}d</span>
            </div>

            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleShareCourse}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              title="Share course"
            >
              {shareCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden xl:inline">{shareCopied ? 'Copied' : 'Share'}</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
              <span>
                {completedCount}/{course.lessons.length}
              </span>
              <span className="text-blue-600 dark:text-blue-400">({progressPercent}%)</span>
            </div>

            <AuthButton onOpenSettings={() => setSettingsOpen(true)} />

            <button
              type="button"
              onClick={() => markLessonCompleted(course.id, currentLesson.id, !isCurrentCompleted)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all shadow-sm cursor-pointer ${
                isCurrentCompleted
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white shadow-md'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isCurrentCompleted ? 'Completed' : 'Mark Done'}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6">
        {/* Left / Center Area */}
        <div className="flex-1 space-y-6 min-w-0">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-3 sm:p-4 border border-gray-100 dark:border-slate-800 shadow-sm space-y-4 print-only-notes">
            {/* Video Player */}
            <div className="no-print">
              <YouTubePlayer
                videoId={currentLesson.videoId}
                initialTime={currentLesson.startSeconds || 0}
                seekRequest={seekRequest}
                playerHandleRef={playerHandleRef}
                onEnded={() => markLessonCompleted(course.id, currentLesson.id, true)}
              />
            </div>

            {/* Lesson Title & Controls */}
            <div className="px-2 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Lesson {activeLessonIndex + 1} of {course.lessons.length}
                  </span>
                  {knownLessonIds.includes(currentLesson.id) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Known via Placement Test
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {currentLesson.title}
                </h2>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center no-print">
                <button
                  type="button"
                  onClick={() => toggleLessonBookmark(course.id, currentLesson.id)}
                  className={`p-2 rounded-full border transition cursor-pointer ${
                    isCurrentBookmarked
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400'
                      : 'border-gray-200 dark:border-slate-700 text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                  title={isCurrentBookmarked ? 'Remove Bookmark' : 'Bookmark Lesson'}
                >
                  <Bookmark className={`w-4 h-4 ${isCurrentBookmarked ? 'fill-current' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 rounded-full border border-gray-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Print Notes / Save PDF"
                >
                  <Printer className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  disabled={activeLessonIndex === 0}
                  onClick={handlePrevLesson}
                  className={`px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1 transition ${
                    activeLessonIndex === 0
                      ? 'text-gray-300 dark:text-slate-600 cursor-not-allowed border-gray-100 dark:border-slate-800'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-900 dark:hover:bg-blue-600 hover:text-white cursor-pointer'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Prev</span>
                </button>

                <button
                  type="button"
                  disabled={activeLessonIndex === course.lessons.length - 1}
                  onClick={handleNextLesson}
                  className={`px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1 transition ${
                    activeLessonIndex === course.lessons.length - 1
                      ? 'text-gray-300 dark:text-slate-600 cursor-not-allowed border-gray-100 dark:border-slate-800'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-900 dark:hover:bg-blue-600 hover:text-white cursor-pointer'
                  }`}
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Segmented Control Tab Bar */}
            <div className="px-2 pt-1 no-print overflow-x-auto">
              <div className="bg-gray-100/80 dark:bg-slate-800/90 backdrop-blur-md p-1 rounded-2xl sm:rounded-full grid grid-cols-3 sm:flex text-xs font-semibold shadow-inner gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('notes')}
                  className={`flex-1 py-2 px-2.5 rounded-full transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'notes'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-gray-200/50 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Study Notes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('transcript')}
                  className={`flex-1 py-2 px-2.5 rounded-full transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'transcript'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-gray-200/50 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Captions className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Transcript</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('quiz')}
                  className={`flex-1 py-2 px-2.5 rounded-full transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'quiz'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-gray-200/50 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Quiz ({currentLesson.quizzes?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('personal')}
                  className={`flex-1 py-2 px-2.5 rounded-full transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'personal'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-gray-200/50 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>My Notes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('plan')}
                  className={`flex-1 py-2 px-2.5 rounded-full transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'plan'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-gray-200/50 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-sky-500" />
                  <span>Pace Plan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('flashcards')}
                  className={`flex-1 py-2 px-2.5 rounded-full transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'flashcards'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-gray-200/50 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-purple-500" />
                  <span>Flashcards</span>
                </button>
              </div>
            </div>

            {/* Tab Contents */}
            <div className="px-2 pt-2">
              {activeTab === 'notes' && (
                <div className="space-y-6 pt-2">
                  {/* Puter.js / Optional Gemini AI Study Helper */}
                  <PuterAIHelper
                    lessonTitle={currentLesson.title}
                    studyNotes={currentLesson.studyNotes}
                    transcriptSegments={currentTranscript.segments}
                    geminiApiKey={apiKey}
                  />

                  {/* Timestamp Buttons */}
                  {currentLesson.timestampNotes && currentLesson.timestampNotes.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Key Moments & Timestamps (Click to Jump)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {currentLesson.timestampNotes.map((ts, idx) => (
                          <button
                            type="button"
                            key={idx}
                            onClick={() => handleSeek(ts.timeSeconds)}
                            className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 border border-slate-100 dark:border-slate-800 hover:border-blue-200 text-left transition-all duration-200 cursor-pointer group"
                          >
                            <span className="px-2.5 py-1 rounded-xl bg-blue-100/70 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold shrink-0 group-hover:bg-blue-600 group-hover:text-white transition">
                              {formatSecondsToTime(ts.timeSeconds)}
                            </span>
                            <div>
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                                {ts.label}
                              </div>
                              {ts.summary && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                  {ts.summary}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Markdown Notes Card */}
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Key Concepts & Lesson Notes
                    </h4>
                    <div className="prose prose-sm max-w-none text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed whitespace-pre-line text-xs sm:text-sm font-normal">
                      {currentLesson.studyNotes}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'transcript' && (
                <div className="pt-2">
                  <TranscriptViewer
                    segments={currentTranscript.segments}
                    language={currentTranscript.language}
                    loading={loadingTranscript}
                    onSeek={handleSeek}
                    onClipToNotes={handleClipToNotes}
                  />
                </div>
              )}

              {activeTab === 'quiz' && (
                <div className="pt-2">
                  <QuizCard
                    key={currentLesson.id}
                    quizzes={currentLesson.quizzes}
                    onReplayMoment={handleSeek}
                    onQuizCompleted={(score) => saveQuizScore(course.id, currentLesson.id, score)}
                  />
                </div>
              )}

              {activeTab === 'personal' && (
                <div className="pt-2">
                  <NoteEditor
                    lessonTitle={currentLesson.title}
                    courseTitle={course.title}
                    value={userProgress.personalNotes[currentLesson.id] || ''}
                    onChange={(val) => savePersonalNote(course.id, currentLesson.id, val)}
                    getCurrentTime={() => playerHandleRef.current?.getCurrentTime() || 0}
                    onSeek={handleSeek}
                    transcriptSegments={currentTranscript.segments}
                    chapterNotes={currentLesson.timestampNotes || []}
                  />
                </div>
              )}

              {activeTab === 'plan' && (
                <div className="pt-2">
                  <DailyPacePlanner
                    lessons={course.lessons}
                    completedLessonIds={userProgress.completedLessonIds}
                    knownLessonIds={knownLessonIds}
                    dailyPaceMinutes={userProgress.dailyPaceMinutes || 60}
                    onChangePace={(mins) => setDailyPace(course.id, mins)}
                    onSelectLesson={handleSelectLesson}
                    onOpenPlacementTest={() => setPlacementOpen(true)}
                  />
                </div>
              )}

              {activeTab === 'flashcards' && (
                <div className="pt-2">
                  <FlashcardsDeck
                    course={course}
                    cards={userProgress.flashcards || []}
                    onInitCards={(cards) => setCourseFlashcards(course.id, cards)}
                    onAddCard={(f, b) => addFlashcard(course.id, f, b, currentLesson.id)}
                    onReviewCard={(cardId, knewIt) => reviewFlashcard(course.id, cardId, knewIt)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right / Syllabus Sidebar */}
        <div className="w-full lg:w-80 shrink-0 space-y-4 no-print">
          {/* Placement Test Quick Card */}
          <button
            type="button"
            onClick={() => setPlacementOpen(true)}
            className="w-full p-4 rounded-3xl bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/60 dark:to-blue-950/60 border border-indigo-200/80 dark:border-indigo-800/60 text-left flex items-center justify-between gap-3 hover:shadow-md transition cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Placement Test</span>
              </div>
              <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                {knownLessonIds.length > 0
                  ? `${knownLessonIds.length} known topics skipped`
                  : 'Skip topics you already know'}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-indigo-500 shrink-0" />
          </button>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Course Syllabus</h3>
                <span className="text-xs text-slate-400">{course.lessons.length} Lessons</span>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full">
                {progressPercent}% Complete
              </span>
            </div>

            {/* Syllabus Search & Bookmarked Filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={syllabusSearch}
                  onChange={(e) => setSyllabusSearch(e.target.value)}
                  placeholder="Filter lessons..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setOnlyBookmarked((b) => !b)}
                className={`p-1.5 rounded-full border transition cursor-pointer ${
                  onlyBookmarked
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 text-amber-600'
                    : 'border-gray-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white'
                }`}
                title="Show bookmarked lessons only"
              >
                <Bookmark className={`w-3.5 h-3.5 ${onlyBookmarked ? 'fill-current' : ''}`} />
              </button>
            </div>

            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {filteredLessons.map(({ lesson, idx }) => {
                const isCurrent = idx === activeLessonIndex;
                const isCompleted = userProgress.completedLessonIds.includes(lesson.id);
                const isKnown = knownLessonIds.includes(lesson.id);
                const isBookmarked = bookmarkedIds.includes(lesson.id);

                return (
                  <div
                    key={lesson.id}
                    onClick={() => handleSelectLesson(idx)}
                    className={`w-full p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 shadow-sm'
                        : 'bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/60 border-gray-100 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markLessonCompleted(course.id, lesson.id, !isCompleted);
                      }}
                      className="mt-0.5 shrink-0 cursor-pointer"
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300 dark:text-slate-600 hover:text-gray-500" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-xs font-semibold block truncate ${
                          isCurrent
                            ? 'text-blue-900 dark:text-blue-300'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {lesson.title}
                      </span>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                        <span>{lesson.duration || 'Video'}</span>
                        {lesson.quizzes?.length > 0 && (
                          <span>&bull; {lesson.quizzes.length}Q</span>
                        )}
                        {isKnown && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                            &bull; Known
                          </span>
                        )}
                        {isBookmarked && (
                          <Bookmark className="w-3 h-3 text-amber-500 fill-current inline" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredLessons.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">
                  No lessons match your filter.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <PlacementTestModal
        isOpen={placementOpen}
        onClose={() => setPlacementOpen(false)}
        course={course}
        onApplyKnownLessons={(ids) => markLessonsKnown(course.id, ids)}
      />

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function CoursePlayerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-500">
          Loading course...
        </div>
      }
    >
      <CoursePlayerContent />
    </Suspense>
  );
}
