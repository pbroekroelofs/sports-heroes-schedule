import { Router } from 'express';
import { getUserPreferences, setUserPreferences } from '../lib/firestore';
import type { SportCategory } from '../types/events';

const router = Router();

// When a new sport is added here it will automatically appear enabled for all existing users.
const ALL_SPORTS: SportCategory[] = [
  'f1', 'ajax', 'az', 'mvdp_road', 'mvdp_cx', 'mvdp_mtb', 'pp_road', 'pp_cx',
];

router.get('/', async (req, res) => {
  const uid = (req as typeof req & { uid: string }).uid;
  try {
    const prefs = await getUserPreferences(uid);
    if (!prefs) {
      res.json({ sports: ALL_SPORTS, timezone: 'Europe/Amsterdam' });
      return;
    }

    // Auto-enable sports that didn't exist yet when the user last saved their preferences.
    // seenSports = undefined means an old account that predates this tracking — treat all
    // missing sports as new so they appear enabled (one-time migration).
    const seen = prefs.seenSports ? new Set(prefs.seenSports) : null;
    const existing = new Set(prefs.sports);
    const newSports = ALL_SPORTS.filter(
      (s) => !existing.has(s) && (seen === null || !seen.has(s))
    );

    // Return only the public fields — seenSports is internal bookkeeping.
    res.json({ sports: [...prefs.sports, ...newSports], timezone: prefs.timezone });
  } catch (err) {
    console.error('Error fetching preferences:', err);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

router.put('/', async (req, res) => {
  const uid = (req as typeof req & { uid: string }).uid;
  const { sports, timezone } = req.body as { sports: unknown; timezone: unknown };

  if (!Array.isArray(sports) || typeof timezone !== 'string') {
    res.status(400).json({ error: 'Invalid preferences payload' });
    return;
  }

  try {
    // Persist seenSports = ALL_SPORTS so future new sports can be detected correctly.
    await setUserPreferences(uid, {
      sports: sports as SportCategory[],
      timezone,
      seenSports: ALL_SPORTS,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error saving preferences:', err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

export default router;
