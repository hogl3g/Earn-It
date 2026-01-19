import * as fs from "fs";

const data = JSON.parse(fs.readFileSync("data/results/grades_20260117.json", "utf-8"));

const graded = data.rows.filter((r) => r.a_score > 0);
const wins = graded.filter((r) => r.won === true).length;
const losses = graded.filter((r) => r.won === false).length;

console.log(`Total graded: ${graded.length}`);
console.log(`Wins: ${wins}`);
console.log(`Losses: ${losses}`);
console.log(`Win rate: ${(wins / graded.length * 100).toFixed(1)}%`);
console.log(`Profit: $${graded.reduce((sum, r) => sum + r.profit, 0).toFixed(2)}`);
