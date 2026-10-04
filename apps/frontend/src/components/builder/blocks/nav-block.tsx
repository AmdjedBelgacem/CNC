'use client';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { NavProps, PuckNode } from '@titan/shared';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { layoutStyle } from '@/components/builder/layout-style';
import { BuilderNode } from '@/components/builder/block-renderer';
import { UserNavMenu } from './user-nav-menu';
import type { BlockComponentProps } from './index'; /** * Floating glass navbar; shrinks slightly once the page is scrolled. * * The nav content comes from the builder layout (logo, links, actions), but * the actions are auth-aware: while signed in the "Get Started" CTA is swapped * for the account menu and "Sign In" is hidden. On the public site the renderer * exposes slot data so we can intercept those nodes; inside the Puck editor the * bridge only offers `renderSlot`, so the raw seeded content is shown. */
export function NavBlock({ props, puck }: BlockComponentProps<NavProps>) {
  const {
    className,
    topOffset = 16,
    widthPercent = 95,
    containerMaxWidth = 1280,
    containerPaddingX = 'px-6 md:px-8',
    containerPaddingY = 'py-2.5',
    containerRadius = 'rounded-2xl',
  } = props;
  const [scaled, setScaled] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useEffect(() => {
    const onScroll = () => setScaled(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const slotData = puck.getSlotData?.('content') ?? [];
  const authed = hydrated && isAuthenticated;
  const intercept = (node: PuckNode): ReactNode | undefined => {
    const href = (node.props?.href as string | undefined) ?? '';
    if (node.type === 'button' && href === '/register') {
      return authed ? <UserNavMenu key={(node.props?.id as string) ?? 'account'} /> : undefined;
    }
    if (node.type === 'link' && href === '/login') {
      return authed ? null : undefined;
    }
    return undefined;
  };
  return (
    <header
      className={cn(
        'fixed left-1/2 -translate-x-1/2 z-50 transition-transform duration-300',
        scaled && 'scale-95',
        className,
      )}
      style={{
        ...layoutStyle(props),
        top: topOffset,
        width: `${widthPercent}%`,
        maxWidth: containerMaxWidth,
      }}
    >
      {' '}
      <div
        className={cn(
          'bg-card border border-border flex justify-between items-center',
          containerPaddingX,
          containerPaddingY,
          containerRadius,
        )}
      >
        {' '}
        {slotData.length > 0
          ? slotData.map((node, index) => (
              <BuilderNode
                key={(node.props?.id as string | undefined) ?? index}
                node={node}
                intercept={intercept}
              />
            ))
          : puck.renderSlot('content')}{' '}
      </div>{' '}
    </header>
  );
}
