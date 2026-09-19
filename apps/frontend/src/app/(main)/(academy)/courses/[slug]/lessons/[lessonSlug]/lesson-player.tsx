'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DifficultyBar } from '@/components/academy/difficulty-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/auth-store';
import { Play, Pause, CheckCircle, Loader2, FileDown } from 'lucide-react';
interface Attachment {
  name: string;
  type: string;
  url: string;
  description?: string;
}
interface LessonData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  videoDuration: number | null;
  content: string | null;
  attachments: Attachment[] | null;
  difficulty: number;
  freePreview: boolean;
  isPublished: boolean;
  thumbnailUrl: string | null;
  series?: {
    id: string;
    title: string;
    slug: string;
    course?: { id: string; title: string; slug: string };
  };
}
interface LessonPlayerProps {
  lessonSlug: string;
  courseSlug: string;
}
export function LessonPlayer({ lessonSlug, courseSlug: _courseSlug }: LessonPlayerProps) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [completed, setCompleted] = useState(false);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const {
    data: lesson,
    isLoading,
    error,
  } = useQuery<LessonData>({
    queryKey: ['lesson', _courseSlug, lessonSlug],
    queryFn: () =>
      fetch(`/api/proxy/courses/${_courseSlug}/lessons/${lessonSlug}`, {
        credentials: 'include',
      }).then((r) => {
        if (!r.ok) throw new Error('Lesson not found');
        return r.json();
      }),
  });

  // Authorized playback URL — lesson metadata redacts S3 keys (videoUrl=null),
  // so the actual playable URL must come from the paywalled playback endpoint:
  // GET /courses/:courseSlug/lessons/:lessonSlug/playback → { url, lessonId }.
  // Falls back to legacy direct videoUrl (old uploads stored absolute URLs).
  const {
    data: playback,
    isLoading: playbackLoading,
    error: playbackError,
  } = useQuery<{ url: string; lessonId: string }>({
    queryKey: ['lesson-playback', _courseSlug, lessonSlug],
    queryFn: async () => {
      const r = await fetch(
        `/api/proxy/courses/${_courseSlug}/lessons/${lessonSlug}/playback`,
        { credentials: 'include' },
      );
      if (!r.ok) {
        const err: Error & { status?: number; body?: unknown } = new Error(
          r.status === 403
            ? 'Enroll in the course to view this lesson'
            : r.status === 401
              ? 'Please sign in to watch this lesson'
              : r.status === 404
                ? 'Video not available yet'
                : 'Failed to load video',
        );
        err.status = r.status;
        err.body = await r.json().catch(() => null);
        throw err;
      }
      return r.json();
    },
    enabled: !!lesson?.id,
    retry: (count, err) => {
      const status = (err as Error & { status?: number })?.status;
      // Don't retry auth/paywall/missing states — they need user action, not refetch.
      if (status === 401 || status === 403 || status === 404) return false;
      return count < 1;
    },
  });
  const { data: existingProgress } = useQuery<{ completed: boolean; watchTimeSeconds: number }>({
    queryKey: ['lesson-progress', lesson?.id],
    queryFn: () =>
      fetch(`/api/proxy/courses/${lesson?.series?.course?.id}/progress`, {
        credentials: 'include',
      }).then((r) => r.json()),
    enabled: !!lesson?.id && isAuthenticated,
  });
  const progressMutation = useMutation({
    mutationFn: (data: { lessonId: string; watchTimeSeconds?: number; completed?: boolean }) =>
      fetch('/api/proxy/courses/progress', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-progress'] });
      queryClient.invalidateQueries({ queryKey: ['lesson-progress'] });
    },
  });
  const syncProgress = useCallback(() => {
    if (!lesson?.id || !isAuthenticated || !videoRef.current) return;
    const watchTime = Math.floor(videoRef.current.currentTime);
    progressMutation.mutate({ lessonId: lesson.id, watchTimeSeconds: watchTime });
  }, [lesson?.id, isAuthenticated, progressMutation]);
  useEffect(() => {
    if (isPlaying && isAuthenticated) {
      progressInterval.current = setInterval(syncProgress, 30000);
    }
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isPlaying, isAuthenticated, syncProgress]);
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };
  const handleMarkComplete = () => {
    if (!lesson?.id) return;
    setCompleted(true);
    progressMutation.mutate({
      lessonId: lesson.id,
      completed: true,
      watchTimeSeconds: Math.floor(currentTime),
    });
  };
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isComplete = completed || existingProgress?.completed;
  // Playback endpoint wins (signed S3 URL for tenants/... keys); legacy absolute
  // videoUrl (old uploads) is the fallback. Metadata videoUrl is null for new uploads.
  const videoUrl = playback?.url || lesson?.videoUrl || '';
  const playbackStatus = (playbackError as (Error & { status?: number }) | null)?.status;
  const showPlaybackLoading = playbackLoading && !lesson?.videoUrl;
  const [videoError, setVideoError] = useState<string | null>(null);
  // Reset element-level errors whenever the resolved URL changes (retry / new lesson).
  useEffect(() => {
    setVideoError(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [videoUrl]);
  const retryPlayback = () => {
    setVideoError(null);
    queryClient.invalidateQueries({ queryKey: ['lesson-playback', _courseSlug, lessonSlug] });
  };
  if (isLoading) {
    return (
      <div className="space-y-4">
        {' '}
        <Skeleton className="aspect-video w-full rounded-lg" /> <Skeleton className="h-8 w-2/3" />{' '}
        <Skeleton className="h-4 w-1/3" />{' '}
      </div>
    );
  }
  if (error || !lesson) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        {' '}
        <p className="text-lg font-semibold">Lesson not found</p>{' '}
        <p className="text-sm text-muted-foreground mt-1">
          This lesson may not be published yet.
        </p>{' '}
      </div>
    );
  }
  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {' '}
      <div className="lg:col-span-2 space-y-6">
        {' '}
        <div className="relative aspect-video rounded-lg overflow-hidden bg-black group">
          {' '}
          {videoError ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="font-semibold text-white">Video failed to load</p>
              <p className="max-w-sm text-sm text-white/70">
                {videoError} The signed URL may have expired or MinIO may be unreachable from
                your browser.
              </p>
              <button
                type="button"
                onClick={retryPlayback}
                className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white"
              >
                Retry video
              </button>
            </div>
          ) : videoUrl ? (
            <video
              key={videoUrl}
              ref={videoRef}
              src={videoUrl}
              className="h-full w-full"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={() => setVideoError('The video file could not be fetched.')}
              onClick={togglePlay}
controls
            playsInline
            preload="metadata"
            poster={lesson?.thumbnailUrl || '/video-poster.png'}
          />
          ) : showPlaybackLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/5 to-secondary">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading video…</p>
            </div>
          ) : playbackStatus === 401 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="font-semibold text-white">Please sign in to watch this lesson</p>
              <p className="text-sm text-white/70">
                {lesson?.freePreview ? 'Sign in to get your playback URL.' : 'This lesson requires an account.'}
              </p>
              <a href="/login" className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">
                Sign in
              </a>
            </div>
          ) : playbackStatus === 403 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="font-semibold text-white">Enroll to watch this video</p>
              <p className="max-w-sm text-sm text-white/70">
                {(playbackError as Error)?.message || 'Enroll in the course to view this lesson.'}
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="font-semibold text-white">No video for this lesson yet</p>
              <p className="max-w-sm text-sm text-white/70">
                {playbackStatus === 404
                  ? 'The video file is missing on the server. Re-upload it from Course Studio → lesson video.'
                  : 'Upload a video from Course Studio — it will appear here once processed.'}
              </p>
            </div>
          )}{' '}
          {!videoUrl && !playbackStatus && !showPlaybackLoading && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              {' '}
              <div className="flex items-center gap-2">
                {' '}
                <button
                  onClick={togglePlay}
                  className="p-2 text-white hover:text-primary transition-colors"
                >
                  {' '}
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}{' '}
                </button>{' '}
                <div className="flex-1 h-1 bg-white rounded-full overflow-hidden">
                  {' '}
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />{' '}
                </div>{' '}
                <span className="text-xs text-white/80 tabular-nums">
                  {' '}
                  {Math.floor(currentTime / 60)}:
                  {String(Math.floor(currentTime % 60)).padStart(2, '0')} /{' '}
                  {Math.floor(duration / 60)}:
                  {String(Math.floor(duration % 60)).padStart(2, '0')}{' '}
                </span>{' '}
              </div>{' '}
            </div>
          )}{' '}
        </div>{' '}
        <div className="flex items-start justify-between gap-4">
          {' '}
          <div>
            {' '}
            <h1 className="text-2xl font-bold">{lesson.title}</h1>{' '}
            {lesson.description && (
              <p className="mt-1 text-muted-foreground">{lesson.description}</p>
            )}{' '}
          </div>{' '}
          <div className="flex items-center gap-3 shrink-0">
            {' '}
            <DifficultyBar level={lesson.difficulty} size="sm" showLabel />{' '}
            {lesson.freePreview && <Badge>Free Preview</Badge>}{' '}
          </div>{' '}
        </div>{' '}
        <div className="flex items-center gap-3">
          {' '}
          <Button
            onClick={handleMarkComplete}
            disabled={isComplete || progressMutation.isPending}
            variant={isComplete ? 'secondary' : 'default'}
          >
            {' '}
            {progressMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}{' '}
            {isComplete ? 'Completed' : 'Mark as Complete'}{' '}
          </Button>{' '}
          {lesson.series && (
            <span className="text-sm text-muted-foreground">
              {' '}
              {lesson.series.title} &middot; {lesson.series.course?.title}{' '}
            </span>
          )}{' '}
        </div>{' '}
        {lesson.content && (
          <div className="prose prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-line">
            {' '}
            {lesson.content}{' '}
          </div>
        )}{' '}
      </div>{' '}
      <div className="space-y-6">
        {' '}
        <div className="rounded-lg border bg-card p-5">
          {' '}
          <h3 className="font-semibold mb-4">Lesson Resources</h3>{' '}
          {lesson.attachments && lesson.attachments.length > 0 ? (
            <div className="space-y-2">
              {' '}
              {lesson.attachments.map((file, i) => (
                <a
                  key={i}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2.5 text-sm transition-colors hover:bg-muted group"
                >
                  {' '}
                  <FileDown className="h-4 w-4 text-primary shrink-0" />{' '}
                  <div className="flex-1 min-w-0">
                    {' '}
                    <p className="truncate font-medium">{file.name}</p>{' '}
                    {file.description && (
                      <p className="text-xs text-muted-foreground truncate">{file.description}</p>
                    )}{' '}
                  </div>{' '}
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {file.type}
                  </Badge>{' '}
                </a>
              ))}{' '}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No downloadable files for this lesson yet.
            </p>
          )}{' '}
        </div>{' '}
        <div className="rounded-lg border bg-card p-5">
          {' '}
          <h3 className="font-semibold mb-2">Navigation</h3>{' '}
          <p className="text-sm text-muted-foreground">
            {' '}
            Previous and next lesson navigation coming soon.{' '}
          </p>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
