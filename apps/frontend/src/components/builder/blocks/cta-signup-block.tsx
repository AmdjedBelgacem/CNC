'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CtaSignupProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';
import { useBuilderLivePreview } from '@/components/builder/live-preview-context';
import { Reveal } from '@/components/ui/motion';

/**
 * Paper email-capture panel (final CTA): pill, serif headline,
 * supporting copy, an email form that routes to `formAction`, and fine print.
 */
export function CtaSignupBlock({ props, puck }: BlockComponentProps<CtaSignupProps>) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const {
    id,
    className,
    pill,
    title = '',
    subtitle,
    placeholder = 'Enter your work email...',
    buttonLabel = 'Join Cohort',
    note,
    formAction = '/register',
  } = props;
  const preview = useBuilderLivePreview();
  const isHome = Boolean(preview) && preview?.pageSlug === 'home';
  const livePill =
    isHome && preview?.homeMetrics && typeof pill === 'string' && pill.includes('Cohort')
      ? (preview.homeMetrics.ctaPill ?? pill)
      : pill;
  const liveSubtitle = isHome && preview?.homeMetrics ? preview.homeMetrics.ctaSubtitle : subtitle;
  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Puck intercepts most canvas clicks, but a real form submit would navigate
    // the editor away. Editing the block must never enter the signup flow.
    if (puck?.isEditing) return;
    const target = formAction || '/register';
    const glue = target.includes('?') ? '&' : '?';
    router.push(email ? `${target}${glue}email=${encodeURIComponent(email)}` : target);
  };
  return (
    <section id={id} className={cn('relative overflow-hidden', className)} style={layoutStyle(props)}>
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <Reveal className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-8 shadow-sm sm:p-14 md:p-16">
          {/* Decorative elements: a warm wash and a faint machinist's reticle. */}
          <div className="pointer-events-none absolute inset-0 ambient-wash" aria-hidden />
          <div
            className="pointer-events-none absolute inset-0 blueprint-grid opacity-60 [mask-image:radial-gradient(ellipse_at_85%_50%,black,transparent_65%)]"
            aria-hidden
          />
          <div className="pointer-events-none absolute -end-10 top-1/2 hidden -translate-y-1/2 text-primary/20 lg:block">
            <svg className="h-80 w-80 motion-safe:animate-[spin_120s_linear_infinite]" fill="none" viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r="80" stroke="currentColor" strokeDasharray="3 5" strokeWidth="1"></circle>
              <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="1"></circle>
              <circle cx="100" cy="100" r="3" fill="currentColor"></circle>
              <line stroke="currentColor" strokeWidth="1" x1="20" x2="180" y1="100" y2="100"></line>
              <line stroke="currentColor" strokeWidth="1" x1="100" x2="100" y1="20" y2="180"></line>
            </svg>
          </div>
          <div className="relative z-10 max-w-2xl">
            {livePill ? (
              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-medium text-primary">
                <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                {livePill}
              </span>
            ) : null}
            <h2 className="mb-5 text-balance font-display text-3xl font-medium leading-[1.08] tracking-[-0.022em] text-foreground sm:text-5xl">
              {title}
            </h2>
            {liveSubtitle ? (
              <p className="mb-8 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                {liveSubtitle}
              </p>
            ) : null}
            <form
              className="flex max-w-md flex-col gap-2 rounded-xl sm:flex-row sm:rounded-2xl sm:border sm:border-border sm:bg-background sm:p-1.5 sm:shadow-xs sm:transition-[border-color,box-shadow] sm:focus-within:border-primary/40 sm:focus-within:shadow-[0_0_0_4px_rgb(var(--c-ring)/0.12)]"
              onSubmit={onSubmit}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className="h-11 grow rounded-lg border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:border-0 sm:bg-transparent sm:focus-visible:ring-0"
              />
              <button
                type="submit"
                className="group pressable flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:rounded-xl"
              >
                <span>{buttonLabel}</span>
                <Icon
                  name="arrow_forward"
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                />
              </button>
            </form>
            {note ? <div className="mt-4 text-xs text-muted-foreground">{note}</div> : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
