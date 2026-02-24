import { Router } from 'express';
import { fetchF1Events } from '../fetchers/f1';
import { fetchAjaxEvents, fetchAZEvents } from '../fetchers/ajax';
import { fetchCyclingEvents, fetchPuckPieterseEvents } from '../fetchers/cycling';
import { upsertEvent, deleteEventsForSports, purgeInvalidCyclingEvents, getEvents, getAllPushSubscriptions, deletePushSubscription } from '../lib/firestore';
import { sendPushNotification } from '../lib/push';
import { SPORT_LABELS } from '../types/events';

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

  // Full replace for cycling: delete stale entries before inserting fresh ones.
  // Only delete when the fetch succeeded with results, to avoid wiping data on failures.
  if (mvdpResult.status === 'fulfilled' && mvdpResult.value.length > 0) {
    await deleteEventsForSports(['mvdp_road', 'mvdp_cx', 'mvdp_mtb']);
  }
  if (ppResult.status === 'fulfilled' && ppResult.value.length > 0) {
    await deleteEventsForSports(['pp_road', 'pp_cx']);
  }

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

/**
 * POST /cron/notify
 * Called by Cloud Scheduler every 30 minutes.
 * Sends push notifications for events starting 25–55 minutes from now.
 */
router.post('/notify', async (req, res) => {
  const cronSecret = ((req.headers['x-cron-secret'] as string) ?? '').trim();
  const expectedSecret = (process.env.CRON_SECRET ?? '').trim();
  if (process.env.NODE_ENV === 'production' && cronSecret !== expectedSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const now = new Date();
  const from = new Date(now.getTime() + 25 * 60 * 1000);
  const to = new Date(now.getTime() + 55 * 60 * 1000);

  const [upcomingEvents, subscriptions] = await Promise.all([
    getEvents(from, to),
    getAllPushSubscriptions(),
  ]);

  if (upcomingEvents.length === 0 || subscriptions.length === 0) {
    res.json({ ok: true, sent: 0 });
    return;
  }

  let sent = 0;
  const toDelete: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      const userEvents = upcomingEvents.filter((e) => sub.sports.includes(e.sport));
      if (userEvents.length === 0) return;

      for (const event of userEvents.slice(0, 5)) {
        const minutesUntil = Math.round((new Date(event.startTime).getTime() - now.getTime()) / 60000);
        try {
          await sendPushNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            {
              title: SPORT_LABELS[event.sport],
              body: `${event.title} begint over ${minutesUntil} minuten`,
              url: event.sourceUrl ?? '/',
            }
          );
          sent++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            // Subscription expired — clean up
            toDelete.push(sub.uid);
          } else {
            console.error(`[Notify] Push failed for uid=${sub.uid}:`, err);
          }
        }
      }
    })
  );

  // Remove expired subscriptions
  await Promise.all(toDelete.map((uid) => deletePushSubscription(uid)));

  console.log(`[Notify] Sent ${sent} push notifications; removed ${toDelete.length} stale subscriptions`);
  res.json({ ok: true, sent, removed: toDelete.length });
});

export default router;
