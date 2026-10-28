import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { ClosingCtaActionProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

/** Shared primary/secondary link used by the closing CTA and its child button. */
export function ClosingCtaActionLink({
  label,
  href,
  variant = 'primary',
  icon,
  className,
  style,
}: {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
  icon?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const isPrimary = variant === 'primary';
  const external = href.startsWith('#') || href.startsWith('http');
  const cls = cn(
    isPrimary
      ? 'inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 font-medium text-primary-foreground transition hover:opacity-90'
      : 'inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/20 px-6 font-medium text-white transition hover:bg-white/10',
    className,
  );
  const content = (
    <>
      {icon ? <Icon name={icon} className="size-4" /> : null}
      {label}
    </>
  );
  if (external) {
    return (
      <a href={href} className={cls} style={style}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} style={style}>
      {content}
    </Link>
  );
}

/** One action button in a closing CTA band. */
export function ClosingCtaActionBlock({ props }: BlockComponentProps<ClosingCtaActionProps>) {
  const { label, href, variant = 'primary', icon, className } = props;
  return (
    <ClosingCtaActionLink
      label={label}
      href={href}
      variant={variant}
      icon={icon}
      className={className}
      style={layoutStyle(props)}
    />
  );
}
