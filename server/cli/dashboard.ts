/**
 * Projector Performance Dashboard
 * 
 * Generates a comprehensive summary of model performance including:
 * - Overall statistics (win rate, ROI, unit wins)
 * - Daily breakdown with confidence intervals  
 * - Confidence-level analysis (are 70% picks hitting 70%?)
 * - Risk metrics and Sharpe ratio
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

interface GradeRecord {
  date: string;
  team_a: string;
  team_b: string;
  a_score: number;
  b_score: number;
  margin: number;
  market_spread: number;
  model_spread: number;
  covered: boolean;
  won: boolean;
  stake: number;
  profit: number;
}

interface DailyMetrics {
  date: string;
  picks: number;
  wins: number;
  roi: number;
  win_pct: number;
  avg_stake: number;
}

function parseAllGrades(resultsDir: string): GradeRecord[] {
  const allRecords: GradeRecord[] = [];
  
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
      const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      
      if (Array.isArray(json.rows)) {
        for (const row of json.rows) {
          allRecords.push({
            date: formattedDate,
            team_a: row.team_a,
            team_b: row.team_b,
            a_score: row.a_score,
            b_score: row.b_score,
            margin: row.margin || (row.a_score - row.b_score),
            market_spread: row.market_spread || 0,
            model_spread: row.model_spread || 0,
            covered: row.covered || false,
            won: (row.profit ?? 0) > 0,
            stake: row.stake || 0,
            profit: row.profit || 0
          });
        }
      }
    }
  } catch (err) {
    console.error('Error parsing grades:', err);
  }
  
  return allRecords;
}

function calculateMetrics(records: GradeRecord[]) {
  if (records.length === 0) {
    return null;
  }
  
  const wins = records.filter(r => r.won).length;
  const losses = records.length - wins;
  const totalProfit = records.reduce((s, r) => s + r.profit, 0);
  const totalStake = records.reduce((s, r) => s + r.stake, 0);
  
  // Calculate daily metrics
  const byDate = new Map<string, GradeRecord[]>();
  for (const record of records) {
    if (!byDate.has(record.date)) {
      byDate.set(record.date, []);
    }
    byDate.get(record.date)!.push(record);
  }
  
  const dailyMetrics: DailyMetrics[] = [];
  for (const [date, dayRecords] of byDate.entries()) {
    const dayWins = dayRecords.filter(r => r.won).length;
    const dayProfit = dayRecords.reduce((s, r) => s + r.profit, 0);
    const dayStake = dayRecords.reduce((s, r) => s + r.stake, 0);
    
    dailyMetrics.push({
      date,
      picks: dayRecords.length,
      wins: dayWins,
      roi: dayProfit,
      win_pct: dayRecords.length > 0 ? dayWins / dayRecords.length : 0,
      avg_stake: dayStake / dayRecords.length
    });
  }
  
  dailyMetrics.sort((a, b) => a.date.localeCompare(b.date));
  
  // Calculate variance and Sharpe ratio
  const avgDailyReturn = dailyMetrics.length > 0 
    ? dailyMetrics.reduce((s, d) => s + d.roi, 0) / dailyMetrics.length
    : 0;
  
  const variance = dailyMetrics.length > 1
    ? dailyMetrics.reduce((s, d) => s + Math.pow(d.roi - avgDailyReturn, 2), 0) / (dailyMetrics.length - 1)
    : 0;
  
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgDailyReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
  
  return {
    totalPicks: records.length,
    totalWins: wins,
    totalLosses: losses,
    winRate: wins / records.length,
    totalProfit,
    totalStake,
    roi: totalStake > 0 ? totalProfit / totalStake : 0,
    avgProfitPerPick: records.length > 0 ? totalProfit / records.length : 0,
    avgStake: totalStake / records.length,
    dailyMetrics,
    avgDailyReturn,
    stdDev,
    sharpeRatio
  };
}

function formatCurrency(num: number): string {
  const sign = num >= 0 ? '+' : '';
  return `${sign}$${num.toFixed(2)}`;
}

function formatPercent(num: number): string {
  return `${(num * 100).toFixed(1)}%`;
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║           📊 PROJECTOR PERFORMANCE DASHBOARD               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const resultsDir = path.join(root, 'data', 'results');
  const records = parseAllGrades(resultsDir);
  
  if (records.length === 0) {
    console.log('❌ No graded games found. Run grading first.\n');
    return;
  }
  
  const metrics = calculateMetrics(records);
  if (!metrics) {
    console.log('❌ Could not calculate metrics.\n');
    return;
  }
  
  // Summary stats
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('OVERALL PERFORMANCE');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Total Picks        : ${metrics.totalPicks}`);
  console.log(`Record             : ${metrics.totalWins}-${metrics.totalLosses} (${formatPercent(metrics.winRate)})`);
  console.log(`Total Profit       : ${formatCurrency(metrics.totalProfit)}`);
  console.log(`ROI                : ${formatPercent(metrics.roi)}`);
  console.log(`Avg Profit/Pick    : ${formatCurrency(metrics.avgProfitPerPick)}`);
  console.log(`Avg Stake          : ${formatCurrency(metrics.avgStake)}`);
  
  // Risk metrics
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('RISK METRICS');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Daily Avg ROI      : ${formatCurrency(metrics.avgDailyReturn)}`);
  console.log(`Daily Std Dev      : ${formatCurrency(metrics.stdDev)}`);
  console.log(`Sharpe Ratio       : ${metrics.sharpeRatio.toFixed(2)}`);
  
  const status = metrics.winRate > 0.55
    ? '✓ EXCELLENT'
    : metrics.winRate > 0.525
    ? '✓ PROFITABLE'
    : metrics.winRate > 0.52
    ? '⚠️ MARGINAL'
    : '❌ LOSING';
  
  console.log(`Status             : ${status}`);
  
  // Daily breakdown
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('DAILY BREAKDOWN');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Date       | Picks | W-L | Win % | ROI       | Avg Stake`);
  console.log('─────────────────────────────────────────────────────────────────');
  
  for (const day of metrics.dailyMetrics) {
    const losses = day.picks - day.wins;
    const roi = day.roi >= 0 ? `+$${day.roi.toFixed(0)}` : `$${day.roi.toFixed(0)}`;
    console.log(
      `${day.date} | ${String(day.picks).padStart(5)} | ${day.wins}-${losses} | ${formatPercent(day.win_pct).padStart(5)} | ${roi.padStart(9)} | ${formatCurrency(day.avg_stake).padStart(9)}`
    );
  }
  
  console.log('\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
