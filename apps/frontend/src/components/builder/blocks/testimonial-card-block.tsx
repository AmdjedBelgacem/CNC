import type { TestimonialCardProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

/** Review card: star rating, italic quote, reviewer identity row. */
export function TestimonialCardBlock({ props }: BlockComponentProps<TestimonialCardProps>) {
  const { className, quote = '', name = '', role, avatarUrl, rating = 5 } = props;
  const stars = Math.max(0, Math.min(5, rating ?? 5));
  return (
    <figure
      className={cn(
        'liquid-glass p-8 rounded-2xl flex flex-col justify-between hover:shadow-xl transition-shadow h-full',
        className,
      )}
      style={layoutStyle(props)}
    >
      <div>
        {stars > 0 ? (
          <div className="flex items-center gap-1 text-warning mb-4" aria-label={`${stars} out of 5 stars`}>
            {Array.from({ length: stars }).map((_, i) => (
              <Icon key={i} name="star" className="size-4 fill-current" />
            ))}
          </div>
        ) : null}
        <blockquote className="text-text-primary text-base sm:text-lg leading-relaxed italic mb-6">
          {quote}
        </blockquote>
      </div>
      <figcaption className="flex items-center gap-4 pt-4 border-t border-glass-border">
        <div className="size-12 rounded-full overflow-hidden bg-surface-container-low shadow-sm shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              className="w-full h-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="text-base font-bold text-text-primary">{name}</div>
          {role ? <div className="text-xs text-text-muted">{role}</div> : null}
        </div>
      </figcaption>
    </figure>
  );
}
