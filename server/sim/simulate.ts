import type { TeamRecord } from "../../shared/sports_schema";
import { computeProjectedPossessions } from "../metrics/possessions";

function randn_bm(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function safeEff(team: TeamRecord, key: "offensive_efficiency" | "defensive_efficiency") {
  return team?.metrics?.[key] ?? 100;
}

export interface SimulationResult {
  samples: number[]; // margins: teamA - teamB
  totals: number[]; // game totals: teamA + teamB
  mean: number; // mean margin
  sd: number; // sd margin
  mean_total: number;
  sd_total: number;
  prob_teamA_win: number;
}

export function simulate_game(teamA: TeamRecord, teamB: TeamRecord, neutral = false, sims = 5000): SimulationResult {
  const possessions = computeProjectedPossessions(teamA, teamB);

  const adjOffA = safeEff(teamA, "offensive_efficiency");
  const adjDefA = safeEff(teamA, "defensive_efficiency");
  const adjOffB = safeEff(teamB, "offensive_efficiency");
  const adjDefB = safeEff(teamB, "defensive_efficiency");

  // Expected points per team using simple interaction of offense and opponent defense
  const expectedA = possessions * (adjOffA / 100) * (adjDefB / 100);
  const expectedB = possessions * (adjOffB / 100) * (adjDefA / 100);

  // Home-court advantage (if not neutral): add HCA to teamA expected points
  const HCA = neutral ? 0 : 3.5;
  const muA = expectedA + HCA;
  const muB = expectedB;

  // Simple game-to-game variability (std dev). Use a conservative default.
  const sigmaA = 12;
  const sigmaB = 12;

  const samples: number[] = [];
  const totals: number[] = [];
  let winsA = 0;
  let sum = 0;

  for (let i = 0; i < sims; i++) {
    const scoreA = muA + randn_bm() * sigmaA;
    const scoreB = muB + randn_bm() * sigmaB;
    const margin = scoreA - scoreB;
    const total = scoreA + scoreB;
    samples.push(margin);
    totals.push(total);
    sum += margin;
    if (margin > 0) winsA += 1;
  }

  const mean = sum / sims;
  const variance = samples.reduce((s, v) => s + (v - mean) * (v - mean), 0) / sims;
  const sd = Math.sqrt(variance);
  const mean_total = totals.reduce((s, v) => s + v, 0) / sims;
  const variance_total = totals.reduce((s, v) => s + (v - mean_total) * (v - mean_total), 0) / sims;
  const sd_total = Math.sqrt(variance_total);
  const prob_teamA_win = winsA / sims;

  return { samples, totals, mean, sd, mean_total, sd_total, prob_teamA_win };
}

export function simulate_without_player(
  team: TeamRecord,
  player_id: string,
  opponent?: TeamRecord,
  neutral = false,
  sims = 5000
): SimulationResult {
  // Clone team and remove player's estimated impact from team metrics.
  const impactScores = team?.metrics?.player_impact_scores ?? {};
  const impact = typeof impactScores[player_id] === "number" ? impactScores[player_id] : 2; // default estimate

  const offensive = team?.metrics?.offensive_efficiency ?? team?.stats?.offensive_rating ?? 100;
  const defensive = team?.metrics?.defensive_efficiency ?? team?.stats?.defensive_rating ?? 100;
  const adj_rating = team?.metrics?.adj_rating ?? team?.kenpom?.adj_margin ?? (offensive - defensive);

  // Interpret `impact` as net rating contribution (points per 100 possessions).
  // Removing a positive-impact player reduces net rating; split impact roughly between offense and defense.
  const delta = impact;
  const newOff = offensive - delta * 0.5;
  const newDef = defensive + delta * 0.5;
  const newAdj = adj_rating - delta;

  const teamClone: TeamRecord = {
    ...team,
    metrics: {
      ...(team.metrics ?? {}),
      offensive_efficiency: newOff,
      defensive_efficiency: newDef,
      adj_rating: newAdj,
    },
  };

  // If opponent provided, run a full game sim; otherwise simulate team points vs league-average defense.
  if (opponent) {
    return simulate_game(teamClone, opponent, neutral, sims);
  }

  // Simulate team-only points against league-average defense (100) to estimate scoring impact.
  const possessions = computeProjectedPossessions(teamClone, teamClone);
  const muTeam = possessions * (teamClone.metrics!.offensive_efficiency! / 100) * (100 / 100);
  const muLeague = possessions * (100 / 100);
  const sigma = 12;
  const samples: number[] = [];
  const totals: number[] = [];
  let wins = 0;
  let sum = 0;
  for (let i = 0; i < sims; i++) {
    const pts = muTeam + randn_bm() * sigma;
    const leaguePts = muLeague + randn_bm() * sigma;
    const margin = pts - leaguePts;
    const total = pts + leaguePts;
    samples.push(margin);
    totals.push(total);
    sum += margin;
    if (margin > 0) wins += 1;
  }
  const mean = sum / sims;
  const variance = samples.reduce((s, v) => s + (v - mean) * (v - mean), 0) / sims;
  const sd = Math.sqrt(variance);
  const mean_total = totals.reduce((s, v) => s + v, 0) / sims;
  const variance_total = totals.reduce((s, v) => s + (v - mean_total) * (v - mean_total), 0) / sims;
  const sd_total = Math.sqrt(variance_total);
  const prob_team_win = wins / sims;
  return { samples, totals, mean, sd, mean_total, sd_total, prob_teamA_win: prob_team_win };
}

export default { simulate_game, simulate_without_player };
