/**
 * Cycling fetcher — scrapes FirstCycling for Mathieu van der Poel's race calendar.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { v5 as uuidv5 } from 'uuid';
import type { SportEvent, SportCategory } from '../types/events';

const FC_BASE = 'https://firstcycling.com/rider.php';
const MVDP_ID = '16672';
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

/** Parse date in format DD.MM or DD.MM.YYYY, optionally with a range like "22.02-25.02" */
function parseDate(dateText: string, fallbackYear: number): Date | null {
  // Handle ranges (stage races): take the start date
  const cleanDate = dateText.split('-')[0].trim();
  const match = cleanDate.match(/^(\d{1,2})\.(\d{2})(?:\.(\d{4}))?$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = match[3] ? parseInt(match[3], 10) : fallbackYear;
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month, day, 10, 0, 0));
}

/** Returns true if the string looks like a bare number (ranking, points) rather than a race name */
function isNumeric(s: string): boolean {
  return /^\d+$/.test(s.trim());
}

export async function fetchCyclingEvents(): Promise<SportEvent[]> {
  const events: SportEvent[] = [];
  const seen = new Set<string>();
  const now = new Date();
  const currentYear = now.getFullYear();

  for (const year of [currentYear, currentYear + 1]) {
    try {
      const url = `${FC_BASE}?r=${MVDP_ID}&y=${year}`;
      const { data: html } = await axios.get<string>(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': 'https://firstcycling.com/',
        },
        timeout: 15_000,
      });

      const $ = cheerio.load(html);
      let yearCount = 0;

      // Use toArray() to avoid implicit-any in the .each() callback
      for (const row of $('table tr').toArray()) {
        const cells = $(row).find('td');
        if (cells.length < 3) continue;

        const dateText = $(cells[0]).text().trim();
        // First cell must start with a digit (date like "22.02" or "22.02-25.02")
        if (!dateText || !/^\d/.test(dateText)) continue;

        const date = parseDate(dateText, year);
        if (!date || date < now) continue; // skip past events

        // Race name: scan cells for first anchor with meaningful text
        let raceName = '';
        let raceUrl = '';
        for (let i = 1; i < Math.min(cells.length, 8); i++) {
          const link = $(cells[i]).find('a').first();
          const candidate = link.text().trim();
          if (candidate && !isNumeric(candidate) && candidate.length > 3) {
            raceName = candidate;
            raceUrl = link.attr('href') || '';
            break;
          }
        }
        if (!raceName) continue;

        const key = `${year}_${dateText}_${raceName}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const category = detectCategory(raceName);
        const id = uuidv5(`mvdp_${key}`, UUID_NAMESPACE);
        events.push({
          id,
          sport: category,
          title: `${raceName} \u2013 Mathieu van der Poel`,
          competition: raceName,
          startTime: date.toISOString(),
          fetchedAt: new Date().toISOString(),
          sourceUrl: raceUrl
            ? `https://firstcycling.com/${raceUrl}`
            : `${FC_BASE}?r=${MVDP_ID}&y=${year}`,
        });
        yearCount++;
      }

      console.log(`[Cycling] Year ${year}: found ${yearCount} upcoming MvdP events`);
    } catch (err) {
      console.error(`[Cycling] FirstCycling scrape failed for year ${year}:`, err);
    }
  }

  console.log(`[Cycling] Total: ${events.length} upcoming MvdP events`);
  return events;
}
