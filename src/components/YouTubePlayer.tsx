'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';

export interface SeekRequest {
  time: number;
  seq: number;
}

export interface PlayerHandle {
  getCurrentTime: () => number;
}

interface YouTubePlayerProps {
  videoId: string;
  initialTime?: number;
  seekRequest?: SeekRequest | null;
  playerHandleRef?: React.MutableRefObject<PlayerHandle | null>;
  onEnded?: () => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  initialTime = 0,
  seekRequest = null,
  playerHandleRef,
  onEnded,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const loadedVideoIdRef = useRef<string | null>(null);
  const onEndedRef = useRef(onEnded);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    let cancelled = false;

    const mountPlayer = () => {
      if (cancelled || !wrapperRef.current || !window.YT?.Player) return;

      // If player is already mounted and ready, switch video or seek directly without recreating iframe
      if (playerRef.current && isReady && typeof playerRef.current.loadVideoById === 'function') {
        if (loadedVideoIdRef.current !== videoId) {
          loadedVideoIdRef.current = videoId;
          playerRef.current.loadVideoById({ videoId, startSeconds: initialTime });
        } else if (initialTime > 0 && typeof playerRef.current.seekTo === 'function') {
          playerRef.current.seekTo(initialTime, true);
        }
        return;
      }

      // Cleanly recreate an imperative mount node so React never collides with YT iframe replacement
      wrapperRef.current.innerHTML = '';
      const target = document.createElement('div');
      target.className = 'w-full h-full';
      wrapperRef.current.appendChild(target);

      loadedVideoIdRef.current = videoId;
      playerRef.current = new window.YT.Player(target, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          start: initialTime,
        },
        events: {
          onReady: () => {
            if (!cancelled) {
              setIsReady(true);
              if (playerHandleRef) {
                playerHandleRef.current = {
                  getCurrentTime: () => playerRef.current?.getCurrentTime?.() || 0,
                };
              }
            }
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.ENDED && onEndedRef.current) {
              onEndedRef.current();
            }
          },
        },
      });
    };

    if (!window.YT) {
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevReady) prevReady();
        mountPlayer();
      };
    } else if (window.YT.Player) {
      mountPlayer();
    }

    return () => {
      cancelled = true;
    };
  }, [videoId, initialTime]);

  // Cleanup player on unmount only
  useEffect(() => {
    return () => {
      if (playerRef.current?.destroy) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
      playerRef.current = null;
      loadedVideoIdRef.current = null;
    };
  }, []);

  // Handle external seek requests (e.g. clicking timestamps or "Replay the Moment")
  useEffect(() => {
    if (seekRequest && playerRef.current?.seekTo) {
      playerRef.current.seekTo(seekRequest.time, true);
      if (typeof playerRef.current.playVideo === 'function') {
        playerRef.current.playVideo();
      }
    }
  }, [seekRequest]);

  const handleSpeedChange = (rate: number) => {
    if (playerRef.current?.setPlaybackRate) {
      playerRef.current.setPlaybackRate(rate);
      setPlaybackRate(rate);
    }
  };

  const skipSeconds = (seconds: number) => {
    if (playerRef.current?.getCurrentTime && playerRef.current?.seekTo) {
      const current = playerRef.current.getCurrentTime();
      playerRef.current.seekTo(Math.max(0, current + seconds), true);
    }
  };

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl relative group">
      {/* 16:9 Aspect Ratio Container */}
      <div className="relative w-full pt-[56.25%] bg-black">
        <div ref={wrapperRef} className="absolute inset-0 w-full h-full" />
      </div>

      {/* Quick Action Overlay Bar */}
      <div className="px-4 py-2.5 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => skipSeconds(-10)}
            className="flex items-center gap-1 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 transition cursor-pointer"
            title="Rewind 10 seconds"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>-10s</span>
          </button>
          <button
            type="button"
            onClick={() => skipSeconds(10)}
            className="flex items-center gap-1 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 transition cursor-pointer"
            title="Forward 10 seconds"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>+10s</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-500 mr-1">Speed:</span>
          {[1, 1.25, 1.5, 1.75, 2].map((speed) => (
            <button
              type="button"
              key={speed}
              onClick={() => handleSpeedChange(speed)}
              className={`px-2 py-0.5 rounded-md font-mono font-medium transition cursor-pointer ${
                playbackRate === speed
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/40'
                  : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
