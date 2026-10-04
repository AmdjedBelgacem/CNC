'use client';
import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { HeroProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Full-screen hero with soft-blended background image and a scroll parallax. */
import { Icon } from '@/components/ui/icon';
export function HeroBlock({ props, puck }: BlockComponentProps<HeroProps>) {
  const {
    imageUrl,
    fullHeight = true,
    scrollIndicator = true,
    backgroundColor,
    contentAlign = 'center',
    backgroundOpacity = 20,
    gradientVeil = true,
    contentMaxWidth = 1024,
    contentPaddingX = 'px-margin-mobile',
    scrollIndicatorBottom = 40,
    parallaxFactor = 10,
    nonFullHeight = 480,
    showTrustChips = true,
    trustNote = 'Free manufacturing education for all',
    trustNoteHref,
    mesh = true,
    className,
  } = props;
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const factor = parallaxFactor / 100;
    const onScroll = () => {
      if (contentRef.current) {
        contentRef.current.style.transform = `translateY(${window.scrollY * factor}px)`;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [parallaxFactor]);
  const style: CSSProperties = { ...layoutStyle(props) };
  if (backgroundColor) style.backgroundColor = backgroundColor;
  if (!fullHeight) style.minHeight = nonFullHeight;
  return (
    <section
      className={cn(
        'relative flex items-center justify-center overflow-hidden',
        fullHeight ? 'min-h-screen' : undefined,
        className,
      )}
      style={style}
    >
      {' '}
      {imageUrl && (
        <div className="absolute inset-0 z-0">
          {' '}
          <img
            src={imageUrl}
            alt=""
            fetchPriority="high"
            decoding="async"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            className="w-full h-full object-cover filter grayscale soft-blend"
            style={{ opacity: backgroundOpacity / 100 }}
          />{' '}
          {gradientVeil && (
            <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background"></div>
          )}{' '}
        </div>
      )}{' '}
      {mesh && (
        <div
          className="absolute inset-0 z-[1] overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          {' '}
          <div className="mesh-blob mesh-blob-a"></div>{' '}
          <div className="mesh-blob mesh-blob-b"></div>{' '}
          <div className="mesh-blob mesh-blob-c"></div>{' '}
          <style>{` .mesh-blob { position: absolute; border-radius: 9999px; filter: blur(90px); will-change: transform; } .mesh-blob-a { width: 34rem; height: 34rem; left: -8rem; top: 8%; background: linear-gradient(135deg, rgb(var(--c-primary) / .32), rgb(var(--c-accent) / .18)); animation: mesh-a 26s ease-in-out infinite; } .mesh-blob-b { width: 30rem; height: 30rem; right: -6rem; top: 18%; background: linear-gradient(135deg, rgb(var(--c-accent) / .26), rgb(var(--c-primary) / .16)); animation: mesh-b 32s ease-in-out infinite; } .mesh-blob-c { width: 26rem; height: 26rem; left: 38%; bottom: -8rem; background: linear-gradient(135deg, rgb(var(--c-secondary) / .14), rgb(var(--c-primary) / .2)); animation: mesh-c 38s ease-in-out infinite; } @media (max-width: 640px) { .mesh-blob-a { width: 20rem; height: 20rem; left: -4rem; top: 6%; } .mesh-blob-b { width: 18rem; height: 18rem; right: -3rem; top: 14%; } .mesh-blob-c { width: 16rem; height: 16rem; left: 18%; bottom: -4rem; } } @keyframes mesh-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(5rem,3rem) scale(1.18); } } @keyframes mesh-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-4rem,2.5rem) scale(1.12); } } @keyframes mesh-c { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(3rem,-3rem) scale(1.2); } } @media (prefers-reduced-motion: reduce) { .mesh-blob { animation: none; } } `}</style>{' '}
        </div>
      )}{' '}
      <div
        ref={contentRef}
        className={cn(
          'relative z-10 w-full',
          contentPaddingX,
          contentAlign === 'left' ? 'text-left' : 'text-center',
          'mx-auto',
        )}
        style={{ maxWidth: contentMaxWidth }}
      >
        {' '}
        {puck.renderSlot('content')}{' '}
        {showTrustChips && (
          <div
            className={cn(
              'mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-4',
              contentAlign === 'left' ? 'sm:justify-start' : 'sm:justify-center',
            )}
          >
            {' '}
            <div className="flex -space-x-2.5" aria-hidden="true">
              {' '}
              <span className="inline-block h-9 w-9 rounded-full border-2 border-background bg-primary"></span>{' '}
              <span className="inline-block h-9 w-9 rounded-full border-2 border-background bg-secondary"></span>{' '}
              <span className="inline-block h-9 w-9 rounded-full border-2 border-background bg-accent"></span>{' '}
            </div>{' '}
            <span className="flex items-center gap-0.5" aria-hidden="true">
              {' '}
              {[0, 1, 2, 3, 4].map((i) => (
                <Icon key={i} name="star" className="size-[17px] text-warning" />
              ))}{' '}
            </span>{' '}
            {trustNoteHref ? (
              <a
                href={trustNoteHref}
                className="text-sm font-medium text-text-muted transition-colors hover:text-primary"
              >
                {' '}
                {trustNote}{' '}
              </a>
            ) : (
              <span className="text-sm font-medium text-text-muted">{trustNote}</span>
            )}{' '}
          </div>
        )}{' '}
      </div>{' '}
      {scrollIndicator && (
        <div
          className="absolute left-1/2 -translate-x-1/2 animate-bounce opacity-50 z-10"
          style={{ bottom: scrollIndicatorBottom }}
        >
          {' '}
          <Icon name="expand_more" />{' '}
        </div>
      )}{' '}
    </section>
  );
}
