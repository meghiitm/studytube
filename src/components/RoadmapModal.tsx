'use client';

import React, { useState } from 'react';
import { Course, CourseRoadmap } from '@/types/course';
import { Map, X, Share2, Plus, Trash2, Check, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface RoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  roadmaps: CourseRoadmap[];
  onAddRoadmap: (roadmap: CourseRoadmap) => void;
  onDeleteRoadmap: (id: string) => void;
}

export function encodeRoadmapToUrl(roadmap: CourseRoadmap, courses: Course[]): string {
  const payload = {
    t: roadmap.title,
    d: roadmap.description,
    ids: roadmap.courseIds,
    urls: roadmap.courseIds
      .map((id) => courses.find((c) => c.id === id))
      .filter(Boolean)
      .map((c) => ({ id: c!.id, title: c!.title, url: c!.sourceUrl })),
  };
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/?roadmap=${encodeURIComponent(b64)}`;
}

export function decodeRoadmapFromParam(param: string): {
  title: string;
  description: string;
  items: { id: string; title: string; url: string }[];
} | null {
  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(param))));
    const parsed = JSON.parse(json);
    if (!parsed?.t || !Array.isArray(parsed.urls)) return null;
    return {
      title: parsed.t,
      description: parsed.d || '',
      items: parsed.urls,
    };
  } catch {
    return null;
  }
}

export const RoadmapModal: React.FC<RoadmapModalProps> = ({
  isOpen,
  onClose,
  courses,
  roadmaps,
  onAddRoadmap,
  onDeleteRoadmap,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleCourse = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || selectedIds.length === 0) return;

    onAddRoadmap({
      id: `rm-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || `${selectedIds.length}-course study path`,
      courseIds: selectedIds,
      createdAt: new Date().toISOString(),
    });
    setTitle('');
    setDescription('');
    setSelectedIds([]);
  };

  const handleShare = async (rm: CourseRoadmap) => {
    const shareUrl = encodeRoadmapToUrl(rm, courses);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `StudyTube Roadmap: ${rm.title}`,
          text: rm.description,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    setCopiedId(rm.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 pb-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Map className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Shareable Study Roadmaps
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bundle courses into an ordered path and share via URL (no backend needed).
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

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Builder Form */}
          <form
            onSubmit={handleCreate}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 space-y-3"
          >
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Create New Roadmap
            </h3>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Roadmap title (e.g. Semester 1 Web Dev)"
              className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description (optional)"
              className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Select courses in order:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {courses.map((c) => {
                  const orderIdx = selectedIds.indexOf(c.id);
                  const active = orderIdx !== -1;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => toggleCourse(c.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                        active
                          ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-900 dark:border-blue-600'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-gray-200 dark:border-slate-700'
                      }`}
                    >
                      {active ? `${orderIdx + 1}. ` : '+ '}
                      {c.title.slice(0, 32)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!title.trim() || selectedIds.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 dark:bg-blue-600 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save Roadmap</span>
              </button>
            </div>
          </form>

          {/* Existing Roadmaps */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Saved Roadmaps ({roadmaps.length})
            </h3>
            {roadmaps.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No roadmaps created yet. Select courses above to create one!
              </p>
            ) : (
              roadmaps.map((rm) => (
                <div
                  key={rm.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {rm.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{rm.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleShare(rm)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold cursor-pointer"
                      >
                        {copiedId === rm.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Link Copied</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share URL</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRoadmap(rm.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {rm.courseIds.map((cid, idx) => {
                      const c = courses.find((item) => item.id === cid);
                      if (!c) return null;
                      return (
                        <Link
                          key={cid}
                          href={`/course/${cid}`}
                          onClick={onClose}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                        >
                          <span>
                            {idx + 1}. {c.title.slice(0, 28)}
                          </span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
