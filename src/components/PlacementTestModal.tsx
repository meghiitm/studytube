'use client';

import React, { useState, useMemo } from 'react';
import { Course, Lesson } from '@/types/course';
import { timestampToSeconds } from '@/lib/youtube';
import { formatMinutesLabel } from './DailyPacePlanner';
import { X, Sparkles, CheckCircle2, RotateCcw, FastForward } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PlacementTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  onApplyKnownLessons: (lessonIds: string[]) => void;
}

function getLessonMinutes(lesson: Lesson): number {
  if (!lesson.duration) return 15;
  const sec = timestampToSeconds(lesson.duration);
  return sec > 0 ? Math.max(3, Math.round(sec / 60)) : 15;
}

export const PlacementTestModal: React.FC<PlacementTestModalProps> = ({
  isOpen,
  onClose,
  course,
  onApplyKnownLessons,
}) => {
  const diagnosticItems = useMemo(() => {
    const items: {
      lessonId: string;
      lessonTitle: string;
      minutes: number;
      question: string;
      options: string[];
      correctAnswer: number;
    }[] = [];

    for (const lesson of course.lessons.slice(0, 10)) {
      const q = lesson.quizzes?.[0];
      if (q) {
        items.push({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          minutes: getLessonMinutes(lesson),
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
        });
      }
    }
    return items;
  }, [course.lessons]);

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const totalCourseMinutes = course.lessons.reduce((acc, l) => acc + getLessonMinutes(l), 0);

  const passedLessonIds = diagnosticItems
    .filter((item, idx) => answers[idx] === item.correctAnswer)
    .map((item) => item.lessonId);

  const savedMinutes = diagnosticItems
    .filter((item, idx) => answers[idx] === item.correctAnswer)
    .reduce((acc, item) => acc + item.minutes, 0);

  const remainingMinutes = Math.max(0, totalCourseMinutes - savedMinutes);

  const handleSubmit = () => {
    setSubmitted(true);
    onApplyKnownLessons(passedLessonIds);
    if (passedLessonIds.length > 0) {
      confetti({ particleCount: 70, spread: 55, origin: { y: 0.7 } });
    }
  };

  const handleReset = () => {
    setAnswers({});
    setSubmitted(false);
    onApplyKnownLessons([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Placement Test
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Skip topics you already know and shorten your daily plan.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {submitted && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                <FastForward className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {formatMinutesLabel(totalCourseMinutes)} &rarr; {formatMinutesLabel(remainingMinutes)} for you
                </span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {passedLessonIds.length} of {diagnosticItems.length} tested topics marked as Known and removed from your remaining schedule.
              </p>
            </div>
          )}

          {diagnosticItems.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">
              No diagnostic questions available for this course yet.
            </p>
          ) : (
            diagnosticItems.map((item, idx) => {
              const chosen = answers[idx];
              const isCorrect = submitted && chosen === item.correctAnswer;

              return (
                <div
                  key={item.lessonId}
                  className={`p-4 rounded-2xl border space-y-3 ${
                    submitted
                      ? isCorrect
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-gray-100 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-blue-600 dark:text-blue-400 truncate">
                      {item.lessonTitle}
                    </span>
                    {submitted && isCorrect && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Known (Skipped)
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {item.question}
                  </p>

                  <div className="space-y-1.5">
                    {item.options.map((opt, oIdx) => {
                      const selected = chosen === oIdx;
                      let cls =
                        'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800';
                      if (submitted) {
                        if (oIdx === item.correctAnswer) {
                          cls =
                            'bg-emerald-100/80 dark:bg-emerald-900/40 border-emerald-400 text-emerald-900 dark:text-emerald-200 font-semibold';
                        } else if (selected) {
                          cls = 'bg-rose-100/80 dark:bg-rose-900/40 border-rose-400 text-rose-800 dark:text-rose-200';
                        }
                      } else if (selected) {
                        cls =
                          'bg-blue-50 dark:bg-blue-900/40 border-blue-500 text-blue-900 dark:text-blue-200 font-semibold ring-1 ring-blue-500';
                      }

                      return (
                        <button
                          type="button"
                          key={oIdx}
                          disabled={submitted}
                          onClick={() => setAnswers((prev) => ({ ...prev, [idx]: oIdx }))}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs transition cursor-pointer ${cls}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Known Topics</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
            >
              Close
            </button>
            {!submitted && diagnosticItems.length > 0 && (
              <button
                type="button"
                onClick={handleSubmit}
                className="px-5 py-2.5 rounded-full bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
              >
                Apply to My Plan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
