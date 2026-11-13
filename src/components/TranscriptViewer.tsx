'use client';

import React, { useState, useMemo } from 'react';
import { TranscriptSegment, formatSecondsToTime } from '@/lib/youtube';
import { Search, PlusCircle, Captions, Loader2, Play } from 'lucide-react';

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  language: string | null;
  loading: boolean;
  onSeek: (timeSeconds: number) => void;
  onClipToNotes: (timeSeconds: number, text: string) => void;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  segments,
  language,
  loading,
  onSeek,
  onClipToNotes,
}) => {
  const [query, setQuery] = useState('');
  const [clippedIndex, setClippedIndex] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, query]);

  if (loading) {
    return (
      <div className="p-10 text-center bg-slate-50 rounded-2xl border border-gray-100 flex flex-col items-center gap-2 text-slate-500 text-xs">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span>Loading video transcript (no API key required)...</span>
      </div>
    );
  }

  if (!segments || segments.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-gray-100 space-y-2">
        <Captions className="w-6 h-6 text-slate-400 mx-auto" />
        <p className="text-xs font-semibold text-slate-700">No captions available for this video</p>
        <p className="text-[11px] text-slate-500">
          You can still capture live timestamps and take Markdown notes in the My Notes tab while watching.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search spoken words in transcript..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-gray-200 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
        {language && (
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-center">
            {language} &bull; {segments.length} segments
          </span>
        )}
      </div>

      <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
        {filtered.map((seg, idx) => (
          <div
            key={`${seg.startSeconds}-${idx}`}
            className="group p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/40 border border-slate-100 hover:border-blue-200 transition flex items-start gap-3"
          >
            <button
              type="button"
              onClick={() => onSeek(seg.startSeconds)}
              className="px-2.5 py-1 rounded-xl bg-blue-100/70 hover:bg-blue-600 text-blue-700 hover:text-white font-mono text-xs font-bold shrink-0 transition flex items-center gap-1 cursor-pointer"
              title="Jump to this timestamp"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              {formatSecondsToTime(seg.startSeconds)}
            </button>

            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed flex-1">{seg.text}</p>

            <button
              type="button"
              onClick={() => {
                onClipToNotes(seg.startSeconds, seg.text);
                setClippedIndex(idx);
                setTimeout(() => setClippedIndex(null), 1200);
              }}
              className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white hover:bg-slate-900 text-slate-600 hover:text-white border border-gray-200 transition flex items-center gap-1 cursor-pointer"
              title="Append this line with timestamp to My Notes"
            >
              <PlusCircle className="w-3 h-3" />
              <span>{clippedIndex === idx ? 'Added!' : 'Clip'}</span>
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-400">
            No matching lines found for &ldquo;{query}&rdquo;.
          </div>
        )}
      </div>
    </div>
  );
};
