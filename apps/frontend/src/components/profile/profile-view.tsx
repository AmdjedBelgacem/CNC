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
          <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="overview">{t('tabOverview')}</TabsTrigger>
              <TabsTrigger value="learning">
                {t('tabLearning')}
                {counts.learning > 0 && <span className="ms-1.5 tabular-nums">{counts.learning}</span>}
              </TabsTrigger>
              <TabsTrigger value="portfolio">
                {t('tabPortfolio')}
                {counts.portfolio > 0 && (
                  <span className="ms-1.5 tabular-nums">{counts.portfolio}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="activity">
                {t('tabActivity')}
                {counts.activity > 0 && (
                  <span className="ms-1.5 tabular-nums">{counts.activity}</span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
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
