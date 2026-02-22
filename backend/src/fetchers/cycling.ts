/**
 * Cycling fetcher — scrapes ProCyclingStats for Mathieu van der Poel's race calendar.
 *
 * FRAGILITY NOTE: Web scraping depends on the site's HTML structure. If ProCyclingStats
 * changes their layout this scraper will need updating. Check the selectors if events
 * stop appearing. The admin can always add events manually via the Firestore console
 * as a fallback.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { v5 as uuidv5 } from 'uuid';
import type { SportEvent, SportCategory } from '../types/events';

const MVDP_PCS_URL = 'https://www.procyclingstats.com/rider/mathieu-van-der-poel';
const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Infers the sport category from the race name.
 * PCS race names for CX/MTB are usually explicit; everything else is road.
 */
function detectCategory(raceName: string): SportCategory {
  const lower = raceName.toLowerCase();
  if (
    lower.includes('cyclocross') ||
    lower.includes(' cx ') ||
    lower.startsWith('cx ') ||
    lower.includes('superprestige') ||
    lower.includes('x2o') ||
    lower.includes('dvv') ||
    lower.includes('bpost')
  ) {
    return 'mvdp_cx';
  }
  if (
    lower.includes('mtb') ||
    lower.includes('mountain bike') ||
    lower.includes('xco') ||
    lower.includes('xcm') ||
    lower.includes('cross country')
  ) {
    return 'mvdp_mtb';
  }
  return 'mvdp_road';
}

/**
 * Parses a PCS date string like "01.03" or "01.03.2025" into a Date object.
 * When no year is given we assume current year; if the result is already in
 * the past we bump it to next year (handles the calendar wrap-around).
 */
function parsePCSDate(dateText: string): Date | null {
  const match = dateText.match(/^(\d{2})\.(\d{2})(?:\.(\d{4}))?$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const now = new Date();
  let year = match[3] ? parseInt(match[3], 10) : now.getFullYear();

  let date = new Date(Date.UTC(year, month, day, 10, 0, 0)); // default 10:00 UTC

  // If the date is more than a week in the past and no explicit year was given,
  // it's probably next year's race listed without a year
  if (!match[3] && date < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) {
    date = new Date(Date.UTC(year + 1, month, day, 10, 0, 0));
  }

  return date;
}

export async function fetchCyclingEvents(): Promise<SportEvent[]> {
  try {
    const { data: html } = await axios.get<string>(MVDP_PCS_URL, {
      headers: {
        // Polite bot identifier — not attempting to impersonate a browser
        'User-Agent': 'SportsScheduleBot/1.0 (+https://github.com/you/sports-schedule)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15_000,
    });

    const $ = cheerio.load(html);
    const events: SportEvent[] = [];
    const now = new Date();

    // PCS rider pages contain a list/table of upcoming races.
    // The structure is typically inside a <ul class="rdrSeasonList"> or similar.
    // Each item has a date cell and a race name link.
    // We use a broad selector and filter by date to be resilient to layout changes.
    $('li.rdrSeasonList, ul.rdrSeasonList li, .race-upcoming li').each((_, el) => {
      const dateText = $(el).find('.date, .raceDate, td:first-child').first().text().trim();
      const raceName = $(el).find('a').first().text().trim();
      const raceUrl = $(el).find('a').first().attr('href');

      if (!dateText || !raceName) return;

      const date = parsePCSDate(dateText);
      if (!date || date < now) return;

      const category = detectCategory(raceName);
      const id = uuidv5(`mvdp_${dateText}_${raceName}`, UUID_NAMESPACE);

      events.push({
        id,
        sport: category,
        title: `${raceName} – Mathieu van der Poel`,
        competition: raceName,
        startTime: date.toISOString(),
        fetchedAt: new Date().toISOString(),
        sourceUrl: raceUrl
          ? `https://www.procyclingstats.com${raceUrl}`
          : MVDP_PCS_URL,
      });
    });

    // Fallback: if the targeted selector found nothing, try a wider approach
    if (events.length === 0) {
      console.warn('[Cycling] Primary selector yielded no results — trying fallback table parse');
      $('table tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) return;

        const dateText = $(cells[0]).text().trim();
        const raceName = $(cells[1]).find('a').text().trim() || $(cells[1]).text().trim();
        const raceUrl = $(cells[1]).find('a').attr('href');

        if (!dateText || !raceName) return;

        const date = parsePCSDate(dateText);
        if (!date || date < now) return;

        const category = detectCategory(raceName);
        const id = uuidv5(`mvdp_${dateText}_${raceName}`, UUID_NAMESPACE);

        events.push({
          id,
          sport: category,
          title: `${raceName} – Mathieu van der Poel`,
          competition: raceName,
          startTime: date.toISOString(),
          fetchedAt: new Date().toISOString(),
          sourceUrl: raceUrl
            ? `https://www.procyclingstats.com${raceUrl}`
            : MVDP_PCS_URL,
        });
      });
    }

    console.log(`[Cycling] Scraped ${events.length} upcoming MvdP events`);
    return events;
  } catch (err) {
    console.error('[Cycling] Scraping failed:', err);
    return [];
  }
}
