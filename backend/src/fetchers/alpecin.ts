/**
 * Alpecin-Premier Tech team calendar fetcher.
 *
 * Calls the team's own JSON API directly:
 *   GET /calendar/events.php?year=YYYY&month=M
 *
 * The calendar shows all Alpecin-Premier Tech team entries (men's team only).
 * Used in cron.ts as a fallback for MvdP when PCS (procyclingstats.com) is
 * unavailable. Primary source for MvdP is PCS (rider-specific schedule).
 *
 * No ZenRows / JS rendering needed — the API is a plain JSON endpoint.
 */
import axios from 'axios';
import { v5 as uuidv5 } from 'uuid';
import type { SportEvent, SportCategory } from '../types/events';

const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const API_BASE = 'https://www.alpecin-premiertech.com/calendar/events.php';

// ─── API types ────────────────────────────────────────────────────────────────

interface AlpecinApiEvent {
  id: string;
  name: string;
  location: string;
  category: string;
  championship: string;
  date_start: string;   // "2026-03-07"
  date_end: string | null;
  discipline_slug: string;  // "wt" | "cc" | "mt" | "dv"
  discipline_name: string;
  discipline_color: string;
  iso2: string;
  country_name: string;
  flag_url: string;
  date_label: string;
}

interface AlpecinApiResponse {
  events: AlpecinApiEvent[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function disciplineToCategory(slug: string): 'road' | 'cx' | 'mtb' {
  if (slug === 'cc') return 'cx';
  if (slug === 'mt') return 'mtb';
  return 'road';
}

async function fetchMonth(year: number, month: number): Promise<AlpecinApiEvent[]> {
  try {
    const { data } = await axios.get<AlpecinApiResponse>(API_BASE, {
      params: { year, month },
      headers: { Accept: 'application/json' },
      timeout: 15_000,
    });
    return data.events ?? [];
  } catch (err) {
    console.warn(`[Alpecin] Failed to fetch ${year}-${month}:`, (err as Error).message);
    return [];
  }
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

async function fetchAllUpcoming(): Promise<AlpecinApiEvent[]> {
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  // Fetch from current month for the next 12 months
  const months: Array<{ year: number; month: number }> = [];
  let y = today.getUTCFullYear();
  let m = today.getUTCMonth() + 1;
  for (let i = 0; i < 12; i++) {
    months.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }

  const results = await Promise.all(months.map(({ year, month }) => fetchMonth(year, month)));
  const allEvents = results.flat();

  // Deduplicate by id, keep only upcoming events
  const seen = new Set<string>();
  const upcoming = allEvents.filter((ev) => {
    if (ev.date_start < todayISO) return false;
    if (seen.has(ev.id)) return false;
    seen.add(ev.id);
    return true;
  });

  console.log(`[Alpecin] Fetched ${upcoming.length} upcoming team events`);
  return upcoming;
}

// ─── Per-rider event builder ──────────────────────────────────────────────────

interface RiderConfig {
  riderName: string;
  idPrefix: string;
  road: SportCategory;
  cx: SportCategory;
  mtb: SportCategory;
}

const MVDP_CONFIG: RiderConfig = {
  riderName: 'Mathieu van der Poel',
  idPrefix: 'mvdp',
  road: 'mvdp_road',
  cx: 'mvdp_cx',
  mtb: 'mvdp_mtb',
};

// Road race categories that MvdP personally rides.
// "Europe Tour" and "National" are ridden exclusively by teammates.
const MVDP_ROAD_CATEGORIES = new Set(['WorldTour']);

function buildEvents(apiEvents: AlpecinApiEvent[], config: RiderConfig): SportEvent[] {
  return apiEvents
    .filter((ev) => {
      // For road races, skip Europe Tour / National — those are teammates' races.
      // CX and MTB: keep everything (MvdP rides most of those).
      const disc = disciplineToCategory(ev.discipline_slug);
      if (disc === 'road') return MVDP_ROAD_CATEGORIES.has(ev.category);
      return true;
    })
    .map((ev) => {
    const disc = disciplineToCategory(ev.discipline_slug);
    const sport: SportCategory =
      disc === 'cx' ? config.cx : disc === 'mtb' ? config.mtb : config.road;

    const key = `${config.idPrefix}_${ev.id}_${ev.date_start}`;
    const id = uuidv5(key, UUID_NAMESPACE);

    const event: SportEvent = {
      id,
      sport,
      title: `${ev.name} \u2013 ${config.riderName}`,
      competition: ev.name,
      startTime: `${ev.date_start}T10:00:00Z`,
      fetchedAt: new Date().toISOString(),
      sourceUrl: 'https://www.alpecin-premiertech.com/calendar/',
    };
    if (ev.date_end) event.endTime = `${ev.date_end}T17:00:00Z`;
    return event;
  });
}

// ─── Cached fetch (shared between MvdP and Puck within one cron run) ──────────

let cachedEvents: AlpecinApiEvent[] | null = null;
let cacheTime = 0;

async function getCachedEvents(): Promise<AlpecinApiEvent[]> {
  const now = Date.now();
  if (!cachedEvents || now - cacheTime > 10 * 60 * 1000) {
    cachedEvents = await fetchAllUpcoming();
    cacheTime = now;
  }
  return cachedEvents;
}

// ─── Public exports ───────────────────────────────────────────────────────────

export async function fetchMvdpAlpecinEvents(): Promise<SportEvent[]> {
  try {
    const events = await getCachedEvents();
    const built = buildEvents(events, MVDP_CONFIG);
    console.log(`[Alpecin/mvdp] Built ${built.length} events`);
    return built;
  } catch (err) {
    console.error('[Alpecin/mvdp] Failed:', err);
    return [];
  }
}
