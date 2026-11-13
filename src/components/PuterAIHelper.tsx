'use client';

import React, { useState } from 'react';
import { TranscriptSegment } from '@/lib/youtube';
import { loadPuterScript } from '@/lib/puter';
import { Sparkles, HelpCircle, Loader2, Bot } from 'lucide-react';

interface PuterAIHelperProps {
  lessonTitle: string;
  studyNotes: string;
  transcriptSegments: TranscriptSegment[];
  geminiApiKey?: string;
}

export const PuterAIHelper: React.FC<PuterAIHelperProps> = ({
  lessonTitle,
  studyNotes,
  transcriptSegments,
  geminiApiKey,
}) => {
  const [loadingMode, setLoadingMode] = useState<'explain' | 'quiz' | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAI = async (mode: 'explain' | 'quiz') => {
    setLoadingMode(mode);
    setError(null);

    const contextText =
      transcriptSegments.length > 0
        ? transcriptSegments
            .slice(0, 12)
            .map((s) => s.text)
            .join(' ')
            .slice(0, 2000)
        : studyNotes.slice(0, 1500);

    const prompt =
      mode === 'explain'
        ? `Explain the lesson "${lessonTitle}" simply for a student in 4-5 clear bullet points with a real-world analogy. Context:\n${contextText}`
        : `Create 3 short self-test questions (with answers hidden below a separator) to quiz a student on "${lessonTitle}". Context:\n${contextText}`;

    try {
      // Use user's optional Gemini API key first if configured
      if (geminiApiKey) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
            geminiApiKey
          )}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            setOutput(text);
            setLoadingMode(null);
            return;
          }
        }
      }

      // Otherwise use Puter.js (zero developer API key required; prompts user's Puter account)
      await loadPuterScript();
      if (!window.puter?.ai?.chat) {
        throw new Error('Puter AI could not initialize in this browser.');
      }

      const reply = await window.puter.ai.chat(prompt);
      const content =
        typeof reply === 'string'
          ? reply
          : reply?.message?.content || reply?.text || JSON.stringify(reply);
      setOutput(content);
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not reach AI helper. You can add a free Gemini API key in Platform Settings.'
      );
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-3 no-print">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            AI Study Helper
          </span>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {geminiApiKey ? '(Using your Gemini key)' : '(Powered by Puter.js — no API key needed)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loadingMode !== null}
            onClick={() => runAI('explain')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 text-xs font-semibold transition cursor-pointer disabled:opacity-60"
          >
            {loadingMode === 'explain' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Explain Simply</span>
          </button>

          <button
            type="button"
            disabled={loadingMode !== null}
            onClick={() => runAI('quiz')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 text-xs font-semibold transition cursor-pointer disabled:opacity-60"
          >
            {loadingMode === 'quiz' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <HelpCircle className="w-3.5 h-3.5" />
            )}
            <span>Quiz Me</span>
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {output && (
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
          {output}
        </div>
      )}
    </div>
  );
};
