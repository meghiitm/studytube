export interface ExtractedChapter {
  timeSeconds: number;
  label: string;
}

export interface ExtractedPlaylistVideo {
  videoId: string;
  title: string;
  duration: string;
  author?: string;
  thumbnail: string;
}

export interface ExtractedPlaylistInfo {
  title: string;
  author: string;
  thumbnail: string;
  videos: ExtractedPlaylistVideo[];
}

export interface ExtractedVideoInfo {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  lengthSeconds: number;
  description: string;
  chapters: ExtractedChapter[];
}

const YT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Extracts YouTube Video ID or Playlist ID from URL.
 * If URL has both ?v=... and ?list=... (e.g. watching a video inside a playlist),
 * prioritizes playlist unless list is a personal mix (RD...) or Watch Later (WL).
 */
export function parseYouTubeUrl(url: string): { type: 'playlist' | 'video' | null; id: string | null } {
  try {
    const parsed = new URL(url.trim());

    const listId = parsed.searchParams.get('list');
    const vId = parsed.searchParams.get('v');

    if (parsed.pathname.includes('/playlist') && listId) {
      return { type: 'playlist', id: listId };
    }

    if (listId && !listId.startsWith('RD') && listId !== 'WL' && listId !== 'LL') {
      return { type: 'playlist', id: listId };
    }

    if (vId) {
      return { type: 'video', id: vId };
    }

    if (parsed.hostname === 'youtu.be') {
      const videoId = parsed.pathname.slice(1).split('?')[0];
      if (videoId) return { type: 'video', id: videoId };
    }

    const parts = parsed.pathname.split('/');
    const shortOrEmbedIndex = parts.findIndex((p) => p === 'embed' || p === 'shorts' || p === 'live');
    if (shortOrEmbedIndex !== -1 && parts[shortOrEmbedIndex + 1]) {
      return { type: 'video', id: parts[shortOrEmbedIndex + 1] };
    }

    return { type: null, id: null };
  } catch {
    return { type: null, id: null };
  }
}

/**
 * Safely extracts a JSON object starting right after a marker in HTML.
 */
function extractJsonAfter(html: string, marker: string): any | null {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = html.indexOf('{', idx);
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let escape = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inStr) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (!inStr) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(start, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Helper to parse timestamps like "04:20", "1:05:30" or "00:45" to total seconds
 */
export function timestampToSeconds(timeStr: string): number {
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

/**
 * Formats seconds back to "MM:SS" or "HH:MM:SS"
 */
export function formatSecondsToTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Parses chapter timestamps from a YouTube video description
 */
export function parseChaptersFromDescription(description: string): ExtractedChapter[] {
  if (!description) return [];
  const lines = description.split('\n');
  const chapters: ExtractedChapter[] = [];
  const seenTimes = new Set<number>();

  // Match lines like "00:00 Intro", "[04:25] Data Fetching", "1:05:30 - Deployment", "04:25: Setup"
  const regex = /(?:^|\s|\[|\()(\d{1,2}:\d{2}(?::\d{2})?)(?:\]|\))?\s*[-–—:|]?\s*(.+)/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(regex);
    if (!match) continue;

    const timeSeconds = timestampToSeconds(match[1]);
    let label = match[2].trim().replace(/^[-–—:|]+\s*/, '').trim();

    // Ignore lines that look like URLs or empty labels
    if (!label || label.startsWith('http') || label.length < 2) continue;
    // Trim trailing timestamp if formatted like "Intro (00:00)"
    label = label.slice(0, 90);

    if (!seenTimes.has(timeSeconds)) {
      seenTimes.add(timeSeconds);
      chapters.push({ timeSeconds, label });
    }
  }

  // Only treat as real chapters if there are at least 2 timestamp entries in ascending order
  chapters.sort((a, b) => a.timeSeconds - b.timeSeconds);
  return chapters.length >= 2 ? chapters : [];
}

/**
 * Fetches basic video info using public YouTube oEmbed
 */
export async function fetchOEmbedInfo(
  videoId: string
): Promise<{ title: string; author_name: string; thumbnail_url: string } | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetches full single video metadata + description chapters
 */
export async function fetchVideoDetails(videoId: string): Promise<ExtractedVideoInfo> {
  const oembed = await fetchOEmbedInfo(videoId);
  let title = oembed?.title || 'YouTube Video Course';
  let author = oembed?.author_name || 'YouTube Creator';
  let thumbnail = oembed?.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  let lengthSeconds = 0;
  let description = '';
  let chapters: ExtractedChapter[] = [];

  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: YT_HEADERS,
    });
    if (res.ok) {
      const html = await res.text();
      const player = extractJsonAfter(html, 'ytInitialPlayerResponse =');
      const vd = player?.videoDetails;
      if (vd) {
        if (vd.title) title = vd.title;
        if (vd.author) author = vd.author;
        if (vd.lengthSeconds) lengthSeconds = Number(vd.lengthSeconds) || 0;
        if (vd.shortDescription) {
          description = vd.shortDescription;
          chapters = parseChaptersFromDescription(description);
        }
      }
    }
  } catch {
    // Fallback gracefully to oEmbed metadata
  }

  return {
    videoId,
    title,
    author,
    thumbnail,
    lengthSeconds,
    description,
    chapters,
  };
}

/**
 * Fetches all videos from a public YouTube playlist (HTML ytInitialData + RSS fallback)
 */
export async function fetchPlaylistDetails(playlistId: string): Promise<ExtractedPlaylistInfo | null> {
  let title = `YouTube Playlist`;
  let author = 'YouTube Creator';
  const videos: ExtractedPlaylistVideo[] = [];
  const seenIds = new Set<string>();

  // 1. Primary: Parse ytInitialData from YouTube playlist page
  try {
    const res = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, {
      headers: YT_HEADERS,
    });
    if (res.ok) {
      const html = await res.text();
      const data = extractJsonAfter(html, 'var ytInitialData =');
      if (data) {
        const metaTitle =
          data?.metadata?.playlistMetadataRenderer?.title ||
          data?.header?.playlistHeaderRenderer?.title?.simpleText ||
          data?.header?.pageHeaderRenderer?.pageTitle;
        if (metaTitle) title = metaTitle;

        const metaAuthor =
          data?.header?.playlistHeaderRenderer?.ownerText?.runs?.[0]?.text ||
          data?.sidebar?.playlistSidebarRenderer?.items?.[1]?.playlistSidebarSecondaryInfoRenderer?.videoOwner
            ?.videoOwnerRenderer?.title?.runs?.[0]?.text;
        if (metaAuthor) author = metaAuthor;

        const walk = (obj: any) => {
          if (!obj || typeof obj !== 'object') return;
          if (obj.lockupViewModel && obj.lockupViewModel.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
            const m = obj.lockupViewModel;
            const videoId = m.contentId;
            const vTitle = m.metadata?.lockupMetadataViewModel?.title?.content;
            const duration =
              m.contentImage?.thumbnailViewModel?.overlays?.[0]?.thumbnailBottomOverlayViewModel?.badges?.[0]
                ?.thumbnailBadgeViewModel?.text || '';
            const vAuthor =
              m.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]
                ?.metadataParts?.[0]?.text?.content;

            if (videoId && vTitle && !seenIds.has(videoId)) {
              seenIds.add(videoId);
              videos.push({
                videoId,
                title: vTitle,
                duration,
                author: vAuthor || author,
                thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              });
            }
            return;
          }
          if (obj.playlistVideoRenderer) {
            const v = obj.playlistVideoRenderer;
            const videoId = v.videoId;
            const vTitle = v.title?.runs?.[0]?.text || v.title?.simpleText;
            const duration = v.lengthText?.simpleText || '';
            const vAuthor = v.shortBylineText?.runs?.[0]?.text;
            if (videoId && vTitle && !seenIds.has(videoId)) {
              seenIds.add(videoId);
              videos.push({
                videoId,
                title: vTitle,
                duration,
                author: vAuthor || author,
                thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              });
            }
            return;
          }
          for (const val of Object.values(obj)) {
            walk(val);
          }
        };

        walk(data);
      }
    }
  } catch {
    // Fallback to RSS below
  }

  // 2. Fallback: YouTube public Atom RSS feed (returns up to 15 items cleanly)
  if (videos.length === 0) {
    try {
      const rssRes = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`);
      if (rssRes.ok) {
        const xml = await rssRes.text();
        const feedTitleMatch = xml.match(/<feed[\s\S]*?<title>([^<]+)<\/title>/);
        if (feedTitleMatch) title = decodeXmlEntities(feedTitleMatch[1]);
        const feedAuthorMatch = xml.match(/<feed[\s\S]*?<author>\s*<name>([^<]+)<\/name>/);
        if (feedAuthorMatch) author = decodeXmlEntities(feedAuthorMatch[1]);

        const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
        for (const entry of entries) {
          const vidMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
          const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
          if (vidMatch && titleMatch && !seenIds.has(vidMatch[1])) {
            const videoId = vidMatch[1];
            seenIds.add(videoId);
            videos.push({
              videoId,
              title: decodeXmlEntities(titleMatch[1]),
              duration: '',
              author,
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            });
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  if (videos.length === 0) return null;

  return {
    title,
    author,
    thumbnail: videos[0].thumbnail,
    videos,
  };
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

export interface TranscriptSegment {
  startSeconds: number;
  durationSeconds: number;
  text: string;
}

/**
 * Fetches timestamped YouTube video captions via InnerTube without an API key.
 */
export async function fetchVideoTranscript(
  videoId: string
): Promise<{ segments: TranscriptSegment[]; language: string } | null> {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
        videoId,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) return null;

    // Prefer English (manual first, then auto-generated), else first available track
    const preferred =
      tracks.find((t: any) => t.languageCode === 'en' && t.kind !== 'asr') ||
      tracks.find((t: any) => t.languageCode?.startsWith('en')) ||
      tracks[0];

    if (!preferred?.baseUrl) return null;

    const xmlRes = await fetch(preferred.baseUrl);
    if (!xmlRes.ok) return null;
    const xml = await xmlRes.text();
    if (!xml) return null;

    const rawSegments: TranscriptSegment[] = [];

    // Format 3: <p t="ms" d="ms"><s>...</s></p>
    const pRegex = /<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g;
    let match;
    while ((match = pRegex.exec(xml)) !== null) {
      const startSeconds = Math.floor(Number(match[1]) / 1000);
      const durationSeconds = match[2] ? Math.max(1, Math.round(Number(match[2]) / 1000)) : 3;
      const stripped = match[3].replace(/<[^>]+>/g, '');
      const text = decodeXmlEntities(stripped).replace(/\s+/g, ' ').trim();
      if (text) {
        rawSegments.push({ startSeconds, durationSeconds, text });
      }
    }

    // Legacy format fallback: <text start="sec" dur="sec">...</text>
    if (rawSegments.length === 0) {
      const textRegex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
      while ((match = textRegex.exec(xml)) !== null) {
        const startSeconds = Math.floor(Number(match[1]));
        const durationSeconds = match[2] ? Math.max(1, Math.round(Number(match[2]))) : 3;
        const stripped = match[3].replace(/<[^>]+>/g, '');
        const text = decodeXmlEntities(stripped).replace(/\s+/g, ' ').trim();
        if (text) {
          rawSegments.push({ startSeconds, durationSeconds, text });
        }
      }
    }

    if (rawSegments.length === 0) return null;

    // Merge tiny caption fragments into ~20s readable paragraphs
    const merged: TranscriptSegment[] = [];
    for (const seg of rawSegments) {
      const last = merged[merged.length - 1];
      if (last && seg.startSeconds - last.startSeconds < 20 && last.text.length < 180) {
        last.text += ' ' + seg.text;
        last.durationSeconds = Math.max(last.durationSeconds, seg.startSeconds + seg.durationSeconds - last.startSeconds);
      } else {
        merged.push({ ...seg });
      }
    }

    return {
      segments: merged,
      language: preferred.name?.runs?.[0]?.text || preferred.name?.simpleText || preferred.languageCode || 'en',
    };
  } catch {
    return null;
  }
}
