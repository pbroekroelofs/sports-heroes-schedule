'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAuth } from '@/app/providers';
import {
  fetchPreferences,
  savePreferences,
  fetchPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/api';
import { SPORT_LABELS, SPORT_COLORS, type SportCategory } from '@/types/events';

const ALL_SPORTS: SportCategory[] = ['f1', 'ajax', 'az', 'mvdp_road', 'mvdp_cx', 'mvdp_mtb', 'pp_road', 'pp_cx'];

const SPORT_ICONS: Record<SportCategory, string> = {
  f1: '🏎️',
  ajax: '⚽',
  az: '⚽',
  mvdp_road: '🚴',
  mvdp_cx: '🚵',
  mvdp_mtb: '⛰️',
  pp_road: '🚴',
  pp_cx: '🚵',
};

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const { data: prefs, mutate } = useSWR(user ? 'preferences' : null, fetchPreferences);

  const [selected, setSelected] = useState<Set<SportCategory>>(new Set(ALL_SPORTS));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Notification state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [notifSports, setNotifSports] = useState<Set<SportCategory>>(new Set());
  const [pushLoading, setPushLoading] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (prefs) setSelected(new Set(prefs.sports));
  }, [prefs]);

  // Check push support and load existing subscription
  useEffect(() => {
    if (!user) return;
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) return;
    setPushSupported(true);
    fetchPushSubscription()
      .then((sub) => {
        if (sub) {
          setPushEnabled(true);
          setNotifSports(new Set(sub.sports));
        }
      })
      .catch(() => {});
  }, [user]);

  function toggle(sport: SportCategory) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sport)) {
        next.delete(sport);
      } else {
        next.add(sport);
      }
      return next;
    });
    setSaved(false);
  }

  function toggleNotifSport(sport: SportCategory) {
    setNotifSports((prev: Set<SportCategory>) => {
      const next = new Set(prev);
      if (next.has(sport)) {
        next.delete(sport);
      } else {
        next.add(sport);
      }
      return next;
    });
    setNotifSaved(false);
  }

  async function handleSave() {
    if (!prefs) return;
    setSaving(true);
    try {
      const updated = { ...prefs, sports: [...selected] };
      await savePreferences(updated);
      await mutate(updated, false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert('Opslaan mislukt. Probeer het opnieuw.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePush() {
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert('Meldingen geweigerd. Sta meldingen toe in je browserinstellingen.');
          return;
        }
        await subscribeToPush([...notifSports]);
        setPushEnabled(true);
      }
    } catch {
      alert('Meldingen instellen mislukt. Probeer het opnieuw.');
    } finally {
      setPushLoading(false);
    }
  }

  async function saveNotifSports() {
    setPushLoading(true);
    try {
      await subscribeToPush([...notifSports]);
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 2000);
    } catch {
      alert('Opslaan mislukt. Probeer het opnieuw.');
    } finally {
      setPushLoading(false);
    }
  }

  const activeSports = ALL_SPORTS.filter((s) => selected.has(s));

  return (
    <div className="px-4 py-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Instellingen</h1>
      <p className="text-slate-400 text-sm mb-6">Kies welke sporten in je agenda verschijnen</p>

      <div className="space-y-2 mb-8">
        {ALL_SPORTS.map((sport) => {
          const colors = SPORT_COLORS[sport];
          const isOn = selected.has(sport);
          return (
            <button
              key={sport}
              onClick={() => toggle(sport)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                isOn
                  ? `bg-slate-800 ${colors.border} border-l-4 border-t border-r border-b border-slate-700`
                  : 'bg-slate-900 border border-slate-800 opacity-50'
              }`}
            >
              <span className="text-2xl">{SPORT_ICONS[sport]}</span>
              <span className="flex-1 text-left text-white font-medium">{SPORT_LABELS[sport]}</span>
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isOn ? `${colors.badge} border-transparent` : 'border-slate-600'
                }`}
              >
                {isOn && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || selected.size === 0}
        className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
          saved
            ? 'bg-green-600'
            : 'bg-sky-600 hover:bg-sky-500 disabled:opacity-50'
        }`}
      >
        {saved ? '✓ Opgeslagen' : saving ? 'Opslaan…' : 'Opslaan'}
      </button>

      {selected.size === 0 && (
        <p className="text-amber-400 text-xs text-center mt-3">
          Selecteer minimaal één sport om wedstrijden te zien
        </p>
      )}

      {/* ── Notifications ─────────────────────────────────────────────────── */}
      {pushSupported && (
        <div className="mt-8 pt-6 border-t border-slate-800">
          <h2 className="text-lg font-semibold text-white mb-1">Meldingen</h2>
          <p className="text-slate-400 text-sm mb-4">
            Ontvang een melding 30 minuten voor aanvang
          </p>

          {/* Enable / disable toggle */}
          <div className="flex items-center justify-between bg-slate-800 rounded-xl p-4 mb-4">
            <span className="text-white font-medium">Push-meldingen</span>
            <button
              onClick={togglePush}
              disabled={pushLoading}
              className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${
                pushEnabled ? 'bg-sky-600' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  pushEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Per-sport notification selection */}
          {pushEnabled && activeSports.length > 0 && (
            <>
              <p className="text-slate-500 text-xs mb-3">Kies voor welke sporten je meldingen wilt</p>
              <div className="space-y-2 mb-4">
                {activeSports.map((sport) => {
                  const isOn = notifSports.has(sport);
                  return (
                    <button
                      key={sport}
                      onClick={() => toggleNotifSport(sport)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                        isOn
                          ? 'bg-slate-800 border-slate-600'
                          : 'bg-slate-900 border-slate-800 opacity-50'
                      }`}
                    >
                      <span className="text-xl">{SPORT_ICONS[sport]}</span>
                      <span className="flex-1 text-left text-white text-sm">{SPORT_LABELS[sport]}</span>
                      <span
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          isOn ? 'bg-sky-600 border-sky-600' : 'border-slate-600'
                        }`}
                      >
                        {isOn && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={saveNotifSports}
                disabled={pushLoading || notifSports.size === 0}
                className={`w-full py-2.5 rounded-xl font-semibold text-white text-sm transition-all ${
                  notifSaved
                    ? 'bg-green-600'
                    : 'bg-slate-700 hover:bg-slate-600 disabled:opacity-50'
                }`}
              >
                {notifSaved ? '✓ Opgeslagen' : pushLoading ? 'Opslaan…' : 'Meldingen opslaan'}
              </button>

              {notifSports.size === 0 && (
                <p className="text-amber-400 text-xs text-center mt-2">
                  Selecteer minimaal één sport voor meldingen
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-slate-800">
        <p className="text-slate-500 text-xs">
          Ingelogd als{' '}
          <span className="text-slate-400">{user?.email ?? user?.displayName}</span>
        </p>
      </div>
    </div>
  );
}
