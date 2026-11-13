'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Course, Flashcard } from '@/types/course';
import { Layers, Plus, RotateCw, Check, RefreshCw } from 'lucide-react';

interface FlashcardsDeckProps {
  course: Course;
  cards: Flashcard[];
  onInitCards: (cards: Flashcard[]) => void;
  onAddCard: (front: string, back: string) => void;
  onReviewCard: (cardId: string, knewIt: boolean) => void;
}

const BOX_LABELS: Record<number, string> = {
  1: 'Box 1 (Today)',
  2: 'Box 2 (2 days)',
  3: 'Box 3 (5 days)',
  4: 'Box 4 (Mastered)',
};

export const FlashcardsDeck: React.FC<FlashcardsDeckProps> = ({
  course,
  cards,
  onInitCards,
  onAddCard,
  onReviewCard,
}) => {
  const [flipped, setFlipped] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [studyAll, setStudyAll] = useState(false);

  // Auto-seed starter flashcards from course quizzes & key concepts once
  useEffect(() => {
    if (cards.length > 0) return;
    const seeded: Flashcard[] = [];
    const now = new Date().toISOString();

    for (const lesson of course.lessons) {
      for (const q of lesson.quizzes || []) {
        seeded.push({
          id: `seed-${q.id}`,
          front: q.question,
          back: `${q.options[q.correctAnswer]}\n\n${q.explanation}`,
          box: 1,
          nextReviewAt: now,
          lessonId: lesson.id,
        });
      }
      for (const ts of (lesson.timestampNotes || []).slice(0, 1)) {
        if (ts.summary && seeded.length < 12) {
          seeded.push({
            id: `seed-ts-${lesson.id}-${ts.timeSeconds}`,
            front: `What is covered in "${ts.label}" (${lesson.title})?`,
            back: ts.summary,
            box: 1,
            nextReviewAt: now,
            lessonId: lesson.id,
          });
        }
      }
    }

    if (seeded.length > 0) {
      onInitCards(seeded);
    }
  }, [course, cards.length, onInitCards]);

  const dueCards = useMemo(() => {
    const nowMs = Date.now();
    if (studyAll) return cards;
    return cards.filter((c) => new Date(c.nextReviewAt).getTime() <= nowMs);
  }, [cards, studyAll]);

  const safeIndex = dueCards.length > 0 ? cardIndex % dueCards.length : 0;
  const activeCard = dueCards[safeIndex];

  const boxCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const c of cards) counts[c.box] = (counts[c.box] || 0) + 1;
    return counts;
  }, [cards]);

  const handleReview = (knewIt: boolean) => {
    if (!activeCard) return;
    onReviewCard(activeCard.id, knewIt);
    setFlipped(false);
    setCardIndex((prev) => prev + 1);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;
    onAddCard(newFront, newBack);
    setNewFront('');
    setNewBack('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-5">
      {/* Header + Leitner Box Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Leitner Spaced Repetition ({cards.length} Cards)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStudyAll((s) => !s)}
            className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            {studyAll ? 'Showing All' : `Due Now (${dueCards.length})`}
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm((s) => !s)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900 dark:bg-blue-600 text-white text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Card</span>
          </button>
        </div>
      </div>

      {/* Box Distribution Pills */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[1, 2, 3, 4].map((box) => (
          <div
            key={box}
            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800"
          >
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {boxCounts[box as 1 | 2 | 3 | 4]}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {BOX_LABELS[box]}
            </div>
          </div>
        ))}
      </div>

      {/* Add Card Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 space-y-3"
        >
          <input
            type="text"
            value={newFront}
            onChange={(e) => setNewFront(e.target.value)}
            placeholder="Front (Question or concept)"
            className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          />
          <textarea
            rows={2}
            value={newBack}
            onChange={(e) => setNewBack(e.target.value)}
            placeholder="Back (Answer or explanation)"
            className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-slate-500 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-full bg-slate-900 dark:bg-blue-600 text-white text-xs font-bold cursor-pointer"
            >
              Save Card
            </button>
          </div>
        </form>
      )}

      {/* Active Flashcard */}
      {!activeCard ? (
        <div className="p-8 text-center rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-3">
          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
            All due flashcards reviewed for today!
          </p>
          <button
            type="button"
            onClick={() => setStudyAll(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-700 text-xs font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Practice All Cards Anyway</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            onClick={() => setFlipped((f) => !f)}
            className="min-h-[180px] p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-400 transition select-none"
          >
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3">
              {flipped ? 'Answer' : `Question • ${BOX_LABELS[activeCard.box]}`}
            </span>

            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 whitespace-pre-line max-w-lg leading-relaxed">
              {flipped ? activeCard.back : activeCard.front}
            </p>

            <span className="text-[11px] text-slate-400 mt-4 flex items-center gap-1">
              <RotateCw className="w-3 h-3" />
              Click card to flip
            </span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handleReview(false)}
              className="px-5 py-2.5 rounded-full bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold transition cursor-pointer"
            >
              Still Learning (Box 1)
            </button>
            <button
              type="button"
              onClick={() => handleReview(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Got It (Promote)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
