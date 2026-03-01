/**
 * Alpecin-Premier Tech team calendar fetcher.
 *
 * Uses ZenRows JS rendering to get the fully rendered team calendar page,
 * then extracts upcoming race entries for MvdP and Puck Pieterse.
 *
 * Because both riders are on the same team we fetch the page ONCE per cron
 * run and split the results by rider.
 *
 * First-run note: the HTML preview logged to Cloud Run will reveal the exact
 * element structure so the selectors below can be refined if needed.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { v5 as uuidv5 } from 'uuid';
import type { SportEvent, SportCategory } from '../types/events';

const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const ALPECIN_CALENDAR = 'https://www.alpecin-premiertech.com/calendar/';
const ALPECIN_BASE = 'https://www.alpecin-premiertech.com';

// ─── Date parsing ────────────────────────────────────────────────────────────

const NL_MONTHS: Record<string, number> = {
  januari: 0, februari: 1, maart: 2, april: 3, mei: 4, juni: 5,
  juli: 6, augustus: 7, september: 8, oktober: 9, november: 10, december: 11,
  // English fallbacks
  january: 0, february: 1, march: 2, may: 4, june: 5, july: 6,
  august: 7, october: 9,
};

function parseDate(raw: string): Date | null {
  const s = raw.trim();
  // ISO: 2026-03-07
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.slice(0, 10) + 'T10:00:00Z');
    return isNaN(d.getTime()) ? null : d;
  }
  // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dotMatch = s.match(/^(\d{1,2})[.\/-](\d{2})[.\/-](\d{4})$/);
  if (dotMatch) {
    const d = new Date(Date.UTC(+dotMatch[3], +dotMatch[2] - 1, +dotMatch[1], 10, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }
  // Dutch/English text: "7 maart 2026" or "March 7, 2026"
  const textMatch = s.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/i)
    ?? s.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (textMatch) {
    // Try both orderings
    for (const [d, m, y] of [[textMatch[1], textMatch[2], textMatch[3]], [textMatch[2], textMatch[1], textMatch[3]]]) {
      if (/^\d+$/.test(d)) {
        const month = NL_MONTHS[m.toLowerCase()];
        if (month !== undefined) {
          const date = new Date(Date.UTC(+y, month, +d, 10, 0, 0));
          if (!isNaN(date.getTime())) return date;
        }
      }
    }
  }
  return null;
}

// ─── Category detection ───────────────────────────────────────────────────────

function detectCategory(text: string): 'road' | 'cx' | 'mtb' {
  const l = text.toLowerCase();
  if (l.includes('cyclocross') || l.includes('cross') || l.includes('superprestige') ||
      l.includes('x2o') || l.includes('dvv') || l.includes(' cx') || l.startsWith('cx ')) return 'cx';
  if (l.includes('mtb') || l.includes('mountain bike') || l.includes('xco') ||
      l.includes('xcm') || l.includes('cross country')) return 'mtb';
  return 'road';
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

interface RaceEntry {
  date: Date;
  name: string;
  url: string;
  text: string;   // full text of entry (used for rider name matching)
  disc: 'road' | 'cx' | 'mtb';
}

async function fetchRenderedHtml(): Promise<string> {
  const zenRowsKey = (process.env.ZENROWS_API_KEY ?? '').trim();
  if (!zenRowsKey) throw new Error('ZENROWS_API_KEY is required for Alpecin calendar (JS-rendered)');

  const { data } = await axios.get<string>('https://api.zenrows.com/v1/', {
    params: {
      apikey: zenRowsKey,
      url: ALPECIN_CALENDAR,
      js_render: 'true',
      wait: '3000',
    },
    timeout: 50_000,
  });
  return data;
}

async function extractRaceEntries(html: string): Promise<RaceEntry[]> {
  const $ = cheerio.load(html);
  const entries: RaceEntry[] = [];
  const now = new Date();

  // ── Diagnostic logging ────────────────────────────────────────────────────
  console.log(`[Alpecin] HTML length: ${html.length}`);
  console.log(`[Alpecin] HTML preview:\n${html.slice(0, 4000)}`);

  // Log counts for common element types to understand the DOM
  for (const sel of ['article', 'section', 'li', 'tr', '[class*="race"]', '[class*="event"]',
                      '[class*="calendar"]', '[class*="item"]', 'time[datetime]']) {
    const n = $(sel).length;
    if (n > 0) console.log(`[Alpecin] "${sel}": ${n} elements`);
  }

  // ── Strategy A: <time datetime="..."> elements (most reliable) ────────────
  $('time[datetime]').each((_i, el) => {
    const dt = $(el).attr('datetime') ?? '';
    const date = parseDate(dt);
    if (!date || date < now) return;

    const container = $(el).closest('article, li, tr, [class*="race"], [class*="event"], [class*="item"], div');
    const text = container.text().replace(/\s+/g, ' ').trim();
    const heading = container.find('h1,h2,h3,h4,h5,a').first().text().trim();
    const name = heading || text.slice(0, 80);
    const href = container.find('a').first().attr('href') ?? '';
    const url = href.startsWith('http') ? href : href ? `${ALPECIN_BASE}${href}` : ALPECIN_CALENDAR;

    if (name.length >= 4) {
      entries.push({ date, name, url, text, disc: detectCategory(name + ' ' + text) });
    }
  });

  // ── Strategy B: ISO/DD.MM dates in text of candidate containers ───────────
  if (entries.length === 0) {
    console.log('[Alpecin] Strategy A (time[datetime]) yielded nothing — trying text date scan');

    const DATE_RE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[.\/-]\d{2}[.\/-]\d{4})\b/g;
    const containers = $('article, li, tr, [class*="race"], [class*="event"], [class*="calendar"]').toArray();

    for (const el of containers) {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      const matches = [...text.matchAll(DATE_RE)];
      if (!matches.length) continue;

      for (const m of matches) {
        const date = parseDate(m[1]);
        if (!date || date < now) continue;

        const heading = $(el).find('h1,h2,h3,h4,h5,a').first().text().trim();
        const name = heading || text.slice(0, 80);
        const href = $(el).find('a').first().attr('href') ?? '';
        const url = href.startsWith('http') ? href : href ? `${ALPECIN_BASE}${href}` : ALPECIN_CALENDAR;

        if (name.length >= 4) {
          entries.push({ date, name, url, text, disc: detectCategory(name + ' ' + text) });
        }
      }
    }
  }

  console.log(`[Alpecin] Extracted ${entries.length} candidate entries`);
  return entries;
}

// ─── Per-rider event builder ──────────────────────────────────────────────────

interface RiderConfig {
  riderName: string;
  searchTerms: string[];   // substrings to match rider in entry text
  idPrefix: string;
  road: SportCategory;
  cx: SportCategory;
  mtb: SportCategory;
}

const MVDP_CONFIG: RiderConfig = {
  riderName: 'Mathieu van der Poel',
  searchTerms: ['mathieu', 'van der poel', 'mvdp'],
  idPrefix: 'mvdp',
  road: 'mvdp_road', cx: 'mvdp_cx', mtb: 'mvdp_mtb',
};

const PUCK_CONFIG: RiderConfig = {
  riderName: 'Puck Pieterse',
  searchTerms: ['puck', 'pieterse'],
  idPrefix: 'pp',
  road: 'pp_road', cx: 'pp_cx', mtb: 'pp_cx',
};

function buildEvents(entries: RaceEntry[], config: RiderConfig): SportEvent[] {
  const events: SportEvent[] = [];
  const seen = new Set<string>();

  // Check whether ANY entry mentions a rider name at all
  const anyRiderMentioned = entries.some((e) =>
    [...MVDP_CONFIG.searchTerms, ...PUCK_CONFIG.searchTerms].some((t) =>
      e.text.toLowerCase().includes(t)
    )
  );

  for (const entry of entries) {
    // If rider names appear anywhere, filter by this rider; otherwise include all
    if (anyRiderMentioned) {
      const matches = config.searchTerms.some((t) => entry.text.toLowerCase().includes(t));
      if (!matches) continue;
    }

    const key = `${entry.date.toISOString().slice(0, 10)}_${entry.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const sport: SportCategory =
      entry.disc === 'cx' ? config.cx : entry.disc === 'mtb' ? config.mtb : config.road;

    const id = uuidv5(`${config.idPrefix}_${key}`, UUID_NAMESPACE);
    events.push({
      id, sport,
      title: `${entry.name} \u2013 ${config.riderName}`,
      competition: entry.name,
      startTime: entry.date.toISOString(),
      fetchedAt: new Date().toISOString(),
      sourceUrl: entry.url,
    });
  }

  console.log(`[Alpecin/${config.idPrefix}] Built ${events.length} events`);
  return events;
}

// ─── Cached fetch (shared between MvdP and Puck within one cron run) ──────────

let cachedHtml: string | null = null;
let cacheTime = 0;

async function getCachedEntries(): Promise<RaceEntry[]> {
  const now = Date.now();
  // Cache for up to 10 minutes within a single process
  if (!cachedHtml || now - cacheTime > 10 * 60 * 1000) {
    cachedHtml = await fetchRenderedHtml();
    cacheTime = now;
  }
  return extractRaceEntries(cachedHtml);
}

// ─── Public exports ───────────────────────────────────────────────────────────

export async function fetchMvdpAlpecinEvents(): Promise<SportEvent[]> {
  try {
    const entries = await getCachedEntries();
    return buildEvents(entries, MVDP_CONFIG);
  } catch (err) {
    console.error('[Alpecin/mvdp] Failed:', err);
    return [];
  }
}

export async function fetchPuckAlpecinEvents(): Promise<SportEvent[]> {
  try {
    const entries = await getCachedEntries();
    return buildEvents(entries, PUCK_CONFIG);
  } catch (err) {
    console.error('[Alpecin/pp] Failed:', err);
    return [];
  }
}
