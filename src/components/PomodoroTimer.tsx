'use client';

import React, { useState, useEffect } from 'react';
import { Timer, Play, Pause, RotateCcw } from 'lucide-react';

export const PomodoroTimer: React.FC = () => {
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          const nextMode = mode === 'focus' ? 'break' : 'focus';
          setMode(nextMode);
          return nextMode === 'focus' ? 25 * 60 : 5 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, mode]);

  const toggleMode = () => {
    setRunning(false);
    const next = mode === 'focus' ? 'break' : 'focus';
    setMode(next);
    setSecondsLeft(next === 'focus' ? 25 * 60 : 5 * 60);
  };

  const reset = () => {
    setRunning(false);
    setSecondsLeft(mode === 'focus' ? 25 * 60 : 5 * 60);
  };

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs">
      <button
        type="button"
        onClick={toggleMode}
        className={`flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded-full transition cursor-pointer ${
          mode === 'focus'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-emerald-600 dark:text-emerald-400'
        }`}
        title="Switch Focus (25m) / Break (5m)"
      >
        <Timer className="w-3.5 h-3.5" />
        <span className="text-[10px] uppercase tracking-wider">{mode}</span>
      </button>

      <span className="font-mono font-bold text-slate-800 dark:text-slate-100 px-1">
        {mins}:{secs}
      </span>

      <button
        type="button"
        onClick={() => setRunning((r) => !r)}
        className="p-1 rounded-full hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
        title={running ? 'Pause timer' : 'Start timer'}
      >
        {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
      </button>

      <button
        type="button"
        onClick={reset}
        className="p-1 rounded-full hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
        title="Reset timer"
      >
        <RotateCcw className="w-3 h-3" />
      </button>
    </div>
  );
};
