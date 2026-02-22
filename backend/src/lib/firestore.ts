import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { SportEvent, UserPreferences } from '../types/events';

function initFirebase() {
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
    initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  }
  return getFirestore();
}

export const db = initFirebase();

export async function upsertEvent(event: SportEvent): Promise<void> {
  await db.collection('events').doc(event.id).set(
    {
      ...event,
      startTime: new Date(event.startTime),
      endTime: event.endTime ? new Date(event.endTime) : null,
      fetchedAt: new Date(event.fetchedAt),
    },
    { merge: true }
  );
}

export async function getEvents(from: Date, to: Date): Promise<SportEvent[]> {
  const snapshot = await db
    .collection('events')
    .where('startTime', '>=', from)
    .where('startTime', '<=', to)
    .orderBy('startTime', 'asc')
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      startTime: (data.startTime as Timestamp).toDate().toISOString(),
      endTime: data.endTime ? (data.endTime as Timestamp).toDate().toISOString() : undefined,
      fetchedAt: (data.fetchedAt as Timestamp).toDate().toISOString(),
    } as SportEvent;
  });
}

export async function getUserPreferences(uid: string): Promise<UserPreferences | null> {
  const doc = await db
    .collection('users')
    .doc(uid)
    .collection('preferences')
    .doc('main')
    .get();
  return doc.exists ? (doc.data() as UserPreferences) : null;
}

export async function setUserPreferences(uid: string, prefs: UserPreferences): Promise<void> {
  await db.collection('users').doc(uid).collection('preferences').doc('main').set(prefs);
}

// Deletes cycling events with invalid race names (e.g. pure numbers like "1", "140")
// that were stored by earlier scraper versions without proper filtering.
export async function purgeInvalidCyclingEvents(): Promise<number> {
  const sports = ['mvdp_road', 'mvdp_cx', 'mvdp_mtb'];
  let deleted = 0;
  for (const sport of sports) {
    const snapshot = await db.collection('events').where('sport', '==', sport).get();
    const invalid = snapshot.docs.filter((doc) => !/[a-zA-Z]/.test(doc.data().competition ?? ''));
    if (invalid.length === 0) continue;
    const batch = db.batch();
    invalid.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += invalid.length;
  }
  return deleted;
}
