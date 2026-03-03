/**
 * F1 schedule fetcher — uses the Jolpica API (maintained Ergast fork).
 *
 * GET https://api.jolpi.ca/ergast/f1/{year}/races.json?limit=50
 *
 * Each race object includes session dates for Qualifying, Sprint, and Race.
 * Practice sessions are intentionally excluded.
 */
import axios from 'axios';
import { v5 as uuidv5 } from 'uuid';
import type { SportEvent } from '../types/events';

const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';

// ─── API types ────────────────────────────────────────────────────────────────

interface JolpicaSession {
  date: string;   // "2026-03-15"
  time?: string;  // "05:00:00Z"
}

interface JolpicaRace {
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: {
    circuitName: string;
    Location: { locality: string; country: string };
  };
  Qualifying?: JolpicaSession;
  Sprint?: JolpicaSession;
  SprintQualifying?: JolpicaSession;
  SprintShootout?: JolpicaSession;
}

interface JolpicaResponse {
  MRData: { RaceTable: { Races: JolpicaRace[] } };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(date: string, time?: string): string {
  return time ? `${date}T${time}` : `${date}T00:00:00Z`;
}

async function fetchYear(year: number): Promise<SportEvent[]> {
  try {
    const { data } = await axios.get<JolpicaResponse>(
      `${JOLPICA_BASE}/${year}/races.json`,
      { params: { limit: 50 }, timeout: 15_000 },
    );

    const races = data.MRData?.RaceTable?.Races ?? [];
    const now = new Date();
    const events: SportEvent[] = [];

    for (const race of races) {
      const location = `${race.Circuit.Location.locality}, ${race.Circuit.Location.country}`;

      const push = (sessionName: string, session: JolpicaSession) => {
        const startTime = toISO(session.date, session.time);
        if (new Date(startTime) < now) return;
        const id = uuidv5(`f1_${year}_${race.round}_${sessionName}`, UUID_NAMESPACE);
        events.push({
          id,
          sport: 'f1',
          title: `${race.raceName} \u2013 ${sessionName}`,
          competition: race.raceName,
          startTime,
          location,
          fetchedAt: new Date().toISOString(),
          sourceUrl: 'https://www.formula1.com/en/racing.html',
        });
      };

      if (race.Qualifying)      push('Qualifying',         race.Qualifying);
      if (race.SprintQualifying) push('Sprint Qualifying',  race.SprintQualifying);
      if (race.SprintShootout)  push('Sprint Shootout',    race.SprintShootout);
      if (race.Sprint)          push('Sprint',             race.Sprint);
      push('Race', { date: race.date, time: race.time });
    }

    return events;
  } catch (err) {
    console.error(`[F1] Failed to fetch ${year} schedule:`, err);
    return [];
  }
}

// ─── Public export ────────────────────────────────────────────────────────────

export async function fetchF1Events(): Promise<SportEvent[]> {
  const now = new Date();
  const year = now.getUTCFullYear();
  // Fetch next year too in Nov/Dec when the new calendar is already published
  const years = now.getUTCMonth() >= 10 ? [year, year + 1] : [year];

  const results = await Promise.all(years.map(fetchYear));
  const events = results.flat();
  console.log(`[F1] Fetched ${events.length} upcoming events`);
  return events;
}
