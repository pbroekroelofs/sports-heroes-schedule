import { Router } from 'express';
import { getEvents } from '../lib/firestore';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const from = req.query.from ? new Date(req.query.from as string) : now;
    // Default: next 90 days
    const to = req.query.to
      ? new Date(req.query.to as string)
      : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      res.status(400).json({ error: 'Invalid date parameters' });
      return;
    }

    const events = await getEvents(from, to);
    res.json({ events });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

export default router;
