import { Router } from 'express';
import { getUserPreferences, setUserPreferences } from '../lib/firestore';
import type { UserPreferences } from '../types/events';

const router = Router();

router.get('/', async (req, res) => {
  const uid = (req as typeof req & { uid: string }).uid;
  try {
    const prefs = await getUserPreferences(uid);
    // Return sensible defaults if no preferences saved yet
    res.json(
      prefs ?? {
        sports: ['f1', 'ajax', 'mvdp_road', 'mvdp_cx', 'mvdp_mtb'],
        timezone: 'Europe/Amsterdam',
      }
    );
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
