'use client';
import { TitanTvSeriesSkeleton } from '@/components/skeletons/public-page-replicas';
import { rememberListCount } from '@/lib/admin-shape-memory';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Play, Clock, Film } from 'lucide-react';
import { getImageSrc } from '@/lib/images';
import { Reveal } from '@/components/ui/motion';
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
  // A video with no URL is shown, but not as a link: an anchor to `#` would look clickable and do nothing.
  const className =
    'group w-72 shrink-0 snap-start rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background';
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    video.videoUrl ? (
      <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    ) : (
      <div className={className}>{children}</div>
    );
  return (
    <Wrapper>
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted shadow-xs ring-1 ring-inset ring-border/70 transition-shadow duration-300 group-hover:shadow-lg">
        <img
          src={getImageSrc(video.thumbnailUrl, 'video')}
          alt={video.title}
          className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-overlay/0 transition-colors duration-300 group-hover:bg-overlay/25">
          <div className="flex size-12 scale-90 items-center justify-center rounded-full bg-card/95 text-primary opacity-0 shadow-lg backdrop-blur transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-100 group-hover:opacity-100">
            <Play className="ms-0.5 size-5 fill-current" />
          </div>
        </div>
        {video.duration && (
          <span className="absolute bottom-2 end-2 flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-xs font-medium tabular-nums text-foreground shadow-sm backdrop-blur">
            <Clock className="size-3.5" /> {formatDuration(video.duration)}
          </span>
        )}
      </div>
      <h4 className="mt-3 line-clamp-2 font-display text-base font-medium leading-snug tracking-[-0.01em] transition-colors group-hover:text-primary">
        {video.title}
      </h4>
    </Wrapper>
  );
}
export default function TitanTvPage() {
  const t = useTranslations('pages.titanTv');
  const { data, isLoading, error } = useQuery<{ data: Series[] }>({
    queryKey: ['titan-tv'],
    queryFn: () =>
      fetch('/api/proxy/titan-tv', { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      }),
    retry: 2,
  });
  // The /titan-tv skeleton draws as many series rows as this page last showed.
  useEffect(() => {
    if (data?.data) rememberListCount('public-titan-tv', data.data.length);
  }, [data]);
  return (
    <div>
      <section className="relative isolate overflow-hidden border-b border-border/70 py-20 md:py-28">
        <div aria-hidden className="absolute inset-0 -z-10 ambient-wash" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 blueprint-grid opacity-70 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
        />
        <div className="container mx-auto px-4 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3.5 py-1.5 text-[13px] font-medium text-foreground/80 shadow-xs">
            <Film className="size-4 text-primary" /> TITAN TV
          </div>
          <h1 className="mx-auto max-w-3xl text-balance font-display text-4xl font-medium tracking-[-0.025em] sm:text-5xl md:text-6xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
      </section>
      <section className="py-20">
        <div className="container mx-auto px-4">
          {isLoading && <TitanTvSeriesSkeleton />}
          {error && (
            <Reveal className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-20 text-center">
              <span className="mb-5 flex size-14 items-center justify-center rounded-full bg-muted ring-1 ring-inset ring-border/70">
                <Film className="size-6 text-muted-foreground" />
              </span>
              <h3 className="font-display text-xl font-medium">{t('loadFailedTitle')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t('loadFailedHint')}</p>
            </Reveal>
          )}
          {data?.data && data.data.length === 0 && (
            <Reveal className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-20 text-center">
              <span className="mb-5 flex size-14 items-center justify-center rounded-full bg-muted ring-1 ring-inset ring-border/70">
                <Film className="size-6 text-muted-foreground" />
              </span>
              <h3 className="font-display text-xl font-medium">{t('emptyTitle')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t('emptyHint')}</p>
            </Reveal>
          )}
          {data?.data && data.data.length > 0 && (
            <div className="space-y-20">
              {data.data.map((series) => (
                <Reveal key={series.id}>
                  <div className="mb-1 flex items-end justify-between gap-4">
                    <h2 className="font-display text-2xl font-medium tracking-[-0.018em] md:text-3xl">
                      {series.title}
                    </h2>
                  </div>
                  {series.description && (
                    <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {series.description}
                    </p>
                  )}
                  <div className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 pt-1 scrollbar-thin">
                    {series.videos.map((video) => (
                      <VideoCard key={video.id} video={video} />
                    ))}
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
