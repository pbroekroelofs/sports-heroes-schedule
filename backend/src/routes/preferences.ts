import { Router } from 'express';
import { getUserPreferences, setUserPreferences } from '../lib/firestore';
import type { UserPreferences, SportCategory } from '../types/events';

const router = Router();

// All known sport categories — new entries here are auto-enabled for existing users.
const ALL_SPORTS: SportCategory[] = [
  'f1', 'ajax', 'az', 'mvdp_road', 'mvdp_cx', 'mvdp_mtb', 'pp_road', 'pp_cx',
];

router.get('/', async (req, res) => {
  const uid = (req as typeof req & { uid: string }).uid;
  try {
    const prefs = await getUserPreferences(uid);
    if (!prefs) {
      res.json({ sports: ALL_SPORTS, timezone: 'Europe/Amsterdam' } satisfies UserPreferences);
      return;
    }
    // Merge: add any newly-introduced sports that aren't in the user's saved list yet.
    const savedSet = new Set(prefs.sports);
    const merged = [...prefs.sports, ...ALL_SPORTS.filter((s) => !savedSet.has(s))];
    res.json({ ...prefs, sports: merged } satisfies UserPreferences);
  } catch (err) {
    console.error('Error fetching preferences:', err);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

router.put('/', async (req, res) => {
  const uid = (req as typeof req & { uid: string }).uid;
  const prefs = req.body as UserPreferences;

  if (!Array.isArray(prefs.sports) || typeof prefs.timezone !== 'string') {
    res.status(400).json({ error: 'Invalid preferences payload' });
    return;
  }

  try {
    await setUserPreferences(uid, prefs);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error saving preferences:', err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

export default router;
