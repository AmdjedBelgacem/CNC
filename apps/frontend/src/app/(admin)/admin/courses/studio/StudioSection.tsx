'use client';

import { useId, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { EditorSection } from '@/components/admin/editor/editor-kit';

/**
 * The editor kit's section card with the props the studio steps were written
 * against (`FormSection`'s description, icon and badge), so a step moves onto the
 * shared shell without rewriting its body.
 */
export function StudioSection({
  id,
  title,
  description,
  icon: Icon,
  badge,
  actions,
  children,
  className,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Accepted for compatibility with `FormSection`; the section already pads its body. */
  bodyClassName?: string;
}) {
  const fallbackId = useId().replace(/:/g, '');
  return (
    <EditorSection
      id={id ?? `studio-${fallbackId}`}
      className={className}
      title={
        <span className="flex items-center gap-2">
          {Icon && <Icon className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />}
          {title}
        </span>
      }
      hint={badge}
      actions={actions}
    >
      {description && <p className="-mt-3 text-13 leading-relaxed text-muted-foreground">{description}</p>}
      {children}
    </EditorSection>
  );
}
