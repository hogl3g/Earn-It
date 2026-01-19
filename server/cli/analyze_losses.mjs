import * as fs from "fs";

const data = JSON.parse(fs.readFileSync("data/results/grades_20260117.json", "utf-8"));

const graded = data.rows.filter((r) => r.a_score > 0);
const losses = graded.filter((r) => r.won === false);

console.log(`\n=== TOP 10 LOSSES (worst edge detection) ===\n`);

losses
  .sort((a, b) => Math.abs(a.margin - a.market_spread) - Math.abs(b.margin - b.market_spread))
  .slice(0, 10)
  .forEach((loss) => {
    console.log(`${loss.team_a} vs ${loss.team_b}`);
    console.log(`  Market spread: ${loss.market_spread}, Model: ${loss.model_spread}`);
    console.log(`  Actual margin: ${loss.margin} (${loss.team_a} ${loss.a_score} - ${loss.team_b} ${loss.b_score})`);
    console.log(`  Covered: ${loss.covered} | Loss: $${Math.abs(loss.profit).toFixed(2)}\n`);
  });

console.log(`\n=== ANALYSIS ===`);
console.log(`Total losses: ${losses.length}`);
console.log(`Avg model edge: ${(losses.reduce((sum, r) => sum + r.model_spread, 0) / losses.length).toFixed(2)}`);
console.log(`Avg market spread: ${(losses.reduce((sum, r) => sum + r.market_spread, 0) / losses.length).toFixed(2)}`);

const badEdge = losses.filter((r) => Math.abs(r.model_spread) < 3);
console.log(`\nPicks with weak edge (<3 pts): ${badEdge.length}`);
console.log(`Win rate on weak edge: ${(badEdge.filter((r) => r.won).length / badEdge.length * 100).toFixed(1)}%`);
