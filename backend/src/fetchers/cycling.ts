/**
 * Cycling fetcher — scrapes ProCyclingStats for Mathieu van der Poel's race calendar.
 * Cloudflare bypass via ZenRows proxy (free tier: 1000 req/month).
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { v5 as uuidv5 } from 'uuid';
import type { SportEvent, SportCategory } from '../types/events';

const MVDP_PCS_URL = 'https://www.procyclingstats.com/rider/mathieu-van-der-poel';
const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function detectCategory(raceName: string): SportCategory {
  const lower = raceName.toLowerCase();
  if (
    lower.includes('cyclocross') || lower.includes(' cx ') || lower.startsWith('cx ') ||
    lower.includes('superprestige') || lower.includes('x2o') || lower.includes('dvv') ||
    lower.includes('bpost') || lower.includes('soudal')
  ) return 'mvdp_cx';
  if (
    lower.includes('mtb') || lower.includes('mountain bike') ||
    lower.includes('xco') || lower.includes('xcm') || lower.includes('cross country')
  ) return 'mvdp_mtb';
  return 'mvdp_road';
}

function parsePCSDate(dateText: string): Date | null {
  // Handle ranges like "22.02-25.02": take start date
  const cleanDate = dateText.split('-')[0].trim();
  const match = cleanDate.match(/^(\d{1,2})\.(\d{2})(?:\.(\d{4}))?$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const now = new Date();
  let year = match[3] ? parseInt(match[3], 10) : now.getFullYear();
  const date = new Date(Date.UTC(year, month, day, 10, 0, 0));
  if (!match[3] && date < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) {
    return new Date(Date.UTC(year + 1, month, day, 10, 0, 0));
  }
  return date;
}

// Race name must contain at least one letter — filters out numeric rankings and position numbers
function hasValidRaceName(s: string): boolean {
  return /[a-zA-Z]/.test(s) && s.length > 2;
}

// PCS uses <span class="rdrAbr"> for stage abbreviations (e.g. "S1 (ITT)").
// Without removing them, .text() returns "S1 (ITT)Stage 1 (ITT) - ..." (concatenated).
function getLinkText($: ReturnType<typeof cheerio.load>, el: cheerio.Element): string {
  const link = $(el).find('a').first();
  const clone = link.clone();
  clone.find('span').remove();
  const cleaned = clone.text().trim();
  return cleaned || link.text().trim();
}

async function fetchHtml(): Promise<string> {
  const zenRowsKey = (process.env.ZENROWS_API_KEY ?? '').trim();

  if (zenRowsKey) {
    // Route through ZenRows to bypass Cloudflare
    const { data } = await axios.get<string>('https://api.zenrows.com/v1/', {
      params: {
        apikey: zenRowsKey,
        url: MVDP_PCS_URL,
        js_render: 'false', // PCS is server-rendered, no JS needed
      },
      timeout: 20_000,
    });
    return data;
  }

  // Fallback: direct request (works locally, blocked in production by Cloudflare)
  const { data } = await axios.get<string>(MVDP_PCS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    timeout: 15_000,
  });
  return data;
}

export async function fetchCyclingEvents(): Promise<SportEvent[]> {
  try {
    const html = await fetchHtml();
    const $ = cheerio.load(html);
    const events: SportEvent[] = [];
    const now = new Date();
    const seen = new Set<string>();

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
      const category = detectCategory(raceName);
      const id = uuidv5(`mvdp_${key}`, UUID_NAMESPACE);
      events.push({ id, sport: category, title: `${raceName} \u2013 Mathieu van der Poel`, competition: raceName, startTime: date.toISOString(), fetchedAt: new Date().toISOString(), sourceUrl: raceUrl ? `https://www.procyclingstats.com${raceUrl}` : MVDP_PCS_URL });
    }

    // Strategy 2: scan all tables
    if (events.length === 0) {
      console.warn('[Cycling] Primary selector yielded no results — trying table parse');
      for (const table of $('table').toArray()) {
        for (const row of $(table).find('tr').toArray()) {
          const cells = $(row).find('td');
          if (cells.length < 3) continue;
          const dateText = $(cells[0]).text().trim();
          if (!parsePCSDate(dateText)) continue;
          let raceName = '';
          let raceUrl = '';
          for (let i = 1; i < Math.min(cells.length, 5); i++) {
            const cellEl = cells[i] as cheerio.Element;
            const candidate = getLinkText($, cellEl);
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
          const category = detectCategory(raceName);
          const id = uuidv5(`mvdp_${key}`, UUID_NAMESPACE);
          events.push({ id, sport: category, title: `${raceName} \u2013 Mathieu van der Poel`, competition: raceName, startTime: date.toISOString(), fetchedAt: new Date().toISOString(), sourceUrl: raceUrl ? `https://www.procyclingstats.com${raceUrl}` : MVDP_PCS_URL });
        }
      }
    }

    console.log(`[Cycling] Scraped ${events.length} upcoming MvdP events`);
    return events;
  } catch (err) {
    console.error('[Cycling] Failed to fetch matches:', err);
    return [];
  }
}
