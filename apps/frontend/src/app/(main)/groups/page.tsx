'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Users, Calendar, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full rounded-xl" />,
});
interface StudyGroup {
  id: string;
  name: string;
  description: string | null;
  academy: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  meetingSchedule: string | null;
  memberCount: number;
  maxMembers: number;
  isActive: boolean;
  coverUrl: string | null;
}
export default function GroupsPage() {
  const [activeAcademy, setActiveAcademy] = useState('All');
  // Filter options are derived from real row values (study_groups.academy is a
  // legacy taxonomy key, not an academy slug — see study-groups.service).
  const { data: allData } = useQuery<{ data: StudyGroup[] }>({
    queryKey: ['study-groups', 'all-for-filter'],
    queryFn: () =>
      fetch(`/api/proxy/social/groups`, { credentials: 'include' }).then((r) => r.json()),
    retry: 2,
  });
  const academies = [
    'All',
    ...Array.from(
      new Set(
        (allData?.data || [])
          .map((g) => g.academy)
          .filter((a): a is string => !!a),
      ),
    ),
  ];
  const { data, isLoading, error } = useQuery<{ data: StudyGroup[] }>({
    queryKey: ['study-groups', activeAcademy],
    queryFn: () =>
      fetch(
        `/api/proxy/social/groups?academy=${activeAcademy === 'All' ? '' : encodeURIComponent(activeAcademy)}`,
        { credentials: 'include' },
      ).then((r) => r.json()),
    retry: 2,
  });
  const groups = data?.data || [];
  const locations = groups
    .filter((g) => g.lat && g.lng)
    .map((g) => ({ lat: g.lat!, lng: g.lng!, name: g.name, city: g.city, state: g.state }));
  return (
    <div>
      {' '}
      <section className="border-b bg-gradient-to-b from-background to-secondary/20 py-20 text-center">
        {' '}
        <div className="container mx-auto px-4">
          {' '}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">Study Groups</h1>{' '}
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            {' '}
            Learn together. Connect with CNC machinists in your area for hands-on study
            sessions.{' '}
          </p>{' '}
          <Button>
            {' '}
            <Plus className="mr-2 h-4 w-4" /> Start a Group{' '}
          </Button>{' '}
        </div>{' '}
      </section>{' '}
      <section className="py-8 border-b">
        {' '}
        <div className="container mx-auto px-4">
          {' '}
          <MapView locations={locations} />{' '}
        </div>{' '}
      </section>{' '}
      <section className="py-8">
        {' '}
        <div className="container mx-auto px-4">
          {' '}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {' '}
            {academies.map((a) => (
              <button
                key={a}
                onClick={() => setActiveAcademy(a)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${activeAcademy === a ? 'bg-primary text-primary-foreground border-primary' : 'hover:border-primary/50'}`}
              >
                {' '}
                {a}{' '}
              </button>
            ))}{' '}
          </div>{' '}
          {isLoading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {' '}
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}{' '}
            </div>
          )}{' '}
          {error && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              {' '}
              <p className="text-muted-foreground">
                Unable to load study groups. Make sure the backend is running.
              </p>{' '}
            </div>
          )}{' '}
          {!isLoading && !error && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              {' '}
              <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />{' '}
              <h3 className="text-lg font-semibold">No study groups yet</h3>{' '}
              <p className="text-sm text-muted-foreground mt-1">
                Be the first to start a group in your area.
              </p>{' '}
            </div>
          )}{' '}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {' '}
            {groups.map((g) => (
              <div
                key={g.id}
                className="rounded-xl border bg-card p-6 transition-all hover:shadow-lg"
              >
                {' '}
                {g.academy && (
                  <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary mb-3">
                    {' '}
                    {g.academy}{' '}
                  </span>
                )}{' '}
                <h3 className="text-lg font-bold">{g.name}</h3>{' '}
                {g.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{g.description}</p>
                )}{' '}
                <div className="flex flex-wrap gap-3 mt-4 text-sm text-muted-foreground">
                  {' '}
                  {(g.city || g.state) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />{' '}
                      {[g.city, g.state].filter(Boolean).join(', ')}
                    </span>
                  )}{' '}
                  {g.meetingSchedule && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> {g.meetingSchedule}
                    </span>
                  )}{' '}
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {g.memberCount}/{g.maxMembers}
                  </span>{' '}
                </div>{' '}
              </div>
            ))}{' '}
          </div>{' '}
        </div>{' '}
      </section>{' '}
    </div>
  );
}
