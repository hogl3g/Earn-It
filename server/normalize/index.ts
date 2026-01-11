import type { RawTeamPayload, TeamRecord } from "../../shared/sports_schema";

export function normalizeTeam(raw: RawTeamPayload): TeamRecord {
  const possessions = raw.team_stats?.possessions_per_game ?? raw.kenpom?.tempo ?? 70;
  const offensive = raw.kenpom?.adj_offense ?? raw.team_stats?.offensive_rating ?? undefined;
  const defensive = raw.kenpom?.adj_defense ?? raw.team_stats?.defensive_rating ?? undefined;
  const adj_rating = typeof offensive === "number" && typeof defensive === "number"
    ? offensive - defensive
    : raw.kenpom?.adj_margin;

  const metrics = {
    possessions_per_game: possessions,
    offensive_efficiency: offensive ?? undefined,
    defensive_efficiency: defensive ?? undefined,
    adj_rating: adj_rating ?? undefined,
    player_impact_scores: {},
  };

  return {
    id: raw.team_id,
    kenpom: raw.kenpom,
    stats: raw.team_stats,
    metrics,
    betting: raw.betting_profile,
    raw,
  };
}

export default { normalizeTeam };
