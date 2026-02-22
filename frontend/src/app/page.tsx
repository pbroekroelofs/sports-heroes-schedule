'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import useSWR from 'swr';
import { useAuth } from './providers';
import { fetchEvents, fetchPreferences } from '@/lib/api';
import DaySection from '@/components/DaySection';
import type { SportEvent, UserPreferences } from '@/types/events';

const DEFAULT_PREFS: UserPreferences = {
  sports: ['f1', 'ajax', 'az', 'mvdp_road', 'mvdp_cx', 'mvdp_mtb', 'pp_road', 'pp_cx'],
  timezone: 'Europe/Amsterdam',
};

function groupByDay(events: SportEvent[], timezone: string): Map<string, SportEvent[]> {
  const map = new Map<string, SportEvent[]>();
  for (const event of events) {
    const zonedDate = toZonedTime(new Date(event.startTime), timezone);
    const key = format(zonedDate, 'yyyy-MM-dd');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(event);
  }
  return map;
}

export default function SchedulePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  const { data: prefs } = useSWR(
    user ? 'preferences' : null,
    fetchPreferences,
    { fallbackData: DEFAULT_PREFS, revalidateOnFocus: false }
  );

  const { data: events, error, isLoading } = useSWR<SportEvent[]>(
    user ? 'events' : null,
    () => fetchEvents(),
    { revalidateOnFocus: true, revalidateOnReconnect: true }
  );

  const filtered = useMemo(() => {
    if (!events || !prefs) return [];
    return events.filter((e) => prefs.sports.includes(e.sport));
  }, [events, prefs]);

  const grouped = useMemo(
    () => groupByDay(filtered, prefs?.timezone ?? 'Europe/Amsterdam'),
    [filtered, prefs]
  );

  if (loading || (!user && !error)) {
    return <LoadingState />;
  }

  if (isLoading) return <LoadingState />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p className="text-lg mb-2">Failed to load events</p>
        <p className="text-sm">Check your connection and try again</p>
      </div>
    );
  }

  if (grouped.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 px-6 text-center">
        <p className="text-4xl mb-4">📭</p>
        <p className="text-lg font-semibold mb-2">No upcoming events</p>
        <p className="text-sm">
          Check your sport selections in{' '}
          <button onClick={() => router.push('/settings')} className="text-sky-400 underline">
            Settings
          </button>
        </p>
      </div>
    );
  }

  const timezone = prefs?.timezone ?? 'Europe/Amsterdam';

  return (
    <div className="px-4 py-5 max-w-xl mx-auto">
      {[...grouped.entries()].map(([dateKey, dayEvents]) => (
        <DaySection key={dateKey} dateKey={dateKey} events={dayEvents} timezone={timezone} />
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="px-4 py-5 max-w-xl mx-auto space-y-6">
      {[1, 2, 3].map((day) => (
        <div key={day}>
          <div className="h-3 bg-slate-800 rounded w-24 mb-3 animate-pulse" />
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
