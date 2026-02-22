export type SportCategory =
  | 'f1'
  | 'ajax'
  | 'az'
  | 'mvdp_road'
  | 'mvdp_cx'
  | 'mvdp_mtb'
  | 'pp_road'
  | 'pp_cx';

export const SPORT_LABELS: Record<SportCategory, string> = {
  f1: 'Formula 1',
  ajax: 'Ajax',
  az: 'AZ',
  mvdp_road: 'MvdP – Road',
  mvdp_cx: 'MvdP – CX',
  mvdp_mtb: 'MvdP – MTB',
  pp_road: 'PP – Road',
  pp_cx: 'PP – CX',
};

// Tailwind colour classes for each sport
export const SPORT_COLORS: Record<SportCategory, { border: string; badge: string; text: string }> =
  {
    f1: { border: 'border-f1', badge: 'bg-f1', text: 'text-f1' },
    ajax: { border: 'border-ajax', badge: 'bg-ajax', text: 'text-ajax' },
    az: { border: 'border-az', badge: 'bg-az', text: 'text-az' },
    mvdp_road: { border: 'border-mvdp-road', badge: 'bg-mvdp-road', text: 'text-mvdp-road' },
    mvdp_cx: { border: 'border-mvdp-cx', badge: 'bg-mvdp-cx', text: 'text-mvdp-cx' },
    mvdp_mtb: { border: 'border-mvdp-mtb', badge: 'bg-mvdp-mtb', text: 'text-mvdp-mtb' },
    pp_road: { border: 'border-pp-road', badge: 'bg-pp-road', text: 'text-pp-road' },
    pp_cx: { border: 'border-pp-cx', badge: 'bg-pp-cx', text: 'text-pp-cx' },
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
