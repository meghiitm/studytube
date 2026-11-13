'use client';

import React, { useState } from 'react';
import { QuizQuestion } from '@/types/course';
import { CheckCircle2, XCircle, RotateCcw, Award, PlayCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuizCardProps {
  quizzes: QuizQuestion[];
  onReplayMoment: (timestampSeconds: number) => void;
  onQuizCompleted?: (scorePercentage: number) => void;
}

export const QuizCard: React.FC<QuizCardProps> = ({
  quizzes,
  onReplayMoment,
  onQuizCompleted
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!quizzes || quizzes.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-gray-100 text-slate-400 text-xs">
        No quiz available for this lesson yet.
      </div>
    );
  }

  const handleSelect = (questionIndex: number, optionIndex: number) => {
    if (submitted) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: optionIndex
    }));
  };

  const calculateScore = () => {
    let correct = 0;
    quizzes.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctAnswer) {
        correct++;
      }
    });
    return Math.round((correct / quizzes.length) * 100);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    const score = calculateScore();
    if (score >= 70) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
    }
    if (onQuizCompleted) {
      onQuizCompleted(score);
    }
  };

  const handleRetry = () => {
    setSelectedAnswers({});
    setSubmitted(false);
  };

  const score = calculateScore();
  const allAnswered = quizzes.every((_, idx) => selectedAnswers[idx] !== undefined);

  return (
    <div className="space-y-6">
      {/* Quiz Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-bold text-slate-900">
            Comprehension Check ({quizzes.length} {quizzes.length === 1 ? 'Question' : 'Questions'})
          </h3>
        </div>
        {submitted && (
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                score >= 70
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-rose-50 text-rose-600 border border-rose-200'
              }`}
            >
              Score: {score}%
            </span>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 font-semibold transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {quizzes.map((quiz, qIdx) => {
          const userChoice = selectedAnswers[qIdx];
          const isCorrect = submitted && userChoice === quiz.correctAnswer;
          const isWrong = submitted && userChoice !== undefined && userChoice !== quiz.correctAnswer;

          return (
            <div
              key={quiz.id || qIdx}
              className={`p-5 rounded-2xl border transition-all ${
                submitted
                  ? isCorrect
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-rose-50/50 border-rose-200'
                  : 'bg-slate-50 border-gray-100'
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <span className="text-xs font-mono font-bold text-slate-500 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">
                  Q{qIdx + 1}
                </span>
                {submitted && (
                  <button
                    onClick={() => onReplayMoment(quiz.timestampSeconds)}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 border border-blue-200 px-3 py-1 rounded-full font-bold transition cursor-pointer"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Replay the Moment</span>
                  </button>
                )}
              </div>

              <h4 className="text-sm font-semibold text-slate-900 mb-3 leading-relaxed">
                {quiz.question}
              </h4>

              {/* Options */}
              <div className="space-y-2">
                {quiz.options.map((option, optIdx) => {
                  const isSelected = userChoice === optIdx;
                  let optionStyle = 'bg-white hover:bg-gray-50 border-gray-200 text-slate-700';

                  if (submitted) {
                    if (optIdx === quiz.correctAnswer) {
                      optionStyle = 'bg-emerald-100/80 border-emerald-400 text-emerald-900 font-semibold';
                    } else if (isSelected && optIdx !== quiz.correctAnswer) {
                      optionStyle = 'bg-rose-100/80 border-rose-400 text-rose-900 line-through';
                    } else {
                      optionStyle = 'bg-gray-50 border-gray-200 text-gray-400 opacity-60';
                    }
                  } else if (isSelected) {
                    optionStyle = 'bg-blue-50 border-blue-500 text-blue-900 font-semibold ring-1 ring-blue-500';
                  }

                  return (
                    <button
                      key={optIdx}
                      disabled={submitted}
                      onClick={() => handleSelect(qIdx, optIdx)}
                      className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm flex items-center justify-between transition cursor-pointer ${optionStyle}`}
                    >
                      <span>{option}</span>
                      {submitted && optIdx === quiz.correctAnswer && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                      )}
                      {submitted && isSelected && optIdx !== quiz.correctAnswer && (
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation */}
              {submitted && (
                <div className="mt-3.5 p-3 rounded-xl bg-white border border-gray-100 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">Explanation:</span>
                    <span>{quiz.explanation}</span>
                  </div>
                  <button
                    onClick={() => onReplayMoment(quiz.timestampSeconds)}
                    className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-bold underline"
                  >
                    Watch Explanation
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      {!submitted && (
        <div className="flex justify-end pt-2">
          <button
            disabled={!allAnswered}
            onClick={handleSubmit}
            className={`px-6 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all shadow-md ${
              allAnswered
                ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-slate-900/20'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
            }`}
          >
            Submit Quiz
          </button>
        </div>
      )}
    </div>
  );
};
