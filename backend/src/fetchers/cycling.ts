/**
 * Cycling fetcher — scrapes ProCyclingStats rider pages.
 * Cloudflare bypass via ZenRows proxy (free tier: 1000 req/month).
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { v5 as uuidv5 } from 'uuid';
import type { SportEvent, SportCategory } from '../types/events';

const PCS_BASE_URL = 'https://www.procyclingstats.com/rider';
const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

interface RiderConfig {
  slug: string;       // PCS URL slug, e.g. 'mathieu-van-der-poel'
  name: string;       // Display name, e.g. 'Mathieu van der Poel'
  idPrefix: string;   // Unique prefix for event IDs, e.g. 'mvdp'
  road: SportCategory;
  cx: SportCategory;
  mtb: SportCategory;
}

function detectCategory(raceName: string, config: RiderConfig): SportCategory {
  const lower = raceName.toLowerCase();
  if (
    lower.includes('cyclocross') || lower.includes(' cx ') || lower.startsWith('cx ') ||
    lower.includes('superprestige') || lower.includes('x2o') || lower.includes('dvv') ||
    lower.includes('bpost') || lower.includes('soudal')
  ) return config.cx;
  if (
    lower.includes('mtb') || lower.includes('mountain bike') ||
    lower.includes('xco') || lower.includes('xcm') || lower.includes('cross country')
  ) return config.mtb;
  return config.road;
}

function parsePCSDate(dateText: string): Date | null {
  // Handle ranges like "22.02-25.02": take start date
  const cleanDate = dateText.split('-')[0].trim();
  const match = cleanDate.match(/^(\d{1,2})\.(\d{2})(?:\.(\d{4}))?$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const now = new Date();
  const year = match[3] ? parseInt(match[3], 10) : now.getFullYear();
  const date = new Date(Date.UTC(year, month, day, 10, 0, 0));
  if (!match[3] && date < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) {
    return new Date(Date.UTC(year + 1, month, day, 10, 0, 0));
  }
  return date;
}

/**
 * Extracts clean race name from a list item.
 *
 * PCS renders stage names as: <a><span>S1 (ITT)</span>Stage 1 (ITT) - Route</a>
 * Calling .text() concatenates span and text without space → "S1 (ITT)Stage 1 (ITT) - Route".
 * Fix: join child node texts with a space, then strip the leading stage abbreviation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLinkText($: ReturnType<typeof cheerio.load>, el: any): string {
  const link = $(el).find('a').first();

  // Join all direct child texts with a space to prevent concatenation
  const parts: string[] = [];
  link.contents().each((_i: number, node: any) => {
    const t = (node.type === 'text' ? node.data : $(node).text()) ?? '';
    const trimmed = t.trim();
    if (trimmed) parts.push(trimmed);
  });
  const joined = parts.join(' ').trim();

  // Strip leading PCS stage abbreviation (e.g. "S1 (ITT) ") only when followed by "Stage"/"Prologue"
  const cleaned = joined.replace(/^[A-Z]\d+\s*(?:\([^)]*\))?\s+(?=Stage|Prologue|ITT)/i, '').trim();
  return cleaned || joined || link.text().trim();
}

/**
 * A valid race name must:
 * - be at least 6 characters
 * - contain at least one letter
 * - not start with "(" (classification codes like "(1.UWT)")
 * - not start with "- " (artifact of broken span removal in old scraper versions)
 */
function hasValidRaceName(s: string): boolean {
  if (!s || s.length < 6) return false;
  if (s.startsWith('(')) return false;
  if (s.startsWith('- ')) return false;
  return /[a-zA-Z]/.test(s);
}

async function fetchHtml(riderSlug: string): Promise<string> {
  const url = `${PCS_BASE_URL}/${riderSlug}`;
  const zenRowsKey = (process.env.ZENROWS_API_KEY ?? '').trim();

  if (zenRowsKey) {
    const { data } = await axios.get<string>('https://api.zenrows.com/v1/', {
      params: { apikey: zenRowsKey, url, js_render: 'false' },
      timeout: 20_000,
    });
    return data;
  }

  const { data } = await axios.get<string>(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    timeout: 15_000,
  });
  return data;
}

async function fetchRiderEvents(config: RiderConfig): Promise<SportEvent[]> {
  try {
    const html = await fetchHtml(config.slug);
    const $ = cheerio.load(html);
    const events: SportEvent[] = [];
    const now = new Date();
    const seen = new Set<string>();
    const pcsBase = 'https://www.procyclingstats.com';

    // Strategy 1: PCS upcoming section
    for (const el of $('ul.rdrSeasonList li, .rdrUpcoming li').toArray()) {
      const dateText = $(el).find('.date').first().text().trim();
      const raceName = getLinkText($, el);
      const raceUrl = $(el).find('a').first().attr('href');
      if (!dateText || !hasValidRaceName(raceName)) continue;
      const date = parsePCSDate(dateText);
      if (!date || date < now) continue;
      const key = `${dateText}_${raceName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const category = detectCategory(raceName, config);
      const id = uuidv5(`${config.idPrefix}_${key}`, UUID_NAMESPACE);
      events.push({
        id, sport: category,
        title: `${raceName} \u2013 ${config.name}`,
        competition: raceName,
        startTime: date.toISOString(),
        fetchedAt: new Date().toISOString(),
        sourceUrl: raceUrl ? `${pcsBase}${raceUrl}` : `${pcsBase}/rider/${config.slug}`,
      });
    }

    // Strategy 2: scan all tables (fallback)
    if (events.length === 0) {
      console.warn(`[Cycling/${config.slug}] Primary selector yielded no results — trying table parse`);
      for (const table of $('table').toArray()) {
        for (const row of $(table).find('tr').toArray()) {
          const cells = $(row).find('td');
          if (cells.length < 3) continue;
          const dateText = $(cells[0]).text().trim();
          if (!parsePCSDate(dateText)) continue;
          let raceName = '';
          let raceUrl = '';
          for (let i = 1; i < Math.min(cells.length, 5); i++) {
            const candidate = getLinkText($, cells[i]);
            if (hasValidRaceName(candidate)) {
              raceName = candidate;
              raceUrl = $(cells[i]).find('a').first().attr('href') || '';
              break;
            }
          }
          if (!hasValidRaceName(raceName)) continue;
          const date = parsePCSDate(dateText);
          if (!date || date < now) continue;
          const key = `${dateText}_${raceName}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const category = detectCategory(raceName, config);
          const id = uuidv5(`${config.idPrefix}_${key}`, UUID_NAMESPACE);
          events.push({
            id, sport: category,
            title: `${raceName} \u2013 ${config.name}`,
            competition: raceName,
            startTime: date.toISOString(),
            fetchedAt: new Date().toISOString(),
            sourceUrl: raceUrl ? `${pcsBase}${raceUrl}` : `${pcsBase}/rider/${config.slug}`,
          });
        }
      }
    }

    console.log(`[Cycling/${config.slug}] Scraped ${events.length} upcoming events`);
    return events;
  } catch (err) {
    console.error(`[Cycling/${config.slug}] Failed to fetch:`, err);
    return [];
  }
}

export function fetchCyclingEvents(): Promise<SportEvent[]> {
  return fetchRiderEvents({
    slug: 'mathieu-van-der-poel',
    name: 'Mathieu van der Poel',
    idPrefix: 'mvdp',
    road: 'mvdp_road',
    cx: 'mvdp_cx',
    mtb: 'mvdp_mtb',
  });
}

export function fetchPuckPieterseEvents(): Promise<SportEvent[]> {
  return fetchRiderEvents({
    slug: 'puck-pieterse',
    name: 'Puck Pieterse',
    idPrefix: 'pp',
    road: 'pp_road',
    cx: 'pp_cx',
    mtb: 'pp_cx', // no separate MTB category for PP, map to CX
  });
}
