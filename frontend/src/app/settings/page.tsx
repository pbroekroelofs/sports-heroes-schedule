'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAuth } from '@/app/providers';
import { fetchPreferences, savePreferences } from '@/lib/api';
import { SPORT_LABELS, SPORT_COLORS, type SportCategory } from '@/types/events';

const ALL_SPORTS: SportCategory[] = ['f1', 'ajax', 'mvdp_road', 'mvdp_cx', 'mvdp_mtb'];

const SPORT_ICONS: Record<SportCategory, string> = {
  f1: '🏎️',
  ajax: '⚽',
  mvdp_road: '🚴',
  mvdp_cx: '🚵',
  mvdp_mtb: '⛰️',
};

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const { data: prefs, mutate } = useSWR(user ? 'preferences' : null, fetchPreferences);

  const [selected, setSelected] = useState<Set<SportCategory>>(
    new Set(['f1', 'ajax', 'mvdp_road', 'mvdp_cx', 'mvdp_mtb'])
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (prefs) setSelected(new Set(prefs.sports));
  }, [prefs]);

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
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
      <p className="text-slate-400 text-sm mb-6">Choose which sports appear in your schedule</p>

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
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save preferences'}
      </button>

      {selected.size === 0 && (
        <p className="text-amber-400 text-xs text-center mt-3">
          Select at least one sport to see events
        </p>
      )}

      <div className="mt-10 pt-6 border-t border-slate-800">
        <p className="text-slate-500 text-xs">
          Signed in as{' '}
          <span className="text-slate-400">{user?.email ?? user?.displayName}</span>
        </p>
      </div>
    </div>
  );
}
