/**
 * Closing Line Value (CLV) Tracker
 * 
 * Measures if your model captures line movement and gets better odds than the closing line.
 * Positive CLV indicates the model identified value before sharp money moved the line.
 * 
 * CLV = (Model Line - Closing Line) × Units Won
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

interface ClvRecord {
  date: string;
  team_a: string;
  team_b: string;
  market_spread_open: number;  // Opening line (your model line estimate)
  market_spread_close: number; // Closing line
  actual_margin: number;       // Final margin
  units_won: number;          // Stake in units
  clv_points: number;         // (Model - Closing) spread difference
  clv_dollars: number;        // CLV × units_won
  hit: boolean;
}

interface ClvSummary {
  totalPicks: number;
  totalClv: number;
  avgClv: number;
  clvPerWin: number;
  clvPerLoss: number;
  winsWithClv: number;
  winsAgainstClv: number;
  lossesWithClv: number;
  lossesAgainstClv: number;
  sharpnessScore: number; // % of wins with positive CLV
}

function parseGradeData(resultsDir: string): ClvRecord[] {
  const records: ClvRecord[] = [];
  
  try {
    const files = fs.readdirSync(resultsDir);
    const gradeFiles = files.filter(f => f.startsWith('grades_') && f.endsWith('.json'));
    
    for (const file of gradeFiles) {
      const filePath = path.join(resultsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(content);
      
      const dateMatch = file.match(/grades_(\d{8})/);
      if (!dateMatch) continue;
      
      const dateStr = dateMatch[1];
      const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      
      if (Array.isArray(json.rows)) {
        for (const row of json.rows) {
          const margin = row.a_score - row.b_score;
          const marketSpread = row.market_spread || 0;
          const modelSpread = row.model_spread || 2.5; // Default assumption
          const stake = row.stake || 100;
          const units = stake / 100; // Normalize to units
          const hit = (row.profit ?? 0) > 0;
          
          // CLV calculation: positive if we got better line than closing line
          // For favorites: we want model_spread to be higher (more favorable)
          // For underdogs: we want model_spread to be lower (more favorable)
          const clvPoints = modelSpread - marketSpread;
          const clvDollars = clvPoints * (stake / Math.abs(marketSpread || 1));
          
          records.push({
            date,
            team_a: row.team_a,
            team_b: row.team_b,
            market_spread_open: modelSpread,
            market_spread_close: marketSpread,
            actual_margin: margin,
            units_won: units,
            clv_points: clvPoints,
            clv_dollars: clvDollars,
            hit
          });
        }
      }
    }
  } catch (err) {
    console.error('Error parsing grade data:', err);
  }
  
  return records;
}

function calculateClvMetrics(records: ClvRecord[]): ClvSummary {
  if (records.length === 0) {
    return {
      totalPicks: 0,
      totalClv: 0,
      avgClv: 0,
      clvPerWin: 0,
      clvPerLoss: 0,
      winsWithClv: 0,
      winsAgainstClv: 0,
      lossesWithClv: 0,
      lossesAgainstClv: 0,
      sharpnessScore: 0
    };
  }
  
  const wins = records.filter(r => r.hit);
  const losses = records.filter(r => !r.hit);
  
  const totalClv = records.reduce((s, r) => s + r.clv_dollars, 0);
  const winClv = wins.reduce((s, r) => s + r.clv_dollars, 0);
  const lossClv = losses.reduce((s, r) => s + r.clv_dollars, 0);
  
  const winsWithClv = wins.filter(r => r.clv_dollars > 0).length;
  const winsAgainstClv = wins.filter(r => r.clv_dollars <= 0).length;
  const lossesWithClv = losses.filter(r => r.clv_dollars > 0).length;
  const lossesAgainstClv = losses.filter(r => r.clv_dollars <= 0).length;
  
  return {
    totalPicks: records.length,
    totalClv,
    avgClv: totalClv / records.length,
    clvPerWin: wins.length > 0 ? winClv / wins.length : 0,
    clvPerLoss: losses.length > 0 ? lossClv / losses.length : 0,
    winsWithClv,
    winsAgainstClv,
    lossesWithClv,
    lossesAgainstClv,
    sharpnessScore: wins.length > 0 ? (winsWithClv / wins.length) : 0
  };
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║              📈 CLOSING LINE VALUE (CLV) ANALYSIS           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const resultsDir = path.join(root, 'data', 'results');
  const records = parseGradeData(resultsDir);
  
  if (records.length === 0) {
    console.log('❌ No grade data found\n');
    return;
  }
  
  const metrics = calculateClvMetrics(records);
  
  // Summary
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('CLV SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Total Picks              : ${metrics.totalPicks}`);
  console.log(`Total CLV                : $${metrics.totalClv.toFixed(2)}`);
  console.log(`Average CLV/Pick         : $${metrics.avgClv.toFixed(2)}`);
  console.log(`Avg CLV on Wins          : $${metrics.clvPerWin.toFixed(2)}`);
  console.log(`Avg CLV on Losses        : $${metrics.clvPerLoss.toFixed(2)}`);
  
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('SHARPNESS ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Wins with Positive CLV   : ${metrics.winsWithClv}/${metrics.winsWithClv + metrics.winsAgainstClv} (${(metrics.sharpnessScore * 100).toFixed(1)}%)`);
  console.log(`Losses with Positive CLV : ${metrics.lossesWithClv}/${metrics.lossesWithClv + metrics.lossesAgainstClv}`);
  console.log(`Sharpness Score          : ${metrics.sharpnessScore > 0.60 ? '✓ SHARP' : metrics.sharpnessScore > 0.50 ? '~ MODERATE' : '✗ DULL'}`);
  
  // Interpretation
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('INTERPRETATION');
  console.log('═══════════════════════════════════════════════════════════════════');
  
  if (metrics.totalClv > 100) {
    console.log('✓ Positive CLV: Your model identifies value before sharp money');
  } else if (metrics.totalClv < -100) {
    console.log('✗ Negative CLV: You\'re buying the peak line (chasing movement)');
  } else {
    console.log('~ Neutral CLV: Mix of early identification and late chasing');
  }
  
  if (metrics.sharpnessScore > 0.60) {
    console.log('✓ Most wins have positive CLV: Sharp angle selection');
  } else if (metrics.lossesWithClv > metrics.winsWithClv) {
    console.log('⚠️ More losses with positive CLV: May be early on worse picks');
  }
  
  // Record sample
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('SAMPLE PICKS (Top CLV)')
  console.log('═══════════════════════════════════════════════════════════════════');
  
  const topClv = records.sort((a, b) => b.clv_dollars - a.clv_dollars).slice(0, 5);
  console.log(`Date       | Teams                    | Spread | CLV    | Hit`);
  console.log('───────────────────────────────────────────────────────────────────');
  
  for (const rec of topClv) {
    const teams = `${rec.team_a} vs ${rec.team_b}`.padEnd(24);
    const clv = `$${rec.clv_dollars.toFixed(0)}`.padStart(6);
    const status = rec.hit ? '✓' : '✗';
    console.log(`${rec.date} | ${teams} | ${rec.clv_points.toFixed(1)}  | ${clv} | ${status}`);
  }
  
  console.log('\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
