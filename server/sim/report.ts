import type { TeamRecord } from "../../shared/sports_schema";
import { compare_teams } from "./compare";

function fmtPct(x: number) {
  return (x * 100).toFixed(1) + "%";
}

export interface MatchupReport {
  matchup: string;
  simulated_win_prob: { teamA: string; teamB: string };
  projected_score: { teamA: number; teamB: number };
  market_spread?: number;
  model_spread: number;
  edge?: number;
  market_total?: number;
  simulated_mean_total?: number;
  over_hit_rate?: string;
  spread_edge?: number;
  total_edge?: number;
  simulated_cover_prob?: number;
}

export function generateMatchupReport(teamA: TeamRecord, teamB: TeamRecord, neutral = false, sims = 5000, marketSpread?: number, marketTotal?: number): MatchupReport {
  const comp = compare_teams(teamA, teamB, neutral, sims, marketSpread);

  // Recompute expected points per team using projected possessions and efficiencies
  const possessions = comp.projected_possessions;
  const adjOffA = teamA.metrics?.offensive_efficiency ?? teamA.stats?.offensive_rating ?? 100;
  const adjDefA = teamA.metrics?.defensive_efficiency ?? teamA.stats?.defensive_rating ?? 100;
  const adjOffB = teamB.metrics?.offensive_efficiency ?? teamB.stats?.offensive_rating ?? 100;
  const adjDefB = teamB.metrics?.defensive_efficiency ?? teamB.stats?.defensive_rating ?? 100;

  const expectedA = possessions * (adjOffA / 100) * (adjDefB / 100);
  const expectedB = possessions * (adjOffB / 100) * (adjDefA / 100);

  // Use projected spread (Model Spread = Team A Rating - Team B Rating) when available,
  // otherwise fall back to simulation mean.
  const modelSpread = typeof comp.projected_spread === 'number' ? comp.projected_spread : comp.simulation.mean;

  // If marketSpread not provided, try teamA.betting.average_spread
  const market = typeof marketSpread === "number" ? marketSpread : (teamA.betting?.average_spread ?? undefined);

  const edge = typeof market === "number" ? modelSpread - market : undefined;

  // Compute model total using possessions × (A PPP + B PPP)
  // where A PPP = expectedA / possessions, B PPP = expectedB / possessions.
  const baseTotal = expectedA + expectedB; // this equals possessions * (A PPP + B PPP)
  // Adjust projected team scores so teamA - teamB == modelSpread while preserving total
  const teamAScore = baseTotal / 2 + modelSpread / 2;
  const teamBScore = baseTotal / 2 - modelSpread / 2;

  // Determine market total: prefer explicit argument, then team betting data
  const market_total = typeof marketTotal === "number" ? marketTotal : (teamA.betting?.over_under ?? teamB.betting?.over_under ?? undefined);

  // Model total (deterministic) and over-hit rate
  const simulated_mean_total = baseTotal;
  let over_hit_rate: string | undefined = undefined;
  const totals = comp.simulation.totals ?? [];
  if (typeof market_total === "number" && totals.length > 0) {
    const hits = totals.filter(t => t > market_total).length;
    over_hit_rate = Math.round((hits / totals.length) * 100) + "%";
  }

  // Simulated cover probability for teamA covering the market spread
  let simulated_cover_prob: number | undefined = undefined;
  const samples = comp.simulation.samples ?? [];
  if (typeof market === "number" && samples.length > 0) {
    const coverHits = samples.filter(m => m > market).length;
    simulated_cover_prob = coverHits / samples.length;
  }

  return {
    matchup: `${teamA.id} vs ${teamB.id}`,
    simulated_win_prob: { teamA: fmtPct(comp.simulation.prob_teamA_win), teamB: fmtPct(1 - comp.simulation.prob_teamA_win) },
    projected_score: { teamA: Number(teamAScore.toFixed(1)), teamB: Number(teamBScore.toFixed(1)) },
    market_spread: market,
    model_spread: Number(modelSpread.toFixed(1)),
    edge: typeof edge === "number" ? Number(edge.toFixed(1)) : undefined,
    market_total: typeof market_total === "number" ? Number(market_total) : undefined,
    simulated_mean_total: typeof simulated_mean_total === "number" ? Number(simulated_mean_total.toFixed(1)) : undefined,
    total_edge: typeof market_total === "number" && typeof simulated_mean_total === "number" ? Number((simulated_mean_total - market_total).toFixed(1)) : undefined,
    over_hit_rate,
    spread_edge: typeof market === "number" ? Number((modelSpread - market).toFixed(1)) : undefined,
    simulated_cover_prob: typeof simulated_cover_prob === "number" ? Number(simulated_cover_prob.toFixed(3)) : undefined,
  };
}

export default { generateMatchupReport };
