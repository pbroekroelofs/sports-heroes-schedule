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

export interface SportEvent {
  id: string;
  sport: SportCategory;
  title: string;
  competition: string;
  startTime: string; // ISO 8601 UTC
  endTime?: string;  // ISO 8601 UTC
  location?: string;
  sourceUrl?: string;
  fetchedAt: string; // ISO 8601 UTC
}

export interface UserPreferences {
  sports: SportCategory[];
  timezone: string;
}
