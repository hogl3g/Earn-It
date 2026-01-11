import { simulate_game } from "../sim/simulate";
import { compare_teams } from "../sim/compare";
import type { TeamRecord } from "../../shared/sports_schema";

// Lightweight mock loaders — replace with real adapters when available
export async function load_team_ratings(date: string): Promise<Record<string, TeamRecord>> {
  // In a real implementation we'd load from persisted ratings or an API.
  // Here we return a small set of stubbed TeamRecord objects keyed by team name.
  const stub = (name: string): TeamRecord => ({ id: name, metrics: { offensive_efficiency: 105, defensive_efficiency: 98 } } as any);
  return {
    "Ohio State": stub("Ohio State"),
    "Nebraska": stub("Nebraska"),
    "Oregon": stub("Oregon"),
    "Rutgers": stub("Rutgers"),
    "Texas Southern": stub("Texas Southern"),
    "Grambling State": stub("Grambling State"),
  };
}

export async function load_player_availability(): Promise<Record<string, Record<string, number>>> {
  // team -> playerId -> availability (0..1). Mock no injuries.
  return {};
}

export type MarketLine = {
  team_a: string;
  team_b: string;
  spread?: number; // positive means team_a favored by this many points (convention may vary)
  over_under?: number;
};

export async function get_market_lines(requests: Array<[string, string]>): Promise<MarketLine[]> {
  // Replace with real scraped / purchased lines. We'll mock some values.
  const map: Record<string, { spread?: number; over_under?: number }> = {
    "Ohio State:Nebraska": { spread: -4.5, over_under: 142.5 },
    "Oregon:Rutgers": { spread: 3.0, over_under: 150.0 },
    "Texas Southern:Grambling State": { spread: -12.5, over_under: 135.0 },
  };
  return requests.map(([a, b]) => ({ team_a: a, team_b: b, ...(map[`${a}:${b}`] ?? {}) }));
}

async function main() {
  const ratings = await load_team_ratings("2026-01-05");
  const marketLines = await get_market_lines([
    ["Ohio State", "Nebraska"],
    ["Oregon", "Rutgers"],
    ["Texas Southern", "Grambling State"],
  ]);

  for (const game of marketLines) {
    const teamA = ratings[game.team_a] ?? ({ id: game.team_a } as TeamRecord);
    const teamB = ratings[game.team_b] ?? ({ id: game.team_b } as TeamRecord);

    // Run deterministic compare to get projected possessions and model spread
    const comp = compare_teams(teamA, teamB, false, 2000, game.spread);

    // Run Monte Carlo sim for probabilities
    const sim = simulate_game(teamA, teamB, false, 5000);

    // Compute cover prob (teamA margin > market spread)
    const coverProb = Array.isArray(sim.samples) && typeof game.spread === "number"
      ? sim.samples.filter(m => m > game.spread!).length / sim.samples.length
      : undefined;

    // Over probability (simulated total > market over)
    const overProb = Array.isArray(sim.totals) && typeof game.over_under === "number"
      ? sim.totals.filter(t => t > game.over_under!).length / sim.totals.length
      : undefined;

    // Model total using possessions * (A PPP + B PPP) (deterministic)
    const possessions = comp.projected_possessions;
    const adjOffA = teamA.metrics?.offensive_efficiency ?? 100;
    const adjDefA = teamA.metrics?.defensive_efficiency ?? 100;
    const adjOffB = teamB.metrics?.offensive_efficiency ?? 100;
    const adjDefB = teamB.metrics?.defensive_efficiency ?? 100;
    const expectedA = possessions * (adjOffA / 100) * (adjDefB / 100);
    const expectedB = possessions * (adjOffB / 100) * (adjDefA / 100);
    const modelTotal = expectedA + expectedB;

    console.log(`\nGame: ${game.team_a} vs ${game.team_b}`);
    console.log(`Model Spread: ${Number((comp.projected_spread ?? sim.mean).toFixed(1))}`);
    console.log(`Cover Prob (A covers): ${coverProb === undefined ? "n/a" : (coverProb * 100).toFixed(1) + "%"}`);
    console.log(`Over Prob: ${overProb === undefined ? "n/a" : (overProb * 100).toFixed(1) + "%"}`);
    console.log(`Model Total: ${Number(modelTotal.toFixed(1))}`);
    console.log(`Market Spread: ${game.spread ?? "n/a"} Total: ${game.over_under ?? "n/a"}`);
  }
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
