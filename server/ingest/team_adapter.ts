import type { RawTeamPayload, TeamRecord } from "../../shared/sports_schema";

export function ingestTeamPayload(payload: any): RawTeamPayload {
  return payload as RawTeamPayload;
}

export function toTeamRecord(raw: RawTeamPayload): TeamRecord {
  const possessions = raw.team_stats?.possessions_per_game ?? raw.kenpom?.tempo ?? 70;
  const offensive = raw.kenpom?.adj_offense ?? raw.team_stats?.offensive_rating ?? undefined;
  const defensive = raw.kenpom?.adj_defense ?? raw.team_stats?.defensive_rating ?? undefined;
  const adj_rating = typeof offensive === "number" && typeof defensive === "number"
    ? offensive - defensive
    : raw.kenpom?.adj_margin;

  return {
    id: raw.team_id,
    kenpom: raw.kenpom,
    stats: raw.team_stats,
    metrics: {
      possessions_per_game: possessions,
      offensive_efficiency: offensive,
      defensive_efficiency: defensive,
      adj_rating: adj_rating,
      player_impact_scores: {},
    },
    betting: raw.betting_profile,
    raw,
  };
}

export default { ingestTeamPayload, toTeamRecord };
