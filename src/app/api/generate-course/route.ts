import { NextResponse } from 'next/server';
import {
  parseYouTubeUrl,
  fetchPlaylistDetails,
  fetchVideoDetails,
  fetchVideoTranscript,
  formatSecondsToTime,
  timestampToSeconds,
  ExtractedChapter,
  TranscriptSegment,
} from '@/lib/youtube';
import { Course, Lesson, QuizQuestion, TimestampNote } from '@/types/course';

async function enrichWithGemini(
  apiKey: string,
  courseTitle: string,
  lessonTitles: string[]
): Promise<Record<string, { studyNotes: string; quizzes: Omit<QuizQuestion, 'id'>[] }> | null> {
  try {
    const prompt = `You are an expert curriculum designer. Given the course "${courseTitle}" and these lesson titles:
${lessonTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Return ONLY valid JSON (no markdown fences) as an array of objects matching the lesson order. Each object must have:
- "index": number (0-based)
- "studyNotes": string (concise markdown bullet points explaining the key concepts of that lesson)
- "quizzes": array of 2 multiple-choice objects with:
  - "question": string
  - "options": array of 4 strings
  - "correctAnswer": number (0 to 3)
  - "explanation": string
  - "timestampSeconds": number (estimated seconds offset, e.g. 60, 180)`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return null;

    const map: Record<string, { studyNotes: string; quizzes: Omit<QuizQuestion, 'id'>[] }> = {};
    for (const item of parsed) {
      if (typeof item.index === 'number') {
        map[String(item.index)] = {
          studyNotes: item.studyNotes || '',
          quizzes: Array.isArray(item.quizzes) ? item.quizzes : [],
        };
      }
    }
    return map;
  } catch {
    return null;
  }
}

function sumDurations(durations: string[]): string {
  let totalSec = 0;
  for (const d of durations) {
    if (d) totalSec += timestampToSeconds(d);
  }
  if (totalSec === 0) return '';
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function groupChaptersIntoLessons(chapters: ExtractedChapter[], maxLessons = 10): ExtractedChapter[][] {
  if (chapters.length <= maxLessons) {
    return chapters.map((c) => [c]);
  }
  const chunkSize = Math.ceil(chapters.length / maxLessons);
  const groups: ExtractedChapter[][] = [];
  for (let i = 0; i < chapters.length; i += chunkSize) {
    groups.push(chapters.slice(i, i + chunkSize));
  }
  return groups;
}

function buildTranscriptExcerpt(
  segments: TranscriptSegment[],
  startSec: number,
  endSec: number
): string {
  const slice = segments.filter(
    (s) => s.startSeconds >= startSec && s.startSeconds < endSec
  );
  if (slice.length === 0) return '';
  const step = Math.max(1, Math.floor(slice.length / 3));
  const picks: string[] = [];
  for (let i = 0; i < slice.length && picks.length < 3; i += step) {
    picks.push(`- **${formatSecondsToTime(slice[i].startSeconds)}** — ${slice[i].text}`);
  }
  return picks.length > 0 ? `\n\n### Spoken Highlights\n${picks.join('\n')}` : '';
}

export async function POST(req: Request) {
  try {
    const { url, apiKey } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Please provide a valid YouTube URL' }, { status: 400 });
    }

    const { type, id } = parseYouTubeUrl(url);

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Could not detect a valid YouTube Video or Playlist URL' },
        { status: 400 }
      );
    }

    const courseId = `course-${Date.now()}`;

    // 1. Handle YouTube Playlist
    if (type === 'playlist') {
      const playlist = await fetchPlaylistDetails(id);

      if (!playlist || playlist.videos.length === 0) {
        return NextResponse.json(
          {
            error:
              'Could not load videos from this playlist. Make sure the playlist is public or unlisted (not private).',
          },
          { status: 404 }
        );
      }

      const geminiData = apiKey
        ? await enrichWithGemini(
            apiKey,
            playlist.title,
            playlist.videos.slice(0, 15).map((v) => v.title)
          )
        : null;

      const lessons: Lesson[] = playlist.videos.map((v, idx) => {
        const ai = geminiData?.[String(idx)];
        const durationSec = v.duration ? timestampToSeconds(v.duration) : 300;
        const midPoint = Math.max(30, Math.floor(durationSec * 0.4));

        const defaultTimestamps: TimestampNote[] = [
          { timeSeconds: 0, label: 'Lesson Introduction', summary: v.title },
          ...(durationSec > 120
            ? [
                {
                  timeSeconds: midPoint,
                  label: 'Core Walkthrough',
                  summary: 'Main explanation and implementation steps.',
                },
              ]
            : []),
        ];

        const defaultQuiz: QuizQuestion = {
          id: `${courseId}-pq-${idx}`,
          question: `What is the main focus of "${v.title}"?`,
          options: [
            `Understanding and applying ${v.title.slice(0, 60)}`,
            'Unrelated legacy configuration steps',
            'Skipping core concepts without practice',
            'Disabling project dependencies',
          ],
          correctAnswer: 0,
          explanation: `This lesson walks through ${v.title} step by step.`,
          timestampSeconds: 0,
        };

        return {
          id: `${courseId}-item-${idx + 1}`,
          videoId: v.videoId,
          title: v.title,
          duration: v.duration || 'Video',
          startSeconds: 0,
          thumbnail: v.thumbnail,
          overview: `Lesson ${idx + 1} from ${playlist.title} by ${v.author || playlist.author}.`,
          timestampNotes: defaultTimestamps,
          studyNotes:
            ai?.studyNotes ||
            `### ${v.title}\n- Watch in distraction-free mode and use speed controls if needed.\n- Jot down key commands or takeaways in the **My Notes** tab.\n- Complete the quiz to reinforce what you learned.`,
          quizzes: ai?.quizzes?.length
            ? ai.quizzes.map((q, qIdx) => ({ ...q, id: `${courseId}-pq-${idx}-${qIdx}` }))
            : [defaultQuiz],
        };
      });

      const totalDuration =
        sumDurations(playlist.videos.map((v) => v.duration)) || `${lessons.length} Lessons`;

      const playlistCourse: Course = {
        id: courseId,
        title: playlist.title,
        description: `Structured ${lessons.length}-lesson course imported from ${playlist.author}'s YouTube playlist.`,
        thumbnail: playlist.thumbnail,
        sourceUrl: url,
        sourceType: 'playlist',
        author: playlist.author,
        totalDuration,
        createdAt: new Date().toISOString(),
        lessons,
      };

      return NextResponse.json({ course: playlistCourse });
    }

    // 2. Handle Single Video (with real description chapters or duration-based breakdown + transcript excerpts)
    const [video, transcriptData] = await Promise.all([
      fetchVideoDetails(id),
      fetchVideoTranscript(id),
    ]);
    const transcriptSegments = transcriptData?.segments || [];
    const totalSec = video.lengthSeconds || 1800;

    let lessons: Lesson[] = [];

    if (video.chapters.length >= 2) {
      const groups = groupChaptersIntoLessons(video.chapters, 10);

      const geminiData = apiKey
        ? await enrichWithGemini(
            apiKey,
            video.title,
            groups.map((g) => g[0].label)
          )
        : null;

      lessons = groups.map((group, idx) => {
        const startSec = group[0].timeSeconds;
        const nextGroupStart =
          idx < groups.length - 1 ? groups[idx + 1][0].timeSeconds : totalSec;
        const lessonLen = Math.max(30, nextGroupStart - startSec);
        const ai = geminiData?.[String(idx)];

        const timestampNotes: TimestampNote[] = group.map((ch) => ({
          timeSeconds: ch.timeSeconds,
          label: ch.label,
          summary: `Starts at ${formatSecondsToTime(ch.timeSeconds)}`,
        }));

        const lessonTitle =
          group.length === 1
            ? `${String(idx + 1).padStart(2, '0')}. ${group[0].label}`
            : `${String(idx + 1).padStart(2, '0')}. ${group[0].label} (+${group.length - 1} topics)`;

        return {
          id: `${courseId}-l${idx + 1}`,
          videoId: id,
          title: lessonTitle,
          duration: formatSecondsToTime(lessonLen),
          startSeconds: startSec,
          thumbnail: video.thumbnail,
          overview: `Covers: ${group.map((c) => c.label).join(', ')}`,
          timestampNotes,
          studyNotes:
            ai?.studyNotes ||
            `### Topics in this Module\n${group
              .map((c) => `- **${formatSecondsToTime(c.timeSeconds)}** — ${c.label}`)
              .join('\n')}${buildTranscriptExcerpt(transcriptSegments, startSec, nextGroupStart)}`,
          quizzes: ai?.quizzes?.length
            ? ai.quizzes.map((q, qIdx) => ({
                ...q,
                id: `${courseId}-q-${idx}-${qIdx}`,
                timestampSeconds: startSec,
              }))
            : [
                {
                  id: `${courseId}-q-${idx}`,
                  question: `Which topic is introduced at ${formatSecondsToTime(startSec)} in this module?`,
                  options: [
                    group[0].label,
                    'Unrelated server provisioning',
                    'Browser bookmarking shortcuts',
                    'Legacy XML configuration',
                  ],
                  correctAnswer: 0,
                  explanation: `At ${formatSecondsToTime(startSec)}, the instructor covers ${group[0].label}.`,
                  timestampSeconds: startSec,
                },
              ],
        };
      });
    } else {
      // No chapters found in description -> split evenly across actual video length
      const segmentCount = totalSec >= 1800 ? 4 : totalSec >= 600 ? 3 : 2;
      const segmentLen = Math.floor(totalSec / segmentCount);

      const sectionNames = [
        'Introduction & Foundations',
        'Core Concepts & Implementation',
        'Deep Dive & Practical Workflow',
        'Wrap-up & Key Takeaways',
      ];

      const geminiData = apiKey
        ? await enrichWithGemini(
            apiKey,
            video.title,
            sectionNames.slice(0, segmentCount)
          )
        : null;

      lessons = Array.from({ length: segmentCount }).map((_, idx) => {
        const startSec = idx * segmentLen;
        const midSec = startSec + Math.floor(segmentLen / 2);
        const ai = geminiData?.[String(idx)];
        const label = sectionNames[idx] || `Part ${idx + 1}`;

        return {
          id: `${courseId}-l${idx + 1}`,
          videoId: id,
          title: `${String(idx + 1).padStart(2, '0')}. ${label}`,
          duration: formatSecondsToTime(segmentLen),
          startSeconds: startSec,
          thumbnail: video.thumbnail,
          overview: `Module ${idx + 1} of ${video.title}`,
          timestampNotes: [
            {
              timeSeconds: startSec,
              label: `${label} Start`,
              summary: `Begins at ${formatSecondsToTime(startSec)}`,
            },
            {
              timeSeconds: midSec,
              label: `Key Walkthrough`,
              summary: `Mid-module checkpoint at ${formatSecondsToTime(midSec)}`,
            },
          ],
          studyNotes:
            ai?.studyNotes ||
            `### ${label}\n- Focus section from **${formatSecondsToTime(startSec)}** to **${formatSecondsToTime(
              startSec + segmentLen
            )}**.${buildTranscriptExcerpt(transcriptSegments, startSec, startSec + segmentLen)}`,
          quizzes: ai?.quizzes?.length
            ? ai.quizzes.map((q, qIdx) => ({
                ...q,
                id: `${courseId}-q-${idx}-${qIdx}`,
                timestampSeconds: startSec,
              }))
            : [
                {
                  id: `${courseId}-q-${idx}`,
                  question: `What is the best practice while working through "${label}"?`,
                  options: [
                    'Pause, take notes, and test the concepts hands-on',
                    'Skip ahead without understanding prerequisites',
                    'Watch passively without reviewing timestamps',
                    'Ignore core definitions',
                  ],
                  correctAnswer: 0,
                  explanation: 'Active practice and note-taking solidify comprehension.',
                  timestampSeconds: startSec,
                },
              ],
        };
      });
    }

    const newCourse: Course = {
      id: courseId,
      title: video.title,
      description: `Structured ${lessons.length}-module interactive course created from ${video.author}'s video.`,
      thumbnail: video.thumbnail,
      sourceUrl: url,
      sourceType: 'video_chapters',
      author: video.author,
      totalDuration: video.lengthSeconds ? formatSecondsToTime(video.lengthSeconds) : `${lessons.length} Modules`,
      createdAt: new Date().toISOString(),
      lessons,
    };

    return NextResponse.json({ course: newCourse });
  } catch (error: any) {
    console.error('Error generating course:', error);
    return NextResponse.json(
      { error: error.message || 'Server error while generating course' },
      { status: 500 }
    );
  }
}
