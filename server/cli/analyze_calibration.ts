/**
 * Calibration Analysis: Validate probability estimates against actual results
 * 
 * This tool measures whether your model's probability estimates match reality.
 * For example: Do 70% cover probability picks actually hit 70% of the time?
 * 
 * Usage: npx tsx analyze_calibration.ts
 * 
 * Output: Calibration curves, hit rates by confidence band, ROI analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeTeamName } from '../../shared/team_names.js';
import {
  CONFIDENCE_STRICT_MIN,
  CONFIDENCE_STRICT_LABEL,
  CONFIDENCE_RELAXED_MIN,
  CONFIDENCE_RELAXED_MAX,
  CONFIDENCE_RELAXED_LABEL,
  CONFIDENCE_LOW_LABEL
} from '../../shared/betting_constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

interface PickRecord {
  date: string;
  team_a: string;
  team_b: string;
  market_spread: number;
  model_spread: number;
  coverProb: number;
  impliedProb: number;
  edge: number;
  ev_per_1: number;
  kelly: number;
  stake_dollars: number;
}

interface GradeRecord {
  date: string;
  team_a: string;
  team_b: string;
  a_score: number;
  b_score: number;
  margin: number;
  covered: boolean;
  won: boolean;
  profit: number;
}

interface CalibrationBucket {
  prob_range: string;        // e.g., "55-60%"
  predicted_prob: number;    // midpoint
  num_picks: number;
  hits: number;
  actual_hit_rate: number;
  expected_hits: number;
  calibration_error: number; // |actual - predicted|
  roi: number;
  avg_ev: number;
}

interface MetricsSnapshot {
  date: string;
  total_picks: number;
  total_hits: number;
  hit_rate: number;
  roi: number;
  avg_cover_prob: number;
  avg_ev_per_1: number;
  confidence_distribution: Record<string, number>;
}

function readCsv<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  
  const header = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj: Record<string, any> = {};
    header.forEach((key, i) => {
      const val = values[i]?.trim();
      obj[key] = isNaN(Number(val)) ? val : Number(val);
    });
    return obj as T;
  });
}

function parseGradeFiles(resultsDir: string): Map<string, GradeRecord[]> {
  const map = new Map<string, GradeRecord[]>();
  
  try {
    const files = fs.readdirSync(resultsDir);
    const gradeFiles = files.filter(f => f.startsWith('grades_') && f.endsWith('.json'));
    
    for (const file of gradeFiles) {
      const dateMatch = file.match(/grades_(\d{8})/);
      if (!dateMatch) continue;
      
      const dateStr = dateMatch[1];
      const filePath = path.join(resultsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(content);
      
      const records: GradeRecord[] = [];
      if (Array.isArray(json.rows)) {
        for (const row of json.rows) {
          records.push({
            date: dateStr,
            team_a: row.team_a,
            team_b: row.team_b,
            a_score: row.a_score,
            b_score: row.b_score,
            margin: row.margin,
            covered: row.covered,
            won: row.won,
            profit: row.profit ?? 0
          });
        }
      }
      
      if (records.length > 0) {
        map.set(dateStr, records);
      }
    }
  } catch (err) {
    console.error('Error parsing grade files:', err);
  }
  
  return map;
}

function matchPickToGrade(pick: PickRecord, grades: GradeRecord[]): GradeRecord | null {
  const normalizeName = (name: string) => {
    // Use team name normalization first
    const normalized = normalizeTeamName(name);
    // Then remove all non-alphanumeric for strict matching
    return normalized.toLowerCase().replace(/[^a-z0-9]/g, '');
  };
  
  const pickA = normalizeName(pick.team_a);
  const pickB = normalizeName(pick.team_b);
  
  for (const grade of grades) {
    const gradeA = normalizeName(grade.team_a);
    const gradeB = normalizeName(grade.team_b);
    
    if ((pickA === gradeA && pickB === gradeB) || (pickA === gradeB && pickB === gradeA)) {
      return grade;
    }
  }
  
  return null;
}

function formatDateForGrades(inputDate: string): string {
  // Handle both ISO format: "2026-01-17T18:17:19.207Z"
  // and standard format: "2024-12-01"
  let year, month, day;
  
  if (inputDate.includes('T')) {
    // ISO format
    const date = new Date(inputDate);
    year = date.getUTCFullYear();
    month = String(date.getUTCMonth() + 1).padStart(2, '0');
    day = String(date.getUTCDate()).padStart(2, '0');
  } else if (inputDate.includes('-')) {
    // Standard YYYY-MM-DD format
    const parts = inputDate.split('-');
    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else {
    return inputDate; // Already in correct format
  }
  
  return `${year}${month}${day}`;
}

function analyzeCalibration(picks: PickRecord[], allGrades: Map<string, GradeRecord[]>): CalibrationBucket[] {
  const buckets = new Map<string, CalibrationBucket>();
  // ⚠️  LOCKED THRESHOLDS - NEVER CHANGE - 100% strict and 80% relaxed are non-negotiable
  const bucketRanges = [
    { min: CONFIDENCE_RELAXED_MIN, max: CONFIDENCE_RELAXED_MAX, label: CONFIDENCE_RELAXED_LABEL },
    { min: CONFIDENCE_STRICT_MIN, max: 1.10, label: CONFIDENCE_STRICT_LABEL }
  ];
  
  for (const range of bucketRanges) {
    buckets.set(range.label, {
      prob_range: range.label,
      predicted_prob: (range.min + Math.min(range.max, 0.95)) / 2,
      num_picks: 0,
      hits: 0,
      actual_hit_rate: 0,
      expected_hits: 0,
      calibration_error: 0,
      roi: 0,
      avg_ev: 0
    });
  }
  
  let totalProfit = 0;
  
  for (const pick of picks) {
    const bucket = bucketRanges.find(r => 
      pick.coverProb >= r.min && pick.coverProb < r.max
    );
    
    if (!bucket) continue;
    
    const formattedDate = formatDateForGrades(pick.date);
    const grades = allGrades.get(formattedDate);
    if (!grades) continue;
    
    const grade = matchPickToGrade(pick, grades);
    if (!grade) continue;
    
    const b = buckets.get(bucket.label)!;
    b.num_picks++;
    b.expected_hits += pick.coverProb;
    
    // Determine if pick covered (team_a covering means they're favored in model)
    // If coverProb > 50%, team_a is favored to cover the spread
    let didCover = false;
    if (pick.coverProb > 0.5) {
      // team_a favored to cover
      const actualMargin = grade.a_score - grade.b_score;
      didCover = actualMargin > pick.model_spread;
    } else {
      // team_b favored to cover
      const actualMargin = grade.a_score - grade.b_score;
      didCover = actualMargin <= pick.model_spread;
    }
    
    if (didCover) {
      b.hits++;
    }
    
    b.roi += grade.profit ?? 0;
    totalProfit += grade.profit ?? 0;
  }
  
  // Calculate metrics
  for (const bucket of buckets.values()) {
    if (bucket.num_picks > 0) {
      bucket.actual_hit_rate = bucket.hits / bucket.num_picks;
      bucket.calibration_error = Math.abs(bucket.actual_hit_rate - bucket.predicted_prob);
      bucket.avg_ev = bucket.roi / bucket.num_picks;
    }
  }
  
  return Array.from(buckets.values()).filter(b => b.num_picks > 0);
}

function calculateDailyMetrics(picks: PickRecord[], allGrades: Map<string, GradeRecord[]>): MetricsSnapshot[] {
  const byDate = new Map<string, PickRecord[]>();
  
  for (const pick of picks) {
    if (!byDate.has(pick.date)) {
      byDate.set(pick.date, []);
    }
    byDate.get(pick.date)!.push(pick);
  }
  
  const snapshots: MetricsSnapshot[] = [];
  
  for (const [dateStr, datePicks] of byDate.entries()) {
    const formattedDate = formatDateForGrades(dateStr);
    const grades = allGrades.get(formattedDate) ?? [];
    
    let totalHits = 0;
    let totalProfit = 0;
    const confidenceDist: Record<string, number> = {
      [CONFIDENCE_LOW_LABEL]: 0,
      [CONFIDENCE_RELAXED_LABEL]: 0,
      [CONFIDENCE_STRICT_LABEL]: 0
    };
    
    for (const pick of datePicks) {
      const grade = matchPickToGrade(pick, grades);
      if (!grade) continue;
      
      let didCover = false;
      if (pick.coverProb > 0.5) {
        const actualMargin = grade.a_score - grade.b_score;
        didCover = actualMargin > pick.model_spread;
      } else {
        const actualMargin = grade.a_score - grade.b_score;
        didCover = actualMargin <= pick.model_spread;
      }
      
      if (didCover) totalHits++;
      totalProfit += grade.profit ?? 0;
      
      // Confidence bucket - using locked thresholds
      const cp = pick.coverProb;
      if (cp < CONFIDENCE_RELAXED_MIN) confidenceDist[CONFIDENCE_LOW_LABEL]++;
      else if (cp < CONFIDENCE_STRICT_MIN) confidenceDist[CONFIDENCE_RELAXED_LABEL]++;
      else confidenceDist[CONFIDENCE_STRICT_LABEL]++;
    }
    
    const gradeCount = datePicks.filter(p => matchPickToGrade(p, grades)).length;
    
    snapshots.push({
      date: dateStr,
      total_picks: datePicks.length,
      total_hits: totalHits,
      hit_rate: gradeCount > 0 ? totalHits / gradeCount : 0,
      roi: totalProfit,
      avg_cover_prob: datePicks.reduce((s, p) => s + p.coverProb, 0) / datePicks.length,
      avg_ev_per_1: datePicks.reduce((s, p) => s + (p.ev_per_1 ?? 0), 0) / datePicks.length,
      confidence_distribution: confidenceDist
    });
  }
  
  return snapshots.sort((a, b) => a.date.localeCompare(b.date));
}

async function main() {
  console.log('📊 Projector Calibration Analysis\n');
  
  const resultsDir = path.join(root, 'data', 'results');
  // Use calibration_dataset.csv which combines picks with actual results
  const picksPath = path.join(resultsDir, 'calibration_dataset.csv');
  
  // Load picks and grades
  const picks = readCsv<PickRecord>(picksPath);
  const grades = parseGradeFiles(resultsDir);
  
  if (picks.length === 0) {
    console.log('❌ No calibration dataset found. Run create_calibration_dataset first.');
    return;
  }
  
  console.log(`✓ Loaded ${picks.length} picks and ${grades.size} grade files\n`);
  
  // Analyze calibration
  const calibration = analyzeCalibration(picks, grades);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CALIBRATION ANALYSIS (Predicted vs. Actual Hit Rates)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  for (const bucket of calibration) {
    const status = Math.abs(bucket.actual_hit_rate - bucket.predicted_prob) < 0.05 ? '✓' : '⚠️';
    console.log(`${status} ${bucket.prob_range.padEnd(10)} | Predicted: ${(bucket.predicted_prob * 100).toFixed(0)}% → Actual: ${(bucket.actual_hit_rate * 100).toFixed(1)}% | N=${bucket.num_picks.toString().padStart(2)} | ROI: $${bucket.roi.toFixed(0).padStart(5)} | Avg EV: ${bucket.avg_ev.toFixed(3)}`);
  }
  
  const avgCalibError = calibration.reduce((s, b) => s + b.calibration_error, 0) / calibration.length;
  console.log(`\n📈 Average Calibration Error: ${(avgCalibError * 100).toFixed(2)}%`);
  if (avgCalibError < 0.05) {
    console.log('✓ EXCELLENT: Probabilities are well-calibrated');
  } else if (avgCalibError < 0.10) {
    console.log('⚠️ GOOD: Minor calibration drift');
  } else {
    console.log('❌ POOR: Major calibration issues - model may be overconfident');
  }
  
  // Daily metrics
  const daily = calculateDailyMetrics(picks, grades);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('DAILY METRICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  for (const day of daily) {
    const roi = day.roi > 0 ? `+$${day.roi.toFixed(0)}` : `$${day.roi.toFixed(0)}`;
    console.log(`${day.date} | ${day.total_hits}/${day.total_picks} (${(day.hit_rate * 100).toFixed(1)}%) | ROI: ${roi.padStart(6)} | Avg CP: ${(day.avg_cover_prob * 100).toFixed(0)}% | Avg EV: ${day.avg_ev_per_1.toFixed(3)}`);
  }
  
  // Summary
  const totalPicks = daily.reduce((s, d) => s + d.total_picks, 0);
  const totalHits = daily.reduce((s, d) => s + d.total_hits, 0);
  const totalRoi = daily.reduce((s, d) => s + d.roi, 0);
  const overallHitRate = totalHits / totalPicks;
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('OVERALL SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total Picks: ${totalPicks}`);
  console.log(`Total Hits: ${totalHits} (${(overallHitRate * 100).toFixed(1)}%)`);
  console.log(`Total ROI: $${totalRoi.toFixed(0)}`);
  console.log(`ROI/Pick: $${(totalRoi / totalPicks).toFixed(2)}`);
  
  if (overallHitRate > 0.55) {
    console.log('\n✓ PROFITABLE: Model is beating the -110 vig');
  } else if (overallHitRate > 0.52) {
    console.log('\n⚠️ MARGINAL: Model is nearly at breakeven');
  } else {
    console.log('\n❌ LOSING: Model needs recalibration');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
