import type { TeamRecord } from "../../shared/sports_schema";

export interface PowerRatingOptions {
  isHome?: boolean;
  hca?: number;
  recentScale?: number;
}

// Team Power Rating = (AdjO – AdjD) + HCA + Recent Form Adjustment
export function computeBaseRating(team: TeamRecord): number {
  const adjOff = team.kenpom?.adj_offense ?? team.metrics?.offensive_efficiency ?? 100;
  const adjDef = team.kenpom?.adj_defense ?? team.metrics?.defensive_efficiency ?? 100;
  return adjOff - adjDef;
}

export interface AdjustedRatingOptions extends PowerRatingOptions {
  playerAvailabilityDelta?: number; // points to add/subtract based on player availability (net rating delta)
}

/**
 * computeAdjustedRating implements:
 * Adjusted Rating = (AdjO - AdjD)
 *                 + Home Court Advantage (±2.5 default)
 *                 + Recent Form Adjustment (±1.5 per recentNet default)
 *                 + Injury / Player Availability Delta
 */
export function computeAdjustedRating(team: TeamRecord, opts: AdjustedRatingOptions = {}): number {
  const { isHome = false, hca = 2.5, recentScale = 1.5, playerAvailabilityDelta = 0 } = opts;

  const base = computeBaseRating(team);
  const homeAdj = isHome ? hca : 0;
  const recentNet = team.recent_form?.record ? (team.recent_form.record.wins - team.recent_form.record.losses) : 0;
  const recentAdj = recentNet * recentScale;

  // Adjusted Rating = Base Rating + Home Court Advantage + Recent Form Adjustment + Player Availability Delta
  return base + homeAdj + recentAdj + playerAvailabilityDelta;
}

export function computePowerRating(team: TeamRecord, opts: AdjustedRatingOptions = {}): number {
  return computeAdjustedRating(team, opts);
}


export function computeProjectedSpread(
  teamA: TeamRecord,
  teamB: TeamRecord,
  isTeamAHome = false,
  recentScale = 1.0
): number {
  // Model Spread = Team A Rating - Team B Rating
  const a = computePowerRating(teamA, { isHome: isTeamAHome, recentScale });
  const b = computePowerRating(teamB, { isHome: !isTeamAHome, recentScale });
  return a - b;
}


