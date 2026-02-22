import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getAuth } from 'firebase-admin/auth';
import { db } from './lib/firestore'; // initialises Firebase Admin as a side-effect
import eventsRouter from './routes/events';
import cronRouter from './routes/cron';
import preferencesRouter from './routes/preferences';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());

// ── Auth middleware ────────────────────────────────────────────────────────────
async function verifyToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = await getAuth().verifyIdToken(token);
    (req as express.Request & { uid: string }).uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true }));
app.use('/api/events', verifyToken, eventsRouter);
app.use('/api/preferences', verifyToken, preferencesRouter);
app.use('/cron', cronRouter); // protected by CRON_SECRET, not Firebase token

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  // Verify DB is reachable on startup
  db.collection('_health').limit(1).get().catch(() => null);
});
