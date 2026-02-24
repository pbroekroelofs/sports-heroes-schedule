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
  /** Internal — which sports existed when the user last saved. Used to auto-enable truly new sports. */
  seenSports?: SportCategory[];
}
