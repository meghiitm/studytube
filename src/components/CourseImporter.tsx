'use client';

import React, { useState } from 'react';
import { useCourses } from '@/context/CourseContext';
import { generateCourseFromUrl } from '@/lib/courseGenerator';
import { Sparkles, Video, Loader2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const CourseImporter: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addCourse, apiKey } = useCourses();
  const router = useRouter();

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const newCourse = await generateCourseFromUrl(url.trim(), apiKey);
      addCourse(newCourse);
      router.push(`/course/${newCourse.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to transform YouTube URL into a course.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleGenerate} className="relative">
        <div className="flex flex-col sm:flex-row items-stretch gap-2 p-2 bg-white border border-gray-200/80 rounded-2xl sm:rounded-full shadow-lg shadow-slate-200/60 focus-within:border-blue-500 focus-within:shadow-xl focus-within:shadow-blue-500/10 transition-all duration-300">
          <div className="flex items-center gap-3 px-4 py-2 flex-1">
            <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
              <Video className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube Playlist or Video URL..."
              disabled={loading}
              className="w-full bg-transparent text-sm md:text-base text-slate-800 placeholder-slate-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !url.trim()}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl sm:rounded-full font-semibold text-sm transition-all duration-300 shadow-md ${
              loading || !url.trim()
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20 hover:shadow-lg hover:scale-[1.02] cursor-pointer'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Structuring Course...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Build Course</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center justify-between shadow-sm">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="underline hover:text-rose-800 font-medium cursor-pointer shrink-0 ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap text-[11px] text-slate-500">
          <span className="font-medium">Try pasting:</span>
          <button
            type="button"
            onClick={() => setUrl('https://www.youtube.com/watch?v=wm5gMKuwSYk')}
            className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition cursor-pointer"
          >
            Full Next.js Course (Video)
          </button>
          <button
            type="button"
            onClick={() => setUrl('https://www.youtube.com/playlist?list=PLillGF-RfqbYeckUaD1z6nE4DoOZLNTNU')}
            className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition cursor-pointer"
          >
            React Crash Course (Playlist)
          </button>
        </div>
      </form>
    </div>
  );
};
