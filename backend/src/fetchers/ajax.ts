import axios from 'axios';
import type { SportEvent } from '../types/events';

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

const AJAX_TEAM_ID = 678;
const BASE_URL = 'https://api.football-data.org/v4';

export async function fetchAjaxEvents(): Promise<SportEvent[]> {
  const apiKey = (process.env.FOOTBALL_DATA_API_KEY ?? '').trim();
  if (!apiKey) {
    console.warn('[Ajax] FOOTBALL_DATA_API_KEY not set — skipping Ajax events');
    return [];
  }

  const now = new Date();
  const future = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 6 months ahead

  try {
    // football-data.org v4: use dateFrom/dateTo instead of status filter
    const { data } = await axios.get<FDResponse>(
      `${BASE_URL}/teams/${AJAX_TEAM_ID}/matches`,
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

    // Only show unplayed matches
    const upcoming = data.matches.filter(
      (m) => !['FINISHED', 'CANCELLED', 'POSTPONED', 'SUSPENDED', 'AWARDED'].includes(m.status)
    );

    const events: SportEvent[] = upcoming.map((match) => ({
      id: `ajax_${match.id}`,
      sport: 'ajax',
      title: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      competition: match.competition.name,
      startTime: match.utcDate,
      location: match.venue,
      fetchedAt: new Date().toISOString(),
      sourceUrl: 'https://www.ajax.nl/en/matches',
    }));

    console.log(`[Ajax] Fetched ${events.length} upcoming matches`);
    return events;
  } catch (err) {
    console.error('[Ajax] Failed to fetch matches:', err);
    return [];
  }
}
