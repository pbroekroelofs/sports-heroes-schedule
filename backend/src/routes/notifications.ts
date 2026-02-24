import { Router } from 'express';
import type { SportCategory } from '../types/events';
import {
  savePushSubscription,
  deletePushSubscription,
  getPushSubscription,
} from '../lib/firestore';

const router = Router();

router.get('/subscribe', async (req, res) => {
  const uid = (req as typeof req & { uid: string }).uid;
  try {
    const sub = await getPushSubscription(uid);
    if (!sub) {
      res.status(404).json({ error: 'No subscription' });
      return;
    }
    res.json({ sports: sub.sports });
  } catch (err) {
    console.error('Error fetching push subscription:', err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

router.post('/subscribe', async (req, res) => {
  const uid = (req as typeof req & { uid: string }).uid;
  const { subscription, sports } = req.body as {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    sports: unknown;
  };

  if (
    !subscription?.endpoint ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth ||
    !Array.isArray(sports)
  ) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  try {
    await savePushSubscription(uid, {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      sports: sports as SportCategory[],
      updatedAt: new Date(),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error saving push subscription:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

router.delete('/subscribe', async (req, res) => {
  const uid = (req as typeof req & { uid: string }).uid;
  try {
    await deletePushSubscription(uid);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting push subscription:', err);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

export default router;
