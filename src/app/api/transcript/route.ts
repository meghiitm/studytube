import { NextResponse } from 'next/server';
import { fetchVideoTranscript } from '@/lib/youtube';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');

  if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
    return NextResponse.json({ error: 'Invalid videoId' }, { status: 400 });
  }

  const result = await fetchVideoTranscript(videoId);
  if (!result) {
    return NextResponse.json({ segments: [], language: null });
  }

  return NextResponse.json(result);
}
