import { auth } from './firebase';
import type { SportEvent, UserPreferences } from '@/types/events';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
}

export async function fetchEvents(from?: Date, to?: Date): Promise<SportEvent[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from.toISOString());
  if (to) params.set('to', to.toISOString());

  const res = await authFetch(`/api/events?${params}`);
  if (!res.ok) throw new Error('Failed to fetch events');
  const data = await res.json();
  return data.events as SportEvent[];
}

export async function fetchPreferences(): Promise<UserPreferences> {
  const res = await authFetch('/api/preferences');
  if (!res.ok) throw new Error('Failed to fetch preferences');
  return res.json();
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  const res = await authFetch('/api/preferences', {
    method: 'PUT',
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error('Failed to save preferences');
}
