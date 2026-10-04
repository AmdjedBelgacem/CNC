'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CtaSignupProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

/**
 * Gradient email-capture band (mockup final CTA): pill, display headline,
 * supporting copy, an email form that routes to `formAction`, and fine print.
 */
export function CtaSignupBlock({ props }: BlockComponentProps<CtaSignupProps>) {
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
  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const target = formAction || '/register';
    const glue = target.includes('?') ? '&' : '?';
    router.push(email ? `${target}${glue}email=${encodeURIComponent(email)}` : target);
  };
  return (
    <section id={id} className={cn('relative overflow-hidden', className)} style={layoutStyle(props)}>
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="relative rounded-3xl bg-gradient-to-br from-primary via-primary to-secondary p-10 sm:p-16 text-white shadow-2xl overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute -end-16 -bottom-16 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
          <div className="absolute top-0 end-0 p-8 opacity-10 pointer-events-none hidden lg:block">
            <svg className="w-80 h-80" fill="currentColor" viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" fill="none" r="80" stroke="white" strokeDasharray="4 4" strokeWidth="2"></circle>
              <circle cx="100" cy="100" fill="none" r="50" stroke="white" strokeWidth="1.5"></circle>
              <line stroke="white" strokeWidth="2" x1="20" x2="180" y1="100" y2="100"></line>
              <line stroke="white" strokeWidth="2" x1="100" x2="100" y1="20" y2="180"></line>
            </svg>
          </div>
          <div className="relative z-10 max-w-2xl">
            {pill ? (
              <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider mb-6 backdrop-blur-md">
                {pill}
              </span>
            ) : null}
            <h2 className="font-display-hero text-3xl sm:text-5xl font-bold tracking-tight mb-6 leading-tight">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-white/80 text-base sm:text-lg mb-8 leading-relaxed">{subtitle}</p>
            ) : null}
            <form className="flex flex-col sm:flex-row gap-3 max-w-md" onSubmit={onSubmit}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className="h-12 px-4 rounded-lg bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm border-0 grow"
              />
              <button
                type="submit"
                className="h-12 px-6 rounded-lg bg-accent text-accent-foreground font-bold text-sm shadow-md hover:bg-accent/90 transition-all shrink-0 flex items-center justify-center gap-2"
              >
                <span>{buttonLabel}</span>
                <Icon name="arrow_forward" className="size-4" />
              </button>
            </form>
            {note ? <div className="mt-4 text-xs text-white/60">{note}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
