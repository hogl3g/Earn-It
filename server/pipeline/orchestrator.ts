import fs from "fs";
import path from "path";
import { ingestGamePayload } from "../ingest/game_adapter";
import { ingestMarketPayload } from "../ingest/market_adapter";
import { attachPlayerImpactScoresToTeam, computeTeamAvailabilityAdjustment } from "../metrics/player_metrics";
import { computePowerRating, computeBaseRating, computeAdjustedRating } from "../metrics/power_ratings";
import { compare_teams } from "../sim/compare";
import { generateMatchupReport } from "../sim/report";
import { generateRecommendation } from "../reporting/recommendation";

async function dataPull() {
  // Placeholder: load sample files from `attached_assets/` or call external APIs
  // For now, return empty arrays or load static JSON if present.
  return { games: [], markets: [] };
}

async function featureBuild() {
  // Placeholder: normalize data, compute PIS, attach to teams
  return {};
}

async function powerRatings(teams: any[], availability?: Record<string, Record<string, number>>) {
  // Compute ratings and return mapping
  const out: Record<string, any> = {};
  for (const t of teams) {
    const base = computeBaseRating(t);
    const availDelta = availability && availability[t.id] ? computeTeamAvailabilityAdjustment(t, availability[t.id]) : 0;
    const adjusted = computeAdjustedRating(t, { isHome: false, playerAvailabilityDelta: availDelta });
    out[t.id] = { base, adjusted };
  }
  return out;
}

async function runSimulation(teamA: any, teamB: any) {
  const comp = compare_teams(teamA, teamB, false, 2000);
  const report = generateMatchupReport(teamA, teamB, false, 2000, teamA.betting?.average_spread, teamA.betting?.over_under);
  const rec = generateRecommendation(report);
  return { comp, report, rec };
}

export async function runDailyPipeline() {
  console.log("Pipeline: starting data pull...");
  const { games, markets } = await dataPull();

  console.log("Pipeline: building features...");
  await featureBuild();

  console.log("Pipeline: computing power ratings...");
  // placeholder teams load
  const teams: any[] = [];
  const ratings = await powerRatings(teams);

  console.log("Pipeline: running simulations & edge detection...");
  const results: any[] = [];
  // iterate matchups (placeholder)
  for (const gm of games) {
    // placeholder team lookup
    const teamA = { id: gm.home } as any;
    const teamB = { id: gm.away } as any;
    const r = await runSimulation(teamA, teamB);
    results.push(r);
  }

  console.log("Pipeline: filtering bets and producing bet cards...");
  // Placeholder: filter results.rec by rec.recommended

  console.log("Pipeline: writing outputs...");
  const outDir = path.resolve(__dirname, "..", "reports");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `daily_report_${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ results, ratings }, null, 2));

  console.log("Pipeline: done. Reports written to", outPath);
  return { outPath, results };
}

if (require.main === module) {
  runDailyPipeline().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export default { runDailyPipeline };
