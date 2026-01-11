export interface RawTeamPayload {
  team_id: string;
  rankings?: Record<string, any>;
  kenpom?: KenPomData;
  team_stats?: TeamStats;
  recent_form?: RecentForm;
  betting_profile?: BettingProfile;
  [key: string]: any;
}

export interface KenPomData {
  adj_offense?: number;
  adj_defense?: number;
  tempo?: number;
  adj_margin?: number;
  [key: string]: any;
}

export interface TeamStats {
  games_played?: number;
  points_per_game?: number;
  possessions_per_game?: number;
  offensive_rating?: number;
  defensive_rating?: number;
  [key: string]: any;
}

export interface RecentForm {
  last_n?: number;
  record?: { wins: number; losses: number };
  trends?: any;
}

export interface BettingProfile {
  average_spread?: number;
  implied_win_prob?: number;
  moneyline?: number;
  over_under?: number;
  [key: string]: any;
}

export interface ProcessedMetrics {
  possessions_per_game?: number;
  offensive_efficiency?: number;
  defensive_efficiency?: number;
  adj_rating?: number;
  player_impact_scores?: Record<string, number>;
  [key: string]: any;
}

export interface TeamRecord {
  id: string;
  name?: string;
  kenpom?: KenPomData;
  stats?: TeamStats;
  metrics?: ProcessedMetrics;
  betting?: BettingProfile;
  raw?: RawTeamPayload;
}

export type RawGamePayload = any;

export type RawPlayerPayload = any;
