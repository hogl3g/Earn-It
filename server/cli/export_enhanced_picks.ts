/**
 * Enhanced Picks Export
 * 
 * Extends picks CSV with:
 * - Confidence intervals on cover probability
 * - Kelly fraction sizing recommendations
 * - CLV expectations based on historical accuracy
 * - Risk/reward analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

interface EnhancedPick {
  date: string;
  team_a: string;
  team_b: string;
  market_spread: number;
  model_spread: number;
  coverProb: number;
  coverProb_calibrated?: number;
  coverProb_lower: number;  // 95% CI lower bound
  coverProb_upper: number;  // 95% CI upper bound
  confidence: string;        // LOW/MEDIUM/HIGH
  kelly_fraction: number;    // Recommended Kelly stake %
  kelly_units: number;       // Units to wager (assuming $100 unit)
  expected_roi: number;      // Expected ROI if this probability is accurate
  edge: number;
  ev_per_1: number;
  stake_dollars: number;
}

function readPicks(filePath: string): any[] {
  if (!fs.existsSync(filePath)) return [];
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj: Record<string, any> = {};
    
    header.forEach((key, i) => {
      const val = values[i];
      obj[key] = isNaN(Number(val)) ? val : Number(val);
    });
    
    return obj;
  });
}

function calculateConfidenceInterval(prob: number, sampleSize: number = 30): { lower: number; upper: number } {
  // Wilson score interval (better for extreme probabilities)
  const z = 1.96; // 95% CI
  const denominator = 1 + (z * z) / sampleSize;
  const center = (prob + (z * z) / (2 * sampleSize)) / denominator;
  const adjustment = z * Math.sqrt((prob * (1 - prob) + (z * z) / (4 * sampleSize)) / sampleSize) / denominator;
  
  return {
    lower: Math.max(0.5, center - adjustment),
    upper: Math.min(1.0, center + adjustment)
  };
}

function calculateKelly(probability: number, odds: number): number {
  // Kelly criterion: f* = (p * odds - 1) / (odds - 1)
  // where f* is the fraction of bankroll to bet
  // Limited to max 25% for safety
  
  const decimalOdds = Math.abs(odds) / 100 + 1; // Convert American to decimal
  const kelly = (probability * decimalOdds - 1) / (decimalOdds - 1);
  
  // Return half Kelly for safety (reduces volatility)
  return Math.max(0, Math.min(0.25, kelly / 2));
}

function calculateExpectedRoi(prob: number, winAmount: number, lossAmount: number): number {
  // E[ROI] = p * win - (1-p) * loss
  return (prob * winAmount) - ((1 - prob) * lossAmount);
}

function enhancePicks(picks: any[], calib?: { a: number; b: number } | null): EnhancedPick[] {
  return picks.map(pick => {
    const baseProb = pick.coverProb || 0.5;
    const prob = calib ? Math.max(0.01, Math.min(0.99, calib.a + calib.b * baseProb)) : baseProb;
    const ci = calculateConfidenceInterval(prob);
    const odds = pick.market_spread || 0;
    const kelly = calculateKelly(prob, odds);
    const expectedRoi = calculateExpectedRoi(prob, pick.ev_per_1 || 0.27, -0.90);
    
    // Confidence level
    let confidence = 'LOW';
    if (prob > 0.65) confidence = 'HIGH';
    else if (prob > 0.55) confidence = 'MEDIUM';
    
    return {
      date: pick.date,
      team_a: pick.team_a,
      team_b: pick.team_b,
      market_spread: pick.market_spread || 0,
      model_spread: pick.model_spread || 0,
      coverProb: baseProb,
      coverProb_calibrated: calib ? prob : undefined,
      coverProb_lower: ci.lower,
      coverProb_upper: ci.upper,
      confidence,
      kelly_fraction: kelly,
      kelly_units: kelly * 100, // Assuming $100 unit, stakes in dollars
      expected_roi: expectedRoi,
      edge: pick.edge || 0,
      ev_per_1: pick.ev_per_1 || 0,
      stake_dollars: pick.stake_dollars || 0
    };
  });
}

async function main() {
  const resultsDir = path.join(root, 'data', 'results');
  const picksPath = path.join(resultsDir, 'ts_projector_picks.csv');
  const outputPath = path.join(resultsDir, 'enhanced_picks_with_ci.csv');
  
  const picks = readPicks(picksPath);
  if (picks.length === 0) {
    console.log('❌ No picks found');
    return;
  }
  
  // Load probability calibration if available
  const calibPath = path.join(resultsDir, 'prob_calibration.json');
  let calib: { a: number; b: number } | null = null;
  if (fs.existsSync(calibPath)) {
    try {
      const j = JSON.parse(fs.readFileSync(calibPath, 'utf8'));
      if (typeof j.a === 'number' && typeof j.b === 'number') {
        // Guard against degenerate calibration where all outcomes were same
        if (!(j.a === 1 && j.b === 0)) {
          calib = { a: j.a, b: j.b };
        }
      }
    } catch {}
  }

  const enhanced = enhancePicks(picks, calib);
  
  // Generate CSV
  const headers = [
    'date',
    'team_a',
    'team_b',
    'market_spread',
    'model_spread',
    'cover_prob',
    'cover_prob_calibrated',
    'cover_prob_ci_lower',
    'cover_prob_ci_upper',
    'confidence',
    'kelly_fraction',
    'kelly_dollars',
    'expected_roi',
    'edge',
    'ev_per_1',
    'stake_dollars'
  ];
  
  const rows = enhanced.map(p => [
    p.date,
    p.team_a,
    p.team_b,
    p.market_spread.toFixed(2),
    p.model_spread.toFixed(2),
    p.coverProb.toFixed(4),
    (p.coverProb_calibrated ?? p.coverProb).toFixed(4),
    p.coverProb_lower.toFixed(4),
    p.coverProb_upper.toFixed(4),
    p.confidence,
    p.kelly_fraction.toFixed(4),
    p.kelly_units.toFixed(2),
    p.expected_roi.toFixed(4),
    p.edge.toFixed(4),
    p.ev_per_1.toFixed(4),
    p.stake_dollars.toFixed(2)
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  fs.writeFileSync(outputPath, csv);
  
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║         ✨ ENHANCED PICKS WITH CONFIDENCE INTERVALS           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`✓ Generated: ${outputPath}`);
  console.log(`\nTotal Picks: ${enhanced.length}`);
  
  // Summary by confidence
  const high = enhanced.filter(p => p.confidence === 'HIGH');
  const medium = enhanced.filter(p => p.confidence === 'MEDIUM');
  const low = enhanced.filter(p => p.confidence === 'LOW');
  
  console.log(`  HIGH Confidence (>65%):   ${high.length} picks | Avg Stake: $${(high.reduce((s, p) => s + p.stake_dollars, 0) / high.length).toFixed(0)}`);
  console.log(`  MEDIUM Confidence (55-65%): ${medium.length} picks | Avg Stake: $${(medium.reduce((s, p) => s + p.stake_dollars, 0) / medium.length || 0).toFixed(0)}`);
  console.log(`  LOW Confidence (<55%):    ${low.length} picks | Avg Stake: $${(low.reduce((s, p) => s + p.stake_dollars, 0) / low.length || 0).toFixed(0)}`);
  
  // Show samples
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TOP PICKS (By Expected ROI)');
  console.log('═══════════════════════════════════════════════════════════════════');
  
  const topByRoi = enhanced.sort((a, b) => b.expected_roi - a.expected_roi).slice(0, 5);
  console.log(`Team A vs Team B           | CP    | CI 95%      | Kelly  | E[ROI]`);
  console.log('───────────────────────────────────────────────────────────────────');
  
  for (const pick of topByRoi) {
    const teams = `${pick.team_a} vs ${pick.team_b}`.padEnd(26);
    const cp = `${(pick.coverProb * 100).toFixed(1)}%`.padStart(5);
    const ci = `[${(pick.coverProb_lower * 100).toFixed(0)}-${(pick.coverProb_upper * 100).toFixed(0)}%]`.padStart(11);
    const kelly = `${(pick.kelly_fraction * 100).toFixed(1)}%`.padStart(6);
    const roi = `${(pick.expected_roi * 100).toFixed(1)}%`.padStart(6);
    
    console.log(`${teams} | ${cp} | ${ci} | ${kelly} | ${roi}`);
  }
  
  console.log('\nℹ️  Notes:');
  console.log('  • CI = 95% Confidence Interval on cover probability');
  console.log('  • Kelly = Recommended bet size as % of bankroll');
  console.log('  • E[ROI] = Expected return if probability is accurate');
  console.log('\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
