'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Expand,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ContentLocale } from '@titan/shared';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/api/normalize';

export interface CinematicVideoPlayerProps {
  src: string;
  poster?: string | null;
  title?: string | null;
  captionsUrl?: string | null;
  locale?: ContentLocale;
  variant?: 'lesson' | 'trailer' | 'inline';
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  onEnded?: () => void;
  onError?: (message: string) => void;
  onTimeUpdate?: (currentTime: number) => void;
}

function formatPlayerTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  return formatDuration(Math.floor(seconds));
}

export const CinematicVideoPlayer = forwardRef<HTMLVideoElement, CinematicVideoPlayerProps>(
  function CinematicVideoPlayer(
    {
      src,
      poster,
      title,
      captionsUrl,
      locale = 'en',
      variant = 'lesson',
      className,
      autoPlay = false,
      muted = false,
      preload = 'metadata',
      onEnded,
      onError,
      onTimeUpdate,
    },
    forwardedRef,
  ) {
    const t = useTranslations('media');
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const controlsTimer = useRef<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.85);
    const [isMuted, setIsMuted] = useState(muted);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);

    const assignVideoRef = useCallback(
      (node: HTMLVideoElement | null) => {
        videoRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const revealControls = useCallback(() => {
      setControlsVisible(true);
      if (controlsTimer.current) window.clearTimeout(controlsTimer.current);
      if (isPlaying) {
        controlsTimer.current = window.setTimeout(() => setControlsVisible(false), 2800);
      }
    }, [isPlaying]);

    useEffect(() => {
      revealControls();
      return () => {
        if (controlsTimer.current) window.clearTimeout(controlsTimer.current);
      };
    }, [revealControls]);

    useEffect(() => {
      setHasError(false);
      setErrorMessage(null);
      setIsPlaying(false);
      setIsBuffering(false);
      setCurrentTime(0);
      setDuration(0);
      const video = videoRef.current;
      if (!video) return;
      video.load();
      if (autoPlay) void video.play().catch(() => undefined);
    }, [src, autoPlay]);

    useEffect(() => {
      const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
      document.addEventListener('fullscreenchange', onFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, []);

    useEffect(() => {
      const video = videoRef.current;
      if (video) {
        video.volume = volume;
        video.muted = isMuted;
      }
    }, [volume, isMuted]);

    const togglePlay = useCallback(() => {
      const video = videoRef.current;
      if (!video || hasError) return;
      if (video.paused) {
        void video.play().catch(() => {
          const message = t('videoError');
          setHasError(true);
          setErrorMessage(message);
          onError?.(message);
        });
      } else {
        video.pause();
      }
      revealControls();
    }, [hasError, onError, revealControls, t]);

    const retry = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      setHasError(false);
      setErrorMessage(null);
      video.load();
      void video.play().catch(() => undefined);
      revealControls();
    }, [revealControls]);

    const seek = useCallback(
      (value: number) => {
        const video = videoRef.current;
        if (!video || !Number.isFinite(value)) return;
        video.currentTime = value;
        setCurrentTime(value);
        revealControls();
      },
      [revealControls],
    );

    const changeVolume = useCallback(
      (value: number) => {
        const video = videoRef.current;
        if (!video) return;
        const next = Math.min(1, Math.max(0, value));
        video.volume = next;
        video.muted = next === 0;
        setVolume(next);
        setIsMuted(next === 0);
        revealControls();
      },
      [revealControls],
    );

    const toggleMute = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = !video.muted;
      setIsMuted(video.muted);
      revealControls();
    }, [revealControls]);

    const changeSpeed = useCallback(
      (rate: number) => {
        const video = videoRef.current;
        if (video) video.playbackRate = rate;
        setPlaybackRate(rate);
        setShowSpeedMenu(false);
        revealControls();
      },
      [revealControls],
    );

    const toggleFullscreen = useCallback(() => {
      const container = containerRef.current;
      if (!container) return;
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void container.requestFullscreen();
      }
      revealControls();
    }, [revealControls]);

    const handleKeyDown = useCallback(
      (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement) return;
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          togglePlay();
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          seek(Math.max(0, (videoRef.current?.currentTime ?? 0) - 5));
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          seek(Math.min(duration, (videoRef.current?.currentTime ?? 0) + 5));
        } else if (event.key.toLowerCase() === 'm') {
          event.preventDefault();
          toggleMute();
        } else if (event.key.toLowerCase() === 'f') {
          event.preventDefault();
          toggleFullscreen();
        }
      },
      [duration, seek, toggleFullscreen, toggleMute, togglePlay],
    );

    const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
    const controlButton = 'inline-flex size-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80';

    return (
      <div
        ref={containerRef}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseMove={revealControls}
        className={cn(
          'group relative isolate w-full overflow-hidden bg-black text-white shadow-2xl shadow-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isFullscreen ? 'aspect-auto rounded-none' : variant === 'trailer' ? 'aspect-video rounded-3xl' : 'aspect-video rounded-2xl',
          className,
        )}
        aria-label={title ?? t('play')}
      >
        <video
          ref={assignVideoRef}
          key={src}
          src={src}
          poster={poster ?? undefined}
          className="size-full object-cover"
          playsInline
          autoPlay={autoPlay}
          muted={isMuted}
          preload={preload}
          onClick={togglePlay}
          onPlay={() => {
            setIsPlaying(true);
            setIsBuffering(false);
            revealControls();
          }}
          onPause={() => {
            setIsPlaying(false);
            setControlsVisible(true);
          }}
          onWaiting={() => setIsBuffering(true)}
          onStalled={() => setIsBuffering(true)}
          onCanPlay={() => setIsBuffering(false)}
          onLoadedMetadata={(event) => {
            const nextDuration = event.currentTarget.duration;
            setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
          }}
          onDurationChange={(event) => {
            const nextDuration = event.currentTarget.duration;
            setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
          }}
          onTimeUpdate={(event) => {
            const nextTime = event.currentTarget.currentTime;
            setCurrentTime(nextTime);
            onTimeUpdate?.(nextTime);
          }}
          onEnded={() => {
            setIsPlaying(false);
            setControlsVisible(true);
            onEnded?.();
          }}
          onError={() => {
            const message = t('videoError');
            setHasError(true);
            setErrorMessage(message);
            onError?.(message);
          }}
        >
          {captionsUrl ? (
            <track
              kind="captions"
              src={captionsUrl}
              srcLang={locale}
              label={locale === 'ar' ? 'العربية' : 'English'}
            />
          ) : null}
        </video>

        {title ? (
          <div className="pointer-events-none absolute start-4 top-4 z-10 max-w-[80%]">
            <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur-md">
              {title}
            </span>
          </div>
        ) : null}

        {!isPlaying && !hasError ? (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/70 via-black/10 to-black/10 transition hover:from-black/80"
            aria-label={t('play')}
          >
            <span className="flex size-16 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white shadow-xl backdrop-blur-md transition duration-200 group-hover:scale-105 group-hover:bg-white/25 sm:size-20">
              <Play className="ms-1 size-7 fill-current sm:size-8" />
            </span>
            <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/85 backdrop-blur-md">
              {t('play')}
            </span>
          </button>
        ) : null}

        {isBuffering && isPlaying ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/20">
            <span className="flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-xs font-medium text-white backdrop-blur-md">
              <Loader2 className="size-4 animate-spin" />
              {t('buffering')}
            </span>
          </div>
        ) : null}

        {hasError ? (
          <div role="alert" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center">
            <AlertTriangle className="size-9 text-warning" />
            <p className="font-semibold text-white">{errorMessage ?? t('videoError')}</p>
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <RotateCcw className="size-4" />
              {t('retryVideo')}
            </button>
          </div>
        ) : null}

        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 pb-3 pt-14 transition-opacity duration-200 sm:px-5 sm:pb-4',
            controlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0',
          )}
        >
          <div className="pointer-events-auto">
            <div className="relative mb-3 h-1.5 rounded-full bg-white/25">
              <div className="absolute inset-y-0 start-0 rounded-full bg-primary" style={{ width: `${progress}%` }} />
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => seek(Number(event.currentTarget.value))}
                disabled={!duration}
                aria-label={t('seek')}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
              />
            </div>
            <div className="flex items-center gap-1.5 text-white sm:gap-2">
              <button type="button" onClick={togglePlay} className={controlButton} aria-label={isPlaying ? t('pause') : t('play')}>
                {isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
              </button>
              <span className="font-mono text-[11px] tabular-nums text-white/75">
                {formatPlayerTime(currentTime)} <span className="text-white/40">/</span> {duration ? formatPlayerTime(duration) : '--:--'}
              </span>
              <div className="ms-auto flex items-center gap-1.5">
                <div className="hidden items-center gap-2 sm:flex">
                  <button type="button" onClick={toggleMute} className={controlButton} aria-label={isMuted ? t('unmute') : t('mute')}>
                    {isMuted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(event) => changeVolume(Number(event.currentTarget.value))}
                    aria-label={t('volume')}
                    className="h-1 w-20 cursor-pointer accent-white"
                  />
                </div>
                <button type="button" onClick={toggleMute} className={cn(controlButton, 'sm:hidden')} aria-label={isMuted ? t('unmute') : t('mute')}>
                  {isMuted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSpeedMenu((value) => !value)}
                    className="inline-flex h-8 min-w-10 items-center justify-center rounded-full px-2 font-mono text-[11px] text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                    aria-label={t('playbackSpeed')}
                  >
                    {playbackRate}x
                  </button>
                  {showSpeedMenu ? (
                    <div className="absolute bottom-10 end-0 min-w-24 overflow-hidden rounded-xl border border-white/15 bg-black/85 p-1 shadow-xl backdrop-blur-md">
                      {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => changeSpeed(rate)}
                          className={cn(
                            'block w-full rounded-lg px-3 py-2 text-start font-mono text-xs text-white/75 transition hover:bg-white/10 hover:text-white',
                            playbackRate === rate && 'bg-white/15 text-white',
                          )}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button type="button" onClick={toggleFullscreen} className={controlButton} aria-label={isFullscreen ? t('exitFullscreen') : t('fullscreen')}>
                  {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {variant === 'trailer' ? (
          <div className="pointer-events-none absolute end-4 top-4 z-10 flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75 backdrop-blur-md">
            <Expand className="size-3" />
            {t('cinematic')}
          </div>
        ) : null}
      </div>
    );
  },
);

CinematicVideoPlayer.displayName = 'CinematicVideoPlayer';
