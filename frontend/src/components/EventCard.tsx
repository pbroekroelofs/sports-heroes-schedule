'use client';

import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { SportEvent } from '@/types/events';
import { SPORT_LABELS, SPORT_COLORS } from '@/types/events';

interface Props {
  event: SportEvent;
  timezone: string;
}

export default function EventCard({ event, timezone }: Props) {
  const colors = SPORT_COLORS[event.sport];
  const zonedStart = toZonedTime(new Date(event.startTime), timezone);
  const timeStr = format(zonedStart, 'HH:mm');
  const isToday =
    format(zonedStart, 'yyyy-MM-dd') === format(toZonedTime(new Date(), timezone), 'yyyy-MM-dd');

  return (
    <a
      href={event.sourceUrl ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex gap-3 bg-slate-800 rounded-xl p-4 border-l-4 ${colors.border} hover:bg-slate-700 transition-colors active:scale-[0.98]`}
    >
      {/* Time column */}
      <div className="flex flex-col items-center justify-center min-w-[52px]">
        <span className={`text-xl font-bold tabular-nums ${isToday ? 'text-white' : 'text-slate-300'}`}>
          {timeStr}
        </span>
        <span className="text-xs text-slate-500 uppercase tracking-wide">
          {timezone === 'Europe/Amsterdam' ? 'CET' : 'local'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold leading-snug">{event.title}</p>
        {event.competition !== SPORT_LABELS[event.sport] && (
          <p className="text-slate-400 text-sm mt-0.5">{event.competition}</p>
        )}
        {event.location && (
          <p className="text-slate-500 text-xs mt-1">📍 {event.location}</p>
        )}
      </div>

      {/* Sport badge */}
      <div className="flex items-start">
        <span
          className={`${colors.badge} text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded whitespace-nowrap`}
        >
          {SPORT_LABELS[event.sport]}
        </span>
      </div>
    </a>
  );
}
