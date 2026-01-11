import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { simulate_game } from "../sim/simulate";
import { compare_teams } from "../sim/compare";
import type { TeamRecord } from "../../shared/sports_schema";

function stubTeam(name: string): TeamRecord {
  return { id: name, metrics: { offensive_efficiency: 105, defensive_efficiency: 98 } } as any;
}

async function runBacktest(startDate?: string, endDate?: string) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const csvPath = path.resolve(__dirname, "../../data/raw/odds_history.csv");
  const txt = await fs.readFile(csvPath, "utf8");
  const rows = txt.split(/\r?\n/).filter(r => r.trim());
  const header = rows.shift()!.split(",");
  const records = rows.map(r => {
    const cols = r.split(",");
    const obj: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = cols[i] ?? "";
    return obj;
  });

  const filtered = records.filter(r => {
    if (startDate && r.date < startDate) return false;
    if (endDate && r.date > endDate) return false;
    return r.final_margin !== "" && !isNaN(Number(r.final_margin));
  });

  let n = 0;
  let correct = 0;
  let brierSum = 0;

  for (const r of filtered) {
    const teamA = stubTeam(r.team_a);
    const teamB = stubTeam(r.team_b);
    const comp = compare_teams(teamA, teamB, false, 2000, r.spread ? Number(r.spread) : undefined);
    const sim = simulate_game(teamA, teamB, false, 2000);
    const coverProb = Array.isArray(sim.samples) ? sim.samples.filter(m => m > (r.spread ? Number(r.spread) : 0)).length / sim.samples.length : undefined;
    const realized = Number(r.final_margin) > (r.spread ? Number(r.spread) : 0) ? 1 : 0;
    if (coverProb !== undefined) {
      n += 1;
      if ((coverProb >= 0.5 && realized === 1) || (coverProb < 0.5 && realized === 0)) correct += 1;
      brierSum += Math.pow((coverProb - realized), 2);
    }
  }

  const accuracy = n ? (correct / n) : 0;
  const brier = n ? (brierSum / n) : 0;

  const outPath = path.resolve(__dirname, "../../data/results/ts_backtest_report.csv");
  const csv = `games,accuracy,brier\n${n},${accuracy.toFixed(4)},${brier.toFixed(6)}\n`;
  await fs.writeFile(outPath, csv, "utf8");
  console.log(`Wrote TypeScript backtest report to ${outPath}`);
}

if (import.meta && (import.meta as any).main) {
  const args = process.argv.slice(2);
  const start = args[0];
  const end = args[1];
  runBacktest(start, end).catch(err => { console.error(err); process.exit(1); });
}
