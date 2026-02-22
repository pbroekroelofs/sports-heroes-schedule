# Sports Schedule PWA — Setup Guide

Follow these steps in order. Estimated time: 2–3 hours on first run.

---

## Prerequisites

Install these tools before starting:

- [Node.js 22+](https://nodejs.org)
- [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com)

---

## Step 1 — Google Cloud Project

```bash
# Log in to your Google account
gcloud auth login

# Create the project (choose a unique project ID)
gcloud projects create sports-schedule-pvb --name="Sports Schedule"

# Set it as default
gcloud config set project sports-schedule-pvb

# Link billing account (required even for free tier)
# Go to: https://console.cloud.google.com/billing
# Link the project to your billing account there.

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com

# Create Artifact Registry repo for Docker images
gcloud artifacts repositories create sports-schedule \
  --repository-format=docker \
  --location=europe-west4 \
  --description="Sports schedule container images"
```

---

## Step 2 — Firebase Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → select the GCP project `sports-schedule-pvb`
3. Disable Google Analytics (not needed) → **Create project**

### Enable Authentication

4. In Firebase Console → **Authentication** → **Get started**
5. Enable **Email/Password** provider
6. Enable **Google** provider
   - Set support email to `pbroekroelofs@gmail.com`

### Enable Firestore

7. **Firestore Database** → **Create database**
8. Choose **production mode**
9. Location: **europe-west4** (Netherlands)

### Create Firestore indexes

In **Firestore → Indexes → Composite**, add:

| Collection | Field 1 | Field 2 | Order |
|---|---|---|---|
| `events` | `startTime` (Asc) | — | Ascending |

> The app queries events by `startTime` range — this index is required.

### Get Firebase config keys

10. **Project settings** (gear icon) → **General** → scroll to **Your apps**
11. Click **Add app** → Web → register as `sports-schedule-web`
12. Copy the `firebaseConfig` object — you'll need these values later:
    - `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`

### Create Service Account for backend

```bash
# Create service account
gcloud iam service-accounts create sports-schedule-backend \
  --display-name="Sports Schedule Backend"

# Grant Firestore access
gcloud projects add-iam-policy-binding sports-schedule-pvb \
  --member="serviceAccount:sports-schedule-backend@sports-schedule-pvb.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

# Download the key (keep this safe — never commit it)
gcloud iam service-accounts keys create service-account.json \
  --iam-account=sports-schedule-backend@sports-schedule-pvb.iam.gserviceaccount.com
```

---

## Step 3 — External API Keys

### football-data.org (Ajax matches)

1. Go to [football-data.org](https://www.football-data.org/client/register)
2. Register for a free account
3. Your API key is shown in the dashboard
4. Free tier: 10 requests/minute — sufficient for daily refresh

### OpenF1 (Formula 1)

No API key needed. OpenF1 is completely free and open.

---

## Step 4 — Store Secrets in Secret Manager

```bash
# Firebase service account JSON
gcloud secrets create firebase-service-account \
  --data-file=service-account.json

# Cron secret (generate a random string)
echo -n "$(openssl rand -hex 32)" | \
  gcloud secrets create cron-secret --data-file=-

# football-data.org API key
echo -n "YOUR_FOOTBALL_DATA_KEY_HERE" | \
  gcloud secrets create football-data-api-key --data-file=-

# Allow Cloud Run to read secrets
gcloud secrets add-iam-policy-binding firebase-service-account \
  --member="serviceAccount:sports-schedule-backend@sports-schedule-pvb.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding cron-secret \
  --member="serviceAccount:sports-schedule-backend@sports-schedule-pvb.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding football-data-api-key \
  --member="serviceAccount:sports-schedule-backend@sports-schedule-pvb.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Step 5 — GitHub Repository & Secrets

```bash
# Initialise git and push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/sports-schedule.git
git push -u origin main
```

In your GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret name | Value |
|---|---|
| `GCP_PROJECT_ID` | `sports-schedule-pvb` |
| `GCP_SA_KEY` | *(full JSON of a CI service account — see below)* |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | from Firebase config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | from Firebase config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `sports-schedule-pvb` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | from Firebase config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | from Firebase config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | from Firebase config |
| `BACKEND_URL` | *(Cloud Run URL of backend — get after first deploy)* |
| `FRONTEND_URL` | *(Cloud Run URL of frontend — get after first deploy)* |

### Create CI service account

```bash
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions CI"

gcloud projects add-iam-policy-binding sports-schedule-pvb \
  --member="serviceAccount:github-actions@sports-schedule-pvb.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding sports-schedule-pvb \
  --member="serviceAccount:github-actions@sports-schedule-pvb.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding sports-schedule-pvb \
  --member="serviceAccount:github-actions@sports-schedule-pvb.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding sports-schedule-pvb \
  --member="serviceAccount:github-actions@sports-schedule-pvb.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Download key for GitHub secret GCP_SA_KEY
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@sports-schedule-pvb.iam.gserviceaccount.com
```

Paste the contents of `github-actions-key.json` as the `GCP_SA_KEY` GitHub secret.

---

## Step 6 — First Deploy

Push to `main` to trigger the GitHub Actions workflow:

```bash
git push origin main
```

Watch progress at `github.com/YOUR_USERNAME/sports-schedule/actions`.

After deployment succeeds:
1. Get the backend URL: `gcloud run services describe sports-schedule-backend --region europe-west4 --format 'value(status.url)'`
2. Get the frontend URL: `gcloud run services describe sports-schedule-frontend --region europe-west4 --format 'value(status.url)'`
3. Add both as `BACKEND_URL` and `FRONTEND_URL` GitHub secrets
4. Push again to trigger a second deploy with the correct CORS/URL settings

---

## Step 7 — Firebase Auth: Authorised Domains

In Firebase Console → **Authentication → Settings → Authorized domains**:
- Add your frontend Cloud Run domain (e.g. `sports-schedule-frontend-xyz-ew.a.run.app`)
- This is required for Google Sign-in to work

---

## Step 8 — Cloud Scheduler (Daily Refresh)

```bash
# Get your cron secret value
CRON_SECRET=$(gcloud secrets versions access latest --secret=cron-secret)
BACKEND_URL=$(gcloud run services describe sports-schedule-backend --region europe-west4 --format 'value(status.url)')

# Create the daily job (07:00 CET = 06:00 UTC)
gcloud scheduler jobs create http sports-schedule-daily-refresh \
  --location=europe-west4 \
  --schedule="0 6 * * *" \
  --uri="${BACKEND_URL}/cron/refresh" \
  --http-method=POST \
  --headers="X-Cron-Secret=${CRON_SECRET},Content-Type=application/json" \
  --message-body="{}" \
  --time-zone="Europe/Amsterdam"

# Test it immediately
gcloud scheduler jobs run sports-schedule-daily-refresh --location=europe-west4
```

---

## Step 9 — PWA Icons

The PWA needs icons at `frontend/public/icons/icon-192.png` and `icon-512.png`.

Quick way to generate them:
1. Create a 512×512 PNG with your logo (use [Canva](https://canva.com) or similar)
2. Save as `frontend/public/icons/icon-512.png`
3. Resize to 192×192 → `frontend/public/icons/icon-192.png`

Or use [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator):
```bash
npx pwa-asset-generator logo.png frontend/public/icons
```

---

## Step 10 — Local Development

```bash
# Install all dependencies
npm install

# Create frontend env file
cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=sports-schedule-pvb
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=sports-schedule-pvb.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
EOF

# Create backend env file
cat > backend/.env << 'EOF'
FIREBASE_SERVICE_ACCOUNT=<paste single-line JSON of service-account.json>
FOOTBALL_DATA_API_KEY=your_key
CRON_SECRET=dev-secret
FRONTEND_URL=http://localhost:3000
PORT=8080
EOF

# Start both (in separate terminals)
npm run dev:backend
npm run dev:frontend
```

Open [http://localhost:3000](http://localhost:3000)

---

## Billing Estimate (typical personal use)

| Service | Free tier | Likely usage |
|---|---|---|
| Cloud Run (frontend) | 2M req/mo free | ~1K/mo → **free** |
| Cloud Run (backend) | 2M req/mo free | ~500/mo → **free** |
| Firestore | 50K reads/day free | ~1K/day → **free** |
| Firebase Auth | 10K/mo free | ~few → **free** |
| Cloud Scheduler | 3 jobs free | 1 job → **free** |
| Secret Manager | 6 versions free | 3 secrets → **free** |
| **Total** | | **€0–2/month** |

Set a billing alert at **€5** as a safety net:
```bash
# Do this in the Cloud Console UI:
# Billing → Budgets & alerts → Create budget → €5 → 100% alert
```

---

## Adding More Sports Later

To add a new sport (e.g. Dutch national football team):
1. Add the new `SportCategory` type in `backend/src/types/events.ts` and `frontend/src/types/events.ts`
2. Create a fetcher in `backend/src/fetchers/`
3. Call it from `backend/src/routes/cron.ts`
4. Add label/icon/colour in `frontend/src/types/events.ts` and `frontend/src/app/settings/page.tsx`
5. Deploy

---

## Troubleshooting

**Cycling events not showing:** ProCyclingStats may have changed their HTML. Run the backend locally and check the console output from the cycling fetcher. Update the CSS selectors in `backend/src/fetchers/cycling.ts`.

**Ajax matches missing:** Check your `FOOTBALL_DATA_API_KEY`. The free tier only covers certain competitions — verify Ajax's active competitions are covered at [football-data.org/coverage](https://www.football-data.org/coverage).

**Google Sign-in popup blocked on iOS Safari:** Users must allow popups in Safari settings, or use the email/password option instead.

**CORS error in browser:** Ensure `FRONTEND_URL` in the backend Cloud Run service matches your actual frontend URL exactly (no trailing slash).
