'use client';
import { useQuery } from '@tanstack/react-query';
import { Play, Clock, Film, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getImageSrc } from '@/lib/images';
interface Video {
  id: string;
  title: string;
  description: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  sortOrder: number;
}
interface Series {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  videos: Video[];
}
function formatDuration(sec: number | null): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function VideoCard({ video }: { video: Video }) {
  return (
    <a
      href={video.videoUrl || '#'}
      target={video.videoUrl ? '_blank' : undefined}
      rel="noopener noreferrer"
      className="group w-72 shrink-0"
    >
      {' '}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-secondary/50">
        {' '}
        <img
          src={getImageSrc(video.thumbnailUrl, 'video')}
          alt={video.title}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />{' '}
        <div className="absolute inset-0 flex items-center justify-center bg-transparent group-hover:bg-overlay transition-colors">
          {' '}
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            {' '}
            <Play className="size-5 fill-current" />{' '}
          </div>{' '}
        </div>{' '}
        {video.duration && (
          <span className="absolute bottom-2 end-2 rounded-md bg-overlay px-1.5 py-0.5 text-xs text-white flex items-center gap-1">
            {' '}
            <Clock className="size-3.5" /> {formatDuration(video.duration)}{' '}
          </span>
        )}{' '}
      </div>{' '}
      <h4 className="mt-2 text-sm font-medium line-clamp-2">{video.title}</h4>{' '}
    </a>
  );
}
export default function TitanTvPage() {
  const { data, isLoading, error } = useQuery<{ data: Series[] }>({
    queryKey: ['titan-tv'],
    queryFn: () =>
      fetch('/api/proxy/titan-tv', { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      }),
    retry: 2,
  });
  return (
    <div>
      {' '}
      <section className="relative overflow-hidden border-b bg-surface-sunken/60 blueprint-grid py-20">
        {' '}
        <div className="container mx-auto px-4 text-center">
          {' '}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-secondary/50 px-4 py-1.5 text-sm">
            {' '}
            <Film className="size-4" /> TITAN TV{' '}
          </div>{' '}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Video Library</h1>{' '}
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
            {' '}
            Machine builds, tooling demos, shop tours, and educational series from Baroot CNC Solutions
            team.{' '}
          </p>{' '}
        </div>{' '}
      </section>{' '}
      <section className="py-16">
        {' '}
        <div className="container mx-auto px-4">
          {' '}
          {isLoading && (
            <div className="space-y-16">
              {' '}
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  {' '}
                  <Skeleton className="mb-4 h-7 w-64" /> <Skeleton className="mb-6 h-4 w-96" />{' '}
                  <div className="flex gap-4 overflow-hidden">
                    {' '}
                    {[1, 2, 3, 4].map((j) => (
                      <Skeleton key={j} className="h-40 w-72 shrink-0 rounded-xl" />
                    ))}{' '}
                  </div>{' '}
                </div>
              ))}{' '}
            </div>
          )}{' '}
          {error && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              {' '}
              <Film className="mb-4 h-12 w-12 text-muted-foreground/50" />{' '}
              <h3 className="text-lg font-semibold">Unable to load video library</h3>{' '}
              <p className="text-sm text-muted-foreground mt-1">
                Please make sure the backend server is running.
              </p>{' '}
            </div>
          )}{' '}
          {data?.data && data.data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              {' '}
              <Film className="mb-4 h-12 w-12 text-muted-foreground/50" />{' '}
              <h3 className="text-lg font-semibold">No video series yet</h3>{' '}
              <p className="text-sm text-muted-foreground mt-1">
                Video content will appear here once published.
              </p>{' '}
            </div>
          )}{' '}
          {data?.data && data.data.length > 0 && (
            <div className="space-y-16">
              {' '}
              {data.data.map((series) => (
                <div key={series.id}>
                  {' '}
                  <div className="mb-1 flex items-center justify-between">
                    {' '}
                    <h2 className="text-2xl font-bold">{series.title}</h2>{' '}
                    <a
                      href="#"
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {' '}
                      View all <ChevronRight className="flip-rtl size-4" />{' '}
                    </a>{' '}
                  </div>{' '}
                  {series.description && (
                    <p className="mb-4 text-sm text-muted-foreground">{series.description}</p>
                  )}{' '}
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
                    {' '}
                    {series.videos.map((video) => (
                      <VideoCard key={video.id} video={video} />
                    ))}{' '}
                  </div>{' '}
                </div>
              ))}{' '}
            </div>
          )}{' '}
        </div>{' '}
      </section>{' '}
    </div>
  );
}
