import { Router } from 'express';
import { fetchF1Events } from '../fetchers/f1';
import { fetchAjaxEvents, fetchAZEvents } from '../fetchers/ajax';
import { fetchCyclingEvents, fetchPuckPieterseEvents } from '../fetchers/cycling';
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

  const [f1Result, ajaxResult, azResult, mvdpResult, ppResult] = await Promise.allSettled([
    fetchF1Events(),
    fetchAjaxEvents(),
    fetchAZEvents(),
    fetchCyclingEvents(),
    fetchPuckPieterseEvents(),
  ]);

  const allEvents = [
    ...(f1Result.status === 'fulfilled' ? f1Result.value : []),
    ...(ajaxResult.status === 'fulfilled' ? ajaxResult.value : []),
    ...(azResult.status === 'fulfilled' ? azResult.value : []),
    ...(mvdpResult.status === 'fulfilled' ? mvdpResult.value : []),
    ...(ppResult.status === 'fulfilled' ? ppResult.value : []),
  ];

  // Upsert in parallel
  const upsertResults = await Promise.allSettled(allEvents.map((e) => upsertEvent(e)));
  const failedUpserts = upsertResults.filter((r) => r.status === 'rejected');
  if (failedUpserts.length > 0) {
    console.error(`[Cron] ${failedUpserts.length} upserts failed:`,
      failedUpserts.map((r) => (r as PromiseRejectedResult).reason));
  }

  // Purge old invalid cycling entries from Firestore
  const purged = await purgeInvalidCyclingEvents();
  if (purged > 0) console.log(`[Cron] Purged ${purged} invalid cycling events from Firestore`);

  const summary = {
    f1: f1Result.status === 'fulfilled' ? f1Result.value.length : `ERROR: ${(f1Result as PromiseRejectedResult).reason}`,
    ajax: ajaxResult.status === 'fulfilled' ? ajaxResult.value.length : `ERROR: ${(ajaxResult as PromiseRejectedResult).reason}`,
    az: azResult.status === 'fulfilled' ? azResult.value.length : `ERROR: ${(azResult as PromiseRejectedResult).reason}`,
    mvdp: mvdpResult.status === 'fulfilled' ? mvdpResult.value.length : `ERROR: ${(mvdpResult as PromiseRejectedResult).reason}`,
    pp: ppResult.status === 'fulfilled' ? ppResult.value.length : `ERROR: ${(ppResult as PromiseRejectedResult).reason}`,
    total: allEvents.length,
  };

  console.log('[Cron] Refresh complete:', summary);
  res.json({ ok: true, summary, purged });
});

export default router;
