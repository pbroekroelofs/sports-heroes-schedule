import { Router } from 'express';
import { fetchF1Events } from '../fetchers/f1';
import { fetchAjaxEvents } from '../fetchers/ajax';
import { fetchCyclingEvents } from '../fetchers/cycling';
import { upsertEvent, purgeInvalidCyclingEvents } from '../lib/firestore';

const router = Router();

/**
 * POST /cron/refresh
 * Called by Cloud Scheduler daily at 07:00 CET.
 * Secured with a shared secret — set CRON_SECRET in Cloud Run env vars
 * and configure Cloud Scheduler to send it as the X-Cron-Secret header.
 */
router.post('/refresh', async (req, res) => {
  const cronSecret = ((req.headers['x-cron-secret'] as string) ?? '').trim();
  const expectedSecret = (process.env.CRON_SECRET ?? '').trim();
  if (process.env.NODE_ENV === 'production' && cronSecret !== expectedSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  console.log('[Cron] Starting daily data refresh...');

  const [f1Result, ajaxResult, cyclingResult] = await Promise.allSettled([
    fetchF1Events(),
    fetchAjaxEvents(),
    fetchCyclingEvents(),
  ]);

  const allEvents = [
    ...(f1Result.status === 'fulfilled' ? f1Result.value : []),
    ...(ajaxResult.status === 'fulfilled' ? ajaxResult.value : []),
    ...(cyclingResult.status === 'fulfilled' ? cyclingResult.value : []),
  ];

  // Upsert in parallel — Firestore handles concurrency fine at this scale
  const upsertResults = await Promise.allSettled(allEvents.map((e) => upsertEvent(e)));
  const failedUpserts = upsertResults.filter((r) => r.status === 'rejected');
  if (failedUpserts.length > 0) {
    console.error(`[Cron] ${failedUpserts.length} upserts failed:`,
      failedUpserts.map((r) => (r as PromiseRejectedResult).reason));
  }

  const summary = {
    f1: f1Result.status === 'fulfilled' ? f1Result.value.length : `ERROR: ${(f1Result as PromiseRejectedResult).reason}`,
    ajax: ajaxResult.status === 'fulfilled' ? ajaxResult.value.length : `ERROR: ${(ajaxResult as PromiseRejectedResult).reason}`,
    cycling: cyclingResult.status === 'fulfilled' ? cyclingResult.value.length : `ERROR: ${(cyclingResult as PromiseRejectedResult).reason}`,
    total: allEvents.length,
  };

  const purged = await purgeInvalidCyclingEvents();
  if (purged > 0) console.log(`[Cron] Purged ${purged} invalid cycling events from Firestore`);

  console.log('[Cron] Refresh complete:', summary);
  res.json({ ok: true, summary, purged });
});

export default router;
