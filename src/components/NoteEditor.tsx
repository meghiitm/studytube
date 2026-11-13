'use client';

import React, { useMemo, useState } from 'react';
import { TranscriptSegment, formatSecondsToTime, timestampToSeconds } from '@/lib/youtube';
import { TimestampNote } from '@/types/course';
import {
  Clock,
  Download,
  Upload,
  Sparkles,
  Play,
  Check,
} from 'lucide-react';

interface NoteEditorProps {
  lessonTitle: string;
  courseTitle: string;
  value: string;
  onChange: (newValue: string) => void;
  getCurrentTime: () => number;
  onSeek: (timeSeconds: number) => void;
  transcriptSegments: TranscriptSegment[];
  chapterNotes: TimestampNote[];
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  lessonTitle,
  courseTitle,
  value,
  onChange,
  getCurrentTime,
  onSeek,
  transcriptSegments,
  chapterNotes,
}) => {
  const [capturedToast, setCapturedToast] = useState<string | null>(null);

  // Extract all [MM:SS] or [HH:MM:SS] timestamps written in user's notes as clickable chips
  const savedTimestamps = useMemo(() => {
    const matches: { timeSeconds: number; label: string }[] = [];
    const seen = new Set<number>();
    const regex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^\n]{0,60})?/g;
    let m;
    while ((m = regex.exec(value)) !== null) {
      const sec = timestampToSeconds(m[1]);
      if (!seen.has(sec)) {
        seen.add(sec);
        matches.push({
          timeSeconds: sec,
          label: (m[2] || '').replace(/^[-–—:*\s]+/, '').trim() || `Moment at ${m[1]}`,
        });
      }
    }
    return matches;
  }, [value]);

  const handleCaptureTimestamp = () => {
    const currentSec = Math.max(0, Math.floor(getCurrentTime()));
    const timeLabel = formatSecondsToTime(currentSec);

    // Find closest spoken transcript segment at or just before currentSec (zero-API-key context)
    let contextSnippet = '';
    if (transcriptSegments.length > 0) {
      const closest =
        [...transcriptSegments]
          .reverse()
          .find((s) => s.startSeconds <= currentSec + 2) || transcriptSegments[0];
      if (closest && Math.abs(closest.startSeconds - currentSec) <= 35) {
        contextSnippet = ` — "${closest.text.slice(0, 140)}${closest.text.length > 140 ? '...' : ''}"`;
      }
    }

    const line = `- **[${timeLabel}]**${contextSnippet || ' Note: '}`;
    const updated = value.trim() ? `${value.trimEnd()}\n${line}\n` : `${line}\n`;
    onChange(updated);

    setCapturedToast(`Captured ${timeLabel}`);
    setTimeout(() => setCapturedToast(null), 1500);
  };

  const handleGenerateDraft = () => {
    const lines: string[] = [`# ${lessonTitle}`, `*Course: ${courseTitle}*`, ''];

    if (chapterNotes.length > 0) {
      lines.push('## Key Topics');
      for (const ch of chapterNotes) {
        lines.push(`- **[${formatSecondsToTime(ch.timeSeconds)}]** ${ch.label}`);
      }
      lines.push('');
    }

    if (transcriptSegments.length > 0) {
      lines.push('## Transcript Highlights');
      // Sample evenly up to 8 key excerpts across the transcript without any API key
      const step = Math.max(1, Math.floor(transcriptSegments.length / 8));
      for (let i = 0; i < transcriptSegments.length && lines.length < 22; i += step) {
        const seg = transcriptSegments[i];
        lines.push(`- **[${formatSecondsToTime(seg.startSeconds)}]** ${seg.text}`);
      }
      lines.push('');
    } else {
      lines.push('## Summary & Takeaways', '- Key concept:', '- Action item:', '');
    }

    const draft = lines.join('\n');
    onChange(value.trim() ? `${value.trimEnd()}\n\n${draft}` : draft);
  };

  const handleExportMarkdown = () => {
    const content = value.trim()
      ? `# ${lessonTitle}\n\n${value}`
      : `# ${lessonTitle}\n\n*No notes captured yet.*`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = lessonTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.href = url;
    a.download = `${safeName || 'lesson-notes'}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) || '';
      if (text.trim()) {
        onChange(value.trim() ? `${value.trimEnd()}\n\n${text.trim()}` : text.trim());
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
      e.preventDefault();
      handleCaptureTimestamp();
    }
  };

  return (
    <div className="space-y-4">
      {/* HoverNotes-style Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCaptureTimestamp}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
            title="Capture current video timestamp & spoken context (Cmd/Ctrl + J)"
          >
            {capturedToast ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{capturedToast}</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Capture Timestamp</span>
                <kbd className="hidden sm:inline-block text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                  ⌘J
                </kbd>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleGenerateDraft}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition cursor-pointer"
            title="Build structured Markdown notes directly from video chapters & transcript (no API key needed)"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Draft from Transcript</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-gray-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
            title="Import Markdown (.md) notes from HoverNotes or Obsidian"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import .md</span>
            <input type="file" accept=".md,.txt" onChange={handleImportMarkdown} className="hidden" />
          </label>

          <button
            type="button"
            onClick={handleExportMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-gray-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
            title="Export clean Markdown (.md) file for Obsidian"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export .md</span>
          </button>
        </div>
      </div>

      {/* Clickable Timestamp Bookmarks extracted from user notes */}
      {savedTimestamps.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Saved Moments:
          </span>
          {savedTimestamps.map((ts, i) => (
            <button
              type="button"
              key={`${ts.timeSeconds}-${i}`}
              onClick={() => onSeek(ts.timeSeconds)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 text-[11px] font-mono font-semibold transition cursor-pointer"
              title={ts.label}
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              {formatSecondsToTime(ts.timeSeconds)}
            </button>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Markdown notes auto-save locally. Tip: Click <strong>Capture Timestamp</strong> (or press{' '}
        <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-gray-200 font-mono text-[10px]">
          ⌘J / Ctrl+J
        </kbd>
        ) while watching to grab the exact timestamp and spoken transcript, or import <code>.md</code> notes from HoverNotes.
      </p>

      <textarea
        rows={10}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your Markdown notes here, or click Capture Timestamp while watching..."
        className="w-full p-4 rounded-2xl bg-slate-50 border border-gray-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition font-mono leading-relaxed"
      />
    </div>
  );
};
