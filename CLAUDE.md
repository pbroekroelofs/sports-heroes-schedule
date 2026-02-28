# Sports Schedule PWA — Project Context

## What this is
A personal PWA for friends & family to track sports events (F1, Ajax, AZ, MvdP cycling, Puck Pieterste cycling). Built with Next.js (frontend) + Express (backend), both deployed on Google Cloud Run via GitHub Actions.

## Architecture
- **Frontend**: Next.js 15, Tailwind CSS, SWR, Firebase Auth, `@ducanh2912/next-pwa` v10
- **Backend**: Express + TypeScript, Firebase Admin SDK (Firestore), deployed as Cloud Run service
- **Database**: Firestore — `events`, `users/{uid}/preferences/main`, `pushSubscriptions/{uid}`
- **CI/CD**: `.github/workflows/deploy.yml` — pushes to `main` deploys both services
- **Cron jobs** (Cloud Scheduler, `europe-west1`):
  - `daily-refresh` — 07:00 CET → `POST /cron/refresh` (fetches all sport events)
  - `push-notify` — every 30 min → `POST /cron/notify` (sends push notifications)

## Sport categories
`f1`, `ajax`, `az`, `mvdp_road`, `mvdp_cx`, `mvdp_mtb`, `pp_road`, `pp_cx`

## Key files
- `backend/src/lib/firestore.ts` — all DB helpers incl. push subscriptions
- `backend/src/lib/push.ts` — web-push / VAPID setup
- `backend/src/routes/cron.ts` — `/refresh` and `/notify` endpoints
- `backend/src/routes/notifications.ts` — push subscribe/unsubscribe API
- `backend/src/routes/preferences.ts` — sport preferences with `seenSports` logic
- `frontend/src/components/EventCard.tsx` — event card with LIVE badge
- `frontend/src/app/settings/page.tsx` — sport toggles + push notification settings
- `frontend/src/lib/api.ts` — all backend API calls incl. push subscribe
- `frontend/worker/push.ts` — service worker push event handler
- `frontend/next.config.ts` — PWA config with `customWorkers: ['worker/push.ts']`

## Important decisions / known issues
- **`ignoreUndefinedProperties: true`** set on Firestore db — required because `match.venue` from football-data.org API can be `undefined`, which would crash Firestore writes
- **`seenSports` pattern** in preferences: on GET, only auto-adds sports the user has never seen (truly new sports). On PUT, always writes `seenSports = ALL_SPORTS`. Prevents sports from reappearing after user disables them.
- **F1 color is green** (`#15803d`) — changed from red to avoid clash with football red
- **UI language is Dutch** throughout (date-fns `nl` locale, all labels translated)
- **VAPID keys** stored as GitHub Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. Frontend gets `NEXT_PUBLIC_VAPID_PUBLIC_KEY` as build arg.
- **PWA icons** — `frontend/public/icons/icon-192.png` and `icon-512.png` are referenced in `manifest.json` but still need actual PNG files from the user

## GitHub Secrets in use
`GCP_PROJECT_ID`, `GCP_SA_KEY`, `FRONTEND_URL`, `BACKEND_URL`, `ZENROWS_API_KEY`, `CRON_SECRET`, `FIREBASE_SERVICE_ACCOUNT` (GCP secret), `FOOTBALL_DATA_API_KEY` (GCP secret), `NEXT_PUBLIC_FIREBASE_*` (6 keys), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
