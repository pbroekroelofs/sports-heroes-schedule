export type SportCategory =
  | 'f1'
  | 'ajax'
  | 'mvdp_road'
  | 'mvdp_cx'
  | 'mvdp_mtb';

export const SPORT_LABELS: Record<SportCategory, string> = {
  f1: 'Formula 1',
  ajax: 'Ajax',
  mvdp_road: 'MvdP – Road',
  mvdp_cx: 'MvdP – Cyclocross',
  mvdp_mtb: 'MvdP – MTB',
};

// Tailwind colour classes for each sport
export const SPORT_COLORS: Record<SportCategory, { border: string; badge: string; text: string }> =
  {
    f1: { border: 'border-f1', badge: 'bg-f1', text: 'text-f1' },
    ajax: { border: 'border-ajax', badge: 'bg-ajax', text: 'text-ajax' },
    mvdp_road: { border: 'border-mvdp-road', badge: 'bg-mvdp-road', text: 'text-mvdp-road' },
    mvdp_cx: { border: 'border-mvdp-cx', badge: 'bg-mvdp-cx', text: 'text-mvdp-cx' },
    mvdp_mtb: { border: 'border-mvdp-mtb', badge: 'bg-mvdp-mtb', text: 'text-mvdp-mtb' },
  };

export interface SportEvent {
  id: string;
  sport: SportCategory;
  title: string;
  competition: string;
  startTime: string; // ISO 8601 UTC
  endTime?: string;
  location?: string;
  sourceUrl?: string;
  fetchedAt: string;
}

export interface UserPreferences {
  sports: SportCategory[];
  timezone: string;
}
