'use client';

import React, { useMemo } from 'react';
import { Lesson } from '@/types/course';
import { timestampToSeconds } from '@/lib/youtube';
import { Calendar, CheckCircle2, Sparkles, FastForward } from 'lucide-react';

interface DailyPacePlannerProps {
  lessons: Lesson[];
  completedLessonIds: string[];
  knownLessonIds: string[];
  dailyPaceMinutes: 30 | 60 | 90 | 120;
  onChangePace: (minutes: 30 | 60 | 90 | 120) => void;
  onSelectLesson: (index: number) => void;
  onOpenPlacementTest: () => void;
}

function getLessonMinutes(lesson: Lesson): number {
  if (!lesson.duration) return 15;
  const sec = timestampToSeconds(lesson.duration);
  if (sec <= 0) return 15;
  return Math.max(3, Math.round(sec / 60));
}

export function formatMinutesLabel(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export const DailyPacePlanner: React.FC<DailyPacePlannerProps> = ({
  lessons,
  completedLessonIds,
  knownLessonIds,
  dailyPaceMinutes,
  onChangePace,
  onSelectLesson,
  onOpenPlacementTest,
}) => {
  const { days, totalMinutes, personalizedMinutes, skippedCount } = useMemo(() => {
    let total = 0;
    let personalized = 0;
    let skipped = 0;

    const remaining: { lesson: Lesson; index: number; mins: number }[] = [];

    lessons.forEach((lesson, idx) => {
      const mins = getLessonMinutes(lesson);
      total += mins;
      if (knownLessonIds.includes(lesson.id)) {
        skipped++;
      } else {
        personalized += mins;
        remaining.push({ lesson, index: idx, mins });
      }
    });

    const groupedDays: {
      day: number;
      totalMins: number;
      items: { lesson: Lesson; index: number; mins: number }[];
    }[] = [];

    let currentDayItems: { lesson: Lesson; index: number; mins: number }[] = [];
    let currentDayMins = 0;

    for (const item of remaining) {
      if (currentDayItems.length > 0 && currentDayMins + item.mins > dailyPaceMinutes) {
        groupedDays.push({
          day: groupedDays.length + 1,
          totalMins: currentDayMins,
          items: currentDayItems,
        });
        currentDayItems = [item];
        currentDayMins = item.mins;
      } else {
        currentDayItems.push(item);
        currentDayMins += item.mins;
      }
    }

    if (currentDayItems.length > 0) {
      groupedDays.push({
        day: groupedDays.length + 1,
        totalMins: currentDayMins,
        items: currentDayItems,
      });
    }

    return {
      days: groupedDays,
      totalMinutes: total,
      personalizedMinutes: personalized,
      skippedCount: skipped,
    };
  }, [lessons, knownLessonIds, dailyPaceMinutes]);

  const paceOptions: (30 | 60 | 90 | 120)[] = [30, 60, 90, 120];

  return (
    <div className="space-y-6">
      {/* Header & Pace Selector */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Custom Daily Study Plan
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {days.length} {days.length === 1 ? 'day' : 'days'} at {dailyPaceMinutes} mins/day
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenPlacementTest}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/60 text-xs font-semibold transition cursor-pointer self-start sm:self-center"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{skippedCount > 0 ? 'Retake Placement Test' : 'Take Placement Test'}</span>
          </button>
        </div>

        {/* Pace Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
            Daily pace:
          </span>
          {paceOptions.map((mins) => (
            <button
              type="button"
              key={mins}
              onClick={() => onChangePace(mins)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                dailyPaceMinutes === mins
                  ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:border-slate-400'
              }`}
            >
              {mins} min/day
            </button>
          ))}
        </div>

        {/* Time-Saving Banner from Placement Test */}
        {skippedCount > 0 && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
              <FastForward className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Placement Test applied: <strong>{formatMinutesLabel(totalMinutes)} &rarr; {formatMinutesLabel(personalizedMinutes)} for you</strong> ({skippedCount} known {skippedCount === 1 ? 'topic' : 'topics'} skipped)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Day-by-Day Cards */}
      {days.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
          You already know every topic in this course based on your Placement Test!
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((d) => {
            const allDone = d.items.every((item) => completedLessonIds.includes(item.lesson.id));
            return (
              <div
                key={d.day}
                className={`p-4 rounded-2xl border transition ${
                  allDone
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-white dark:bg-slate-900/60 border-gray-100 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Day {d.day}
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                    ~{d.totalMins} min
                  </span>
                </div>

                <div className="space-y-2">
                  {d.items.map(({ lesson, index, mins }) => {
                    const done = completedLessonIds.includes(lesson.id);
                    return (
                      <button
                        type="button"
                        key={lesson.id}
                        onClick={() => onSelectLesson(index)}
                        className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${
                              done ? 'text-emerald-500' : 'text-gray-300 dark:text-slate-600'
                            }`}
                          />
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                            {lesson.title}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          {mins}m
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
