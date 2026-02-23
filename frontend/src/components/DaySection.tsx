'use client';

import { format, isToday, isTomorrow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import EventCard from './EventCard';
import type { SportEvent } from '@/types/events';

interface Props {
  dateKey: string; // 'yyyy-MM-dd'
  events: SportEvent[];
  timezone: string;
}

function formatDayHeading(dateKey: string, timezone: string): string {
  const date = toZonedTime(new Date(dateKey + 'T12:00:00Z'), timezone);
  if (isToday(date)) return 'Vandaag';
  if (isTomorrow(date)) return 'Morgen';
  return format(date, 'EEEE d MMMM', { locale: nl }); // e.g. "zondag 9 maart"
}

export default function DaySection({ dateKey, events, timezone }: Props) {
  const heading = formatDayHeading(dateKey, timezone);
  const isCurrentDay = heading === 'Vandaag';

  return (
    <section className="mb-6">
      <h2
        className={`text-xs font-bold uppercase tracking-widest mb-3 px-1 ${
          isCurrentDay ? 'text-sky-400' : 'text-slate-500'
        }`}
      >
        {heading}
      </h2>
      <div className="flex flex-col gap-2">
        {events.map((event) => (
          <EventCard key={event.id} event={event} timezone={timezone} />
        ))}
      </div>
    </section>
  );
}
