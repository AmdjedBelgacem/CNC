'use client';
import type { ReactNode } from 'react';
import type {
  AcademyGridProps,
  CatalogHeroProps,
  CatalogHeroStat,
  CtaSignupProps,
  PageLayout,
  PartnerLogosProps,
  ProgramCardProps,
  ProgramCardsProps,
  PuckNode,
} from '@titan/shared';
import { getSlotChildren, mergeBlockProps } from '@titan/shared';
import { BuilderNode } from '@/components/builder/block-renderer';
import { AcademyGridBlock } from '@/components/builder/blocks/academy-grid-block';
import { CatalogHeroBlock } from '@/components/builder/blocks/catalog-hero-block';
import { ProgramCardsBlock } from '@/components/builder/blocks/program-cards-block';
import { ProgramCardBlock } from '@/components/builder/blocks/program-card-block';
import { PartnerLogosBlock } from '@/components/builder/blocks/partner-logos-block';
import { LogoItemBlock } from '@/components/builder/blocks/logo-item-block';
import { CtaSignupBlock } from '@/components/builder/blocks/cta-signup-block';
import type { PuckBridge } from '@/components/builder/blocks';
import { AcademyCard } from '@/components/academy/academy-card';
import type { AcademySummary } from '@/lib/academies';
import type { CourseListItem } from '@/lib/courses';
import type { Sponsor } from '@/lib/sponsors';
import { getImageSrc } from '@/lib/images';

const noopPuck: PuckBridge = { renderSlot: () => null, getSlotData: () => [] };

function courseLevel(difficulty: number): { level: string; levelTone: 'primary' | 'secondary' | 'accent' } {
  if (difficulty <= 1) return { level: 'BEGINNER', levelTone: 'primary' };
  if (difficulty <= 3) return { level: 'INTERMEDIATE', levelTone: 'secondary' };
  return { level: 'ADVANCED', levelTone: 'accent' };
}

function courseToCardProps(course: CourseListItem): ProgramCardProps {
  const { level, levelTone } = courseLevel(course.difficulty);
  const tags = course.metadata?.tags?.filter(Boolean).join(', ') || undefined;
  return {
    id: `course-card-${course.id}`,
    level,
    levelTone,
    duration: course.estimatedHours ? `${course.estimatedHours} Hrs` : undefined,
    metaLabel: course.academy?.title || 'Published Course',
    title: course.title,
    description: course.description || course.subtitle || undefined,
    tags,
    imageUrl: getImageSrc(course.thumbnailUrl, 'course'),
    imageAlt: course.title,
    ctaLabel: 'View Course',
    href: `/courses/${course.slug}`,
  };
}

/**
 * Marketing page renderer: identical to BlockRenderer except
 *  - every `academy-grid` node is substituted with live tenant data,
 *  - every `program-cards` node is substituted with live published courses,
 *  - every `partner-logos` / `cta-signup` node is rebuilt from
 *    live catalog counts (seed mock metrics never reach visitors),
 *  - `stats` values are baked into the layout server-side (applyLiveHomeMetrics)
 *    so SSR and hydration render the same seedStatCard tree,
 *  - every `live-island` node is swapped for the React island whose `variant`
 *    matches a key in `islands`,
 *  - any node whose `props.id` matches a key in `replacements` is swapped for
 *    a live interactive island,
 *  - `catalog-hero` stats can be overridden with live counters via `heroStats`,
 *  - seed testimonials (no public API) are dropped.
 * Static seed cards can therefore never reach visitors — the block renders DB
 * rows in place (preserving page order) or disappears when nothing is published.
 */
export function HomeBuilder({
  layout,
  academies = [],
  academyLimit,
  hideEmptyAcademies = true,
  courses = [],
  sponsors = [],
  replacements,
  islands,
  heroStats,
}: {
  layout: PageLayout;
  academies?: AcademySummary[];
  academyLimit?: number;
  hideEmptyAcademies?: boolean;
  /** Live published courses substituted into every `program-cards` grid. */
  courses?: CourseListItem[];
  /** Live sponsors substituted into every `partner-logos` wall. */
  sponsors?: Sponsor[];
  /** Live islands keyed by node `props.id` — substituted before normal rendering. */
  replacements?: Record<string, ReactNode>;
  /** Live islands keyed by `live-island` `props.variant`. */
  islands?: Record<string, ReactNode>;
  /** Live stats injected into every `catalog-hero` node (public site only). */
  heroStats?: CatalogHeroStat[];
}) {
  const nodes = layout.content ?? [];
  const zones = (layout as { zones?: Record<string, PuckNode[]> }).zones ?? {};
  if (!nodes.length) return null;

  const intercept = (node: PuckNode): ReactNode | null | undefined => {
    const nodeId = node.props?.id as string | undefined;
    if (nodeId && replacements && Object.prototype.hasOwnProperty.call(replacements, nodeId)) {
      return replacements[nodeId];
    }
    if (node.type === 'live-island') {
      const variant = node.props?.variant as string | undefined;
      if (variant && islands && Object.prototype.hasOwnProperty.call(islands, variant)) {
        return islands[variant];
      }
      return undefined;
    }
    // Fake social proof has no public API — never render seed testimonials.
    if (node.type === 'testimonials' || node.type === 'testimonial-card') return null;
    if (node.type === 'catalog-hero') {
      const props = mergeBlockProps(node.type, node.props) as unknown as CatalogHeroProps;
      const withStats: CatalogHeroProps = heroStats ? { ...props, stats: heroStats } : props;
      return <CatalogHeroBlock props={withStats} puck={noopPuck} />;
    }
    if (node.type === 'cta-signup') {
      // Pill/subtitle are baked into the layout server-side (applyLiveHomeMetrics).
      const props = mergeBlockProps(node.type, node.props) as unknown as CtaSignupProps;
      return <CtaSignupBlock props={props} puck={noopPuck} />;
    }
    if (node.type === 'partner-logos') {
      if (sponsors.length === 0) return null;
      const props = mergeBlockProps(node.type, node.props) as unknown as PartnerLogosProps;
      const nodeWithDefaults: PuckNode = {
        type: node.type,
        props: props as unknown as Record<string, unknown>,
      };
      const renderBuilderSlot = (slot: string) =>
        getSlotChildren(nodeWithDefaults, slot, zones).map((child, index) => (
          <BuilderNode
            key={(child.props?.id as string | undefined) ?? index}
            node={child}
            zones={zones}
            intercept={intercept}
          />
        ));
      const visible = sponsors.slice(0, 8);
      const puck: PuckBridge = {
        renderSlot: (slot) => {
          if (slot !== 'logos') return renderBuilderSlot(slot);
          return visible.map((sponsor) => (
            <LogoItemBlock
              key={sponsor.id}
              props={{ className: 'hover:scale-100' }}
              puck={{
                renderSlot: () => (
                  <span className="font-mono font-bold tracking-tight text-text-primary opacity-70 hover:opacity-100 transition-opacity text-sm sm:text-base">
                    {sponsor.name}
                  </span>
                ),
                getSlotData: () => [],
              }}
            />
          ));
        },
        getSlotData: (slot) =>
          slot === 'logos' ? [] : getSlotChildren(nodeWithDefaults, slot, zones),
      };
      return <PartnerLogosBlock props={props} puck={puck} />;
    }
    if (node.type === 'program-cards') {
      if (courses.length === 0) return null;
      const props = mergeBlockProps(node.type, node.props) as unknown as ProgramCardsProps;
      const nodeWithDefaults: PuckNode = {
        type: node.type,
        props: props as unknown as Record<string, unknown>,
      };
      const renderBuilderSlot = (slot: string) =>
        getSlotChildren(nodeWithDefaults, slot, zones).map((child, index) => (
          <BuilderNode
            key={(child.props?.id as string | undefined) ?? index}
            node={child}
            zones={zones}
            intercept={intercept}
          />
        ));
      const puck: PuckBridge = {
        renderSlot: (slot) => {
          if (slot !== 'cards') return renderBuilderSlot(slot);
          return courses.map((course) => (
            <ProgramCardBlock
              key={course.id}
              props={courseToCardProps(course)}
              puck={noopPuck}
            />
          ));
        },
        getSlotData: (slot) =>
          slot === 'cards' ? [] : getSlotChildren(nodeWithDefaults, slot, zones),
      };
      return <ProgramCardsBlock props={props} puck={puck} />;
    }
    if (node.type !== 'academy-grid') return undefined;
    if (academies.length === 0 && hideEmptyAcademies) return null;

    const props = mergeBlockProps(node.type, node.props) as unknown as AcademyGridProps;
    const nodeWithDefaults: PuckNode = {
      type: node.type,
      props: props as unknown as Record<string, unknown>,
    };
    const visibleAcademies = academyLimit ? academies.slice(0, academyLimit) : academies;
    const renderBuilderSlot = (slot: string) =>
      getSlotChildren(nodeWithDefaults, slot, zones).map((child, index) => (
        <BuilderNode
          key={(child.props?.id as string | undefined) ?? index}
          node={child}
          zones={zones}
          intercept={intercept}
        />
      ));
    const puck: PuckBridge = {
      renderSlot: (slot) => {
        if (slot !== 'cards') return renderBuilderSlot(slot);
        if (visibleAcademies.length === 0) {
          return (
            <div className="col-span-full rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
              <p className="font-semibold text-foreground">No academies published yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Published academies will appear here automatically.
              </p>
            </div>
          );
        }
        return visibleAcademies.map((academy) => (
          <AcademyCard key={academy.id} academy={academy} />
        ));
      },
      getSlotData: (slot) => getSlotChildren(nodeWithDefaults, slot, zones),
    };

    return <AcademyGridBlock props={props} puck={puck} />;
  };
  return (
    <div>
      {nodes.map((node, index) => (
        <BuilderNode
          key={(node.props?.id as string | undefined) ?? index}
          node={node}
          zones={zones}
          intercept={intercept}
        />
      ))}
    </div>
  );
}
