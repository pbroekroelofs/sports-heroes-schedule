import axios from 'axios';
import type { SportEvent } from '../types/events';

interface OpenF1Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  gp_name: string;
  location: string;
  country_name: string;
  year: number;
}

// Show Race, Qualifying, and Sprint — skip practice sessions
const RELEVANT_TYPES = new Set(['Race', 'Qualifying', 'Sprint', 'Sprint Qualifying', 'Sprint Shootout']);

export async function fetchF1Events(): Promise<SportEvent[]> {
  const currentYear = new Date().getFullYear();
  // Fetch current and next year so the schedule is never empty near year-end
  const years = [currentYear, currentYear + 1];
  const events: SportEvent[] = [];

  for (const year of years) {
    try {
      const { data } = await axios.get<OpenF1Session[]>(
        `https://api.openf1.org/v1/sessions?year=${year}`,
        { timeout: 10_000 }
      );

      const relevant = data.filter((s) => RELEVANT_TYPES.has(s.session_type));

      for (const session of relevant) {
        events.push({
          id: `f1_${session.session_key}`,
          sport: 'f1',
          title: `${session.gp_name} – ${session.session_name}`,
          competition: 'Formula 1',
          startTime: session.date_start,
          endTime: session.date_end,
          location: `${session.location}, ${session.country_name}`,
          fetchedAt: new Date().toISOString(),
          sourceUrl: 'https://www.formula1.com/en/racing.html',
        });
      }
    } catch (err) {
      console.error(`[F1] Failed to fetch sessions for ${year}:`, err);
    }
  }

  console.log(`[F1] Fetched ${events.length} events`);
  return events;
}
