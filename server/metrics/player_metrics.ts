import type { TeamRecord } from "../../shared/sports_schema";

/**
 * Player Impact Score (PIS) = Usage × Efficiency × Minutes%
 * - usage: decimal (e.g., 0.20 for 20% usage)
 * - efficiency: rating or rate (e.g., points per possession or TS%, as a decimal or rating depending on convention)
 * - minutesPercent: decimal of team minutes (e.g., 0.25 for 25% of minutes)
 *
 * This module provides small helpers that accept sensible defaults and
 * computes per-player PIS values and a team mapping of `playerImpactScores`.
 */

export function computePIS(usage: number, efficiency: number, minutesPercent: number): number {
  const u = Number.isFinite(usage) ? usage : 0;
  const e = Number.isFinite(efficiency) ? efficiency : 0;
  const m = Number.isFinite(minutesPercent) ? minutesPercent : 0;
  return u * e * m;
}

export function computePlayerPISFromStats(stats: { usage?: number; efficiency?: number; minutes?: number }, teamMinutes = 240) {
  const usage = stats.usage ?? 0.15;
  const efficiency = stats.efficiency ?? (stats['ts_pct'] ?? 0.55);
  const minutes = stats.minutes ?? 20;
  const minutesPercent = minutes / teamMinutes;
  return computePIS(usage, efficiency, minutesPercent);
}

export function computeTeamPlayerImpactScores(
  players: Array<{ id: string; usage?: number; efficiency?: number; minutes?: number }>,
  teamMinutes = 240
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of players) {
    out[p.id] = computePlayerPISFromStats({ usage: p.usage, efficiency: p.efficiency, minutes: p.minutes }, teamMinutes);
  }
  return out;
}

export function attachPlayerImpactScoresToTeam(team: TeamRecord, players: Array<{ id: string; usage?: number; efficiency?: number; minutes?: number }>, teamMinutes = 240) {
  const scores = computeTeamPlayerImpactScores(players, teamMinutes);
  team.metrics = team.metrics ?? {};
  (team.metrics as any).player_impact_scores = scores;
  return scores;
}

export default { computePIS, computePlayerPISFromStats, computeTeamPlayerImpactScores, attachPlayerImpactScoresToTeam };

// -----------------------------
// Player availability / team adjustment helpers
// -----------------------------

export function computeTeamAvailabilitySumFromScores(scores: Record<string, number>, availability: Record<string, number> | undefined) {
  let sum = 0;
  for (const id of Object.keys(scores)) {
    const flag = availability && typeof availability[id] === 'number' ? availability[id] : 1;
    sum += (scores[id] || 0) * flag;
  }
  return sum;
}

export function computeTeamAvailabilityAdjustment(team: TeamRecord, availability: Record<string, number> | undefined) {
  const scores: Record<string, number> = (team.metrics && (team.metrics as any).player_impact_scores) || {};
  return computeTeamAvailabilitySumFromScores(scores, availability);
}

export const DEFAULT_STARTER_OUT_IMPACT: Record<string, number> = {
  // Primary scorer: range -2.0 to -3.0 — use midpoint -2.5 by default
  primary: -2.5,
  // Secondary scorer
  secondary: -1.0,
  // Defensive anchor
  defensive: -1.5,
};

/**
 * Compute player availability delta in points.
 * - `availability` is a mapping id -> availability factor (0..1). Missing keys treated as 1.
 * - `roleMap` is an optional mapping id -> role (e.g., 'primary'|'secondary'|'defensive').
 * When a player is marked fully out (availability[id] === 0) and a role is provided,
 * the corresponding default starter-out impact (points) will be applied in addition
 * to the delta derived from player impact scores.
 */
export function computePlayerAvailabilityDelta(
  team: TeamRecord,
  availability: Record<string, number> | undefined,
  roleMap?: Record<string, string>
) {
  const scores: Record<string, number> = (team.metrics && (team.metrics as any).player_impact_scores) || {};
  const fullAvailability: Record<string, number> = {};
  for (const id of Object.keys(scores)) fullAvailability[id] = 1;
  const fullSum = computeTeamAvailabilitySumFromScores(scores, fullAvailability);
  const currentSum = computeTeamAvailabilitySumFromScores(scores, availability);

  // Base delta from player impact scores (likely negative when players are missing)
  let delta = currentSum - fullSum;

  // Apply role-based fixed impacts for starters explicitly marked out
  if (roleMap && availability) {
    for (const id of Object.keys(scores)) {
      const avail = typeof availability[id] === 'number' ? availability[id] : 1;
      if (avail === 0) {
        const role = roleMap[id];
        if (role && typeof DEFAULT_STARTER_OUT_IMPACT[role] === 'number') {
          delta += DEFAULT_STARTER_OUT_IMPACT[role];
        }
      }
    }
  }

  return delta;
}
