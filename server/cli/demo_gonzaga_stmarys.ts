import { stakePercent } from "../decision/stake";

// Demo values from your example
const matchup = "Gonzaga vs St. Mary's";
const marketTotal = 136.5;
const modelTotal = 142.1;
const overHitRate = 0.62; // 62%
const bet = `Over ${marketTotal}`;
const confidenceScore = 78; // example

// Use decimal odds and choose bankroll so stake ~1.1 units
const oddsDecimal = 1.91;
const bankroll = 2.6;

const stakeFrac = stakePercent(overHitRate, oddsDecimal, 1);
const stakeUnits = Math.round(stakeFrac * bankroll * 100) / 100;

console.log(`Game: ${matchup}`);
console.log(`Total Line: ${marketTotal}`);
console.log(`Model Total: ${modelTotal}`);
console.log(`Over Hit Rate (Simulated): ${(overHitRate * 100).toFixed(0)}%`);
console.log("");
console.log(`Bet: ${bet}`);
console.log(`Confidence Score: ${confidenceScore}`);
console.log(`Stake: ${stakeUnits} units`);

export default {};
