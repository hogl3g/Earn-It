import type { TeamRecord } from "../../shared/sports_schema";
import { computeProjectedPossessions } from "../metrics/possessions";
import { computePowerRating, computeProjectedSpread } from "../metrics/power_ratings";
import { simulate_game } from "./simulate";
import { computeEdge } from "../market/edge";

export interface TeamComparison {
  projected_possessions: number;
  teamA: {
    id: string;
    possessions?: number;
    offensive_efficiency?: number;
    defensive_efficiency?: number;
    adj_rating?: number | undefined;
    power_rating?: number;
  };
  teamB: {
    id: string;
    possessions?: number;
    offensive_efficiency?: number;
    defensive_efficiency?: number;
    adj_rating?: number | undefined;
    power_rating?: number;
  };
  matchup_expected_margin: number; // teamA - teamB
  projected_spread?: number;
  simulation: {
    mean: number;
    sd: number;
    prob_teamA_win: number;
  };
  market?: {
    market_line?: number;
    edge?: number;
  };
}

function getMetric(team: TeamRecord, key: string) {
  return (team as any)?.metrics?.[key] ?? (team as any)?.stats?.[key] ?? undefined;
}

export function compare_teams(teamA: TeamRecord, teamB: TeamRecord, neutral = false, sims = 2000, marketLine?: number): TeamComparison {
  const projected_possessions = computeProjectedPossessions(teamA, teamB);

  const teamA_metrics = {
    id: teamA.id,
    possessions: getMetric(teamA, "possessions_per_game") ?? teamA.metrics?.possessions_per_game,
    offensive_efficiency: getMetric(teamA, "offensive_efficiency"),
    defensive_efficiency: getMetric(teamA, "defensive_efficiency"),
    adj_rating: teamA.metrics?.adj_rating ?? teamA.kenpom?.adj_margin,
    power_rating: undefined as number | undefined,
  };

  const teamB_metrics = {
    id: teamB.id,
    possessions: getMetric(teamB, "possessions_per_game") ?? teamB.metrics?.possessions_per_game,
    offensive_efficiency: getMetric(teamB, "offensive_efficiency"),
    defensive_efficiency: getMetric(teamB, "defensive_efficiency"),
    adj_rating: teamB.metrics?.adj_rating ?? teamB.kenpom?.adj_margin,
    power_rating: undefined as number | undefined,
  };

  // Deterministic expected margin similar to simulate_game's muA - muB
  const adjOffA = teamA_metrics.offensive_efficiency ?? 100;
  const adjDefA = teamA_metrics.defensive_efficiency ?? 100;
  const adjOffB = teamB_metrics.offensive_efficiency ?? 100;
  const adjDefB = teamB_metrics.defensive_efficiency ?? 100;

  const expectedA = projected_possessions * (adjOffA / 100) * (adjDefB / 100);
  const expectedB = projected_possessions * (adjOffB / 100) * (adjDefA / 100);
  const HCA = neutral ? 0 : 3.5;
  const matchup_expected_margin = (expectedA + HCA) - expectedB;

  const sim = simulate_game(teamA, teamB, neutral, sims);

  const result: TeamComparison = {
    projected_possessions,
    teamA: teamA_metrics,
    teamB: teamB_metrics,
    matchup_expected_margin,
    simulation: {
      mean: sim.mean,
      sd: sim.sd,
      prob_teamA_win: sim.prob_teamA_win,
    },
  };

  // compute power ratings and projected spread
  const isTeamAHome = !neutral;
  const prA = computePowerRating(teamA, { isHome: isTeamAHome });
  const prB = computePowerRating(teamB, { isHome: !isTeamAHome });
  result.teamA.power_rating = prA;
  result.teamB.power_rating = prB;
  result.projected_spread = computeProjectedSpread(teamA, teamB, isTeamAHome);

  if (typeof marketLine === "number") {
    const edge = computeEdge(sim.mean, marketLine);
    const spreadEdge = typeof sim.mean === "number" ? sim.mean - marketLine : undefined;
    result.market = { market_line: marketLine, edge, spread_edge: spreadEdge } as any;
  } else if (teamA.betting?.average_spread || teamA.betting?.implied_win_prob || teamB.betting?.average_spread) {
    const market_line = teamA.betting?.average_spread ?? (teamB.betting?.average_spread ? -teamB.betting.average_spread : undefined);
    if (typeof market_line === "number") {
      const edge = computeEdge(sim.mean, market_line);
      const spreadEdge = typeof sim.mean === "number" ? sim.mean - market_line : undefined;
      result.market = { market_line, edge, spread_edge: spreadEdge } as any;
    }
  }

  return result;
}

export default { compare_teams };
