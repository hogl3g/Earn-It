import { generateRecommendation } from "../reporting/recommendation";
import { stakePercent } from "../decision/stake";

// Demo values (from your example)
const matchup = "Kansas vs Baylor";
const marketSpread = -4.5;
const modelSpread = -7.2;
const edge = modelSpread - marketSpread; // +2.7
const simulatedCoverProb = 0.598; // 59.8%
const confidenceScore = 81; // example

// Assume decimal odds (e.g., -110 => 1.91) and a small bankroll used to show units
const oddsDecimal = 1.91;
const bankroll = 3.5; // units such that stakePercent * bankroll ~ 1.35

const stakeFrac = stakePercent(simulatedCoverProb, oddsDecimal, 1);
const stakeUnits = Math.round(stakeFrac * bankroll * 100) / 100;

console.log(`Game: ${matchup}`);
console.log("Simulated Cover Probability:", (simulatedCoverProb * 100).toFixed(1) + "%");
console.log("");
console.log(`Market Spread: Kansas ${marketSpread}`);
console.log(`Model Spread: Kansas ${modelSpread}`);
console.log(`Edge: ${edge > 0 ? "+" : ""}${edge.toFixed(1)} points`);
console.log("");
console.log(`Recommended Bet: Kansas ${marketSpread}`);
console.log(`Confidence Score: ${confidenceScore}`);
console.log(`Stake: ${stakeUnits} units`);

export default {};
