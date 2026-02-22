import axios from 'axios';
import type { SportEvent, SportCategory } from '../types/events';

interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  competition: { name: string; code: string };
  venue?: string;
}

interface FDResponse {
  matches: FDMatch[];
}

const BASE_URL = 'https://api.football-data.org/v4';
const FINISHED = new Set(['FINISHED', 'CANCELLED', 'POSTPONED', 'SUSPENDED', 'AWARDED']);

async function fetchTeamEvents(teamId: number, sport: SportCategory): Promise<SportEvent[]> {
  const apiKey = (process.env.FOOTBALL_DATA_API_KEY ?? '').trim();
  if (!apiKey) {
    console.warn(`[Football/${sport}] FOOTBALL_DATA_API_KEY not set — skipping`);
    return [];
  }

  const now = new Date();
  const future = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 6 months ahead

  try {
    const { data } = await axios.get<FDResponse>(
      `${BASE_URL}/teams/${teamId}/matches`,
      {
        headers: { 'X-Auth-Token': apiKey },
        params: {
          dateFrom: now.toISOString().slice(0, 10),
          dateTo: future.toISOString().slice(0, 10),
          limit: 30,
        },
        timeout: 10_000,
      }
    );

    const events: SportEvent[] = data.matches
      .filter((m) => !FINISHED.has(m.status))
      .map((match) => ({
        id: `${sport}_${match.id}`,
        sport,
        title: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
        competition: match.competition.name,
        startTime: match.utcDate,
        location: match.venue,
        fetchedAt: new Date().toISOString(),
        sourceUrl: 'https://www.football-data.org',
      }));

    console.log(`[Football/${sport}] Fetched ${events.length} upcoming matches`);
    return events;
  } catch (err) {
    console.error(`[Football/${sport}] Failed to fetch matches:`, err);
    return [];
  }
}

export function fetchAjaxEvents(): Promise<SportEvent[]> {
  return fetchTeamEvents(678, 'ajax');
}

export function fetchAZEvents(): Promise<SportEvent[]> {
  return fetchTeamEvents(682, 'az');
}
