import type { TeamRecord } from "../../shared/sports_schema";

// Lightweight KenPom-like adjustments placeholder
export function computeKenPomAdjustments(team: TeamRecord, leagueAvgTempo = 70) {
  const tempo = team.kenpom?.tempo ?? team.metrics?.possessions_per_game ?? leagueAvgTempo;
  const adjOff = team.kenpom?.adj_offense ?? team.metrics?.offensive_efficiency ?? 100;
  const adjDef = team.kenpom?.adj_defense ?? team.metrics?.defensive_efficiency ?? 100;
  const adjMargin = typeof adjOff === "number" && typeof adjDef === "number" ? adjOff - adjDef : team.kenpom?.adj_margin;

  return { tempo, adjOff, adjDef, adjMargin };
}

export default { computeKenPomAdjustments };
