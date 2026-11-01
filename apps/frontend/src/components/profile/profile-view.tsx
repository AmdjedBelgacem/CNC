'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileGlance, ProfileHero } from '@/components/profile/profile-hero';
import {
  ProfileLearning,
  ProfileOverview,
  ProfilePortfolio,
} from '@/components/profile/profile-sections';
import {
  ProfileActivity,
  ProfileConnectionsDialog,
  ProfileSuggestions,
} from '@/components/profile/profile-activity';
import { useProfileLearning } from '@/hooks/use-profile';
import { useAuthStore } from '@/stores/auth-store';
import type { Profile, ProfileLearningRecord } from '@/lib/api/types';
import { m } from 'framer-motion';
import { spring } from '@/lib/motion';

/**
 * Editorial tab bar: the shared Tabs keep their keyboard model and panels, but
 * the pill is swapped for a clay underline that glides between triggers.
 */
const TAB_LIST_CLASS =
  'h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-0 border-b border-border/70 bg-transparent p-0 sm:gap-8';
const TAB_TRIGGER_CLASS =
  'rounded-none px-0.5 pb-3 pt-1 text-sm data-[state=active]:bg-transparent data-[state=active]:shadow-none [&>span[aria-hidden]]:hidden';

function TabUnderline({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <m.span
      aria-hidden
      layoutId="profile-tab-underline"
      transition={spring.smooth}
      className="absolute inset-x-0 -bottom-[13px] h-0.5 rounded-full bg-primary"
    />
  );
}

function TabCount({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="ms-1.5 rounded-full bg-muted px-1.5 py-px text-2xs font-medium tabular-nums text-muted-foreground">
      {value}
    </span>
  );
}

type TabKey = 'overview' | 'learning' | 'portfolio' | 'activity';

/**
 * The tabbed profile. `profile` arrives server-rendered (so the hero, stats and
 * portfolio are in the first paint); the learning record and the connections
 * lists are fetched on demand because most visitors open a single tab.
 */
export function ProfileView({
  profile,
  learning: initialLearning,
}: {
  profile: Profile;
  learning?: ProfileLearningRecord;
}) {
  const t = useTranslations('profile');
  const [tab, setTab] = useState<TabKey>('overview');
  const [connections, setConnections] = useState<'followers' | 'following' | null>(null);
  const learning = useProfileLearning(profile.id, tab === 'learning');
  const viewerId = useAuthStore((s) => s.user?.id);

  const counts = {
    learning: profile.learning.enrollments,
    portfolio: profile.portfolioItems.length,
    activity: profile.stats.posts,
  };

  return (
    <>
      <ProfileHero profile={profile} onOpenConnections={setConnections} />

      <div className="px-margin-mobile md:px-margin-desktop mx-auto w-full max-w-container-max py-10 md:py-14">
        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className={TAB_LIST_CLASS}>
              <TabsTrigger value="overview" className={TAB_TRIGGER_CLASS}>
                {t('tabOverview')}
                <TabUnderline active={tab === 'overview'} />
              </TabsTrigger>
              <TabsTrigger value="learning" className={TAB_TRIGGER_CLASS}>
                {t('tabLearning')}
                <TabCount value={counts.learning} />
                <TabUnderline active={tab === 'learning'} />
              </TabsTrigger>
              <TabsTrigger value="portfolio" className={TAB_TRIGGER_CLASS}>
                {t('tabPortfolio')}
                <TabCount value={counts.portfolio} />
                <TabUnderline active={tab === 'portfolio'} />
              </TabsTrigger>
              <TabsTrigger value="activity" className={TAB_TRIGGER_CLASS}>
                {t('tabActivity')}
                <TabCount value={counts.activity} />
                <TabUnderline active={tab === 'activity'} />
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
            <div className="min-w-0">
              <TabsContent value="overview" className="pb-6">
                <ProfileOverview profile={profile} />
              </TabsContent>

              <TabsContent value="learning" className="pb-6">
                <ProfileLearning
                  enrollments={learning.data?.enrollments ?? initialLearning?.enrollments ?? []}
                  certificates={learning.data?.certificates ?? initialLearning?.certificates ?? []}
                  loading={learning.isLoading && !initialLearning}
                  error={learning.isError && !initialLearning}
                  onRetry={() => void learning.refetch()}
                />
              </TabsContent>

              <TabsContent value="portfolio" className="pb-6">
                <ProfilePortfolio profile={profile} />
              </TabsContent>

              <TabsContent value="activity" className="pb-6">
                <div id="activity" className="scroll-mt-24">
                  <ProfileActivity profile={profile} />
                </div>
              </TabsContent>
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <ProfileGlance profile={profile} />
            </aside>
          </div>

          <ProfileSuggestions viewerId={viewerId} />
        </Tabs>
      </div>

      <ProfileConnectionsDialog
        profile={profile}
        kind={connections}
        onOpenChange={setConnections}
      />
    </>
  );
}
