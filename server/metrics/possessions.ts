import type { TeamRecord } from "../../shared/sports_schema";

function extractTempo(team: TeamRecord): number {
  return (
    team?.kenpom?.tempo ??
    team?.metrics?.possessions_per_game ??
    team?.stats?.possessions_per_game ??
    70
  );
}

export function computeProjectedPossessions(teamA: TeamRecord, teamB: TeamRecord): number {
  const tempoA = extractTempo(teamA);
  const tempoB = extractTempo(teamB);
  return (tempoA + tempoB) / 2;
}

export default { computeProjectedPossessions };
