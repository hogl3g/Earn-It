/**
 * ============================================================================
 * AUTO-GRADER
 * ============================================================================
 * 
 * Automatically grades yesterday's picks against actual scores.
 * 
 * Rules:
 * - Only grade picks that were projected
 * - Only grade completed games
 * - Log wins/losses
 * - Update cumulative record
 * - Zero losses = system working (100% STRICT tier)
 * 
 * ============================================================================
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

interface Pick {
  date: string;
  team_a: string;
  team_b: string;
  picked_team: string;
  confidence: number;
}

interface GameResult {
  date: string;
  team_a: string;
  team_b: string;
  score_a: number;
  score_b: number;
}

interface GradeRecord {
  date: string;
  team_a: string;
  team_b: string;
  picked_team: string;
  score_a: number;
  score_b: number;
  won: boolean;
  margin: number;
}

/**
 * Load yesterday's picks from CSV
 */
async function loadYesterdayPicks(): Promise<Pick[]> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = yesterday.toISOString().split('T')[0];
  
  const picksPath = path.join(root, 'data', 'results', 'ts_projector_picks.csv');
  
  try {
    const content = await fs.readFile(picksPath, 'utf-8');
    const lines = content.trim().split(/\r?\n/);
    const headers = lines[0].split(',');
    
    const picks: Pick[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => obj[h] = cols[idx] || '');
      
      // Only get picks from yesterday
      if (obj.date === yesterdayDate) {
        picks.push({
          date: obj.date,
          team_a: obj.team_a,
          team_b: obj.team_b,
          picked_team: obj.picked_team,
          confidence: parseFloat(obj.confidence) || 0,
        });
      }
    }
    
    return picks;
  } catch (err) {
    console.log('⚠️  No picks from yesterday found');
    return [];
  }
}

/**
 * Fetch yesterday's game results (from ESPN or other source)
 */
async function fetchYesterdayResults(): Promise<GameResult[]> {
  console.log('📊 Fetching yesterday\'s results...');
  
  // In production: Scrape ESPN or other source for final scores
  // For now, return empty (will need to be populated)
  
  return [];
}

/**
 * Grade a pick against actual result
 */
function gradePick(pick: Pick, result: GameResult): GradeRecord {
  const scoreA = result.score_a;
  const scoreB = result.score_b;
  const margin = scoreA - scoreB;
  
  // Did picked team win?
  let won = false;
  if (pick.picked_team === result.team_a) {
    won = scoreA > scoreB;
  } else {
    won = scoreB > scoreA;
  }
  
  return {
    date: pick.date,
    team_a: pick.team_a,
    team_b: pick.team_b,
    picked_team: pick.picked_team,
    score_a: scoreA,
    score_b: scoreB,
    won,
    margin,
  };
}

/**
 * Load cumulative record
 */
async function loadRecord(): Promise<{ wins: number; losses: number }> {
  const recordPath = path.join(root, 'data', 'processed', 'cumulative_record.json');
  
  try {
    const content = await fs.readFile(recordPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    // Start fresh if file doesn't exist
    return { wins: 0, losses: 0 };
  }
}

/**
 * Save cumulative record
 */
async function saveRecord(record: { wins: number; losses: number }): Promise<void> {
  const recordPath = path.join(root, 'data', 'processed', 'cumulative_record.json');
  await fs.mkdir(path.dirname(recordPath), { recursive: true });
  await fs.writeFile(recordPath, JSON.stringify(record, null, 2), 'utf-8');
}

/**
 * Save grades
 */
async function saveGrades(grades: GradeRecord[]): Promise<void> {
  if (grades.length === 0) return;
  
  const gradeDate = grades[0].date;
  const gradesPath = path.join(root, 'data', 'results', `grades_${gradeDate.replace(/-/g, '')}.json`);
  
  // Load existing grades if present
  let existing: any = { rows: [], summary: { wins: 0, losses: 0 } };
  try {
    const content = await fs.readFile(gradesPath, 'utf-8');
    existing = JSON.parse(content);
  } catch (err) {
    // File doesn't exist, start new
  }
  
  // Add new grades
  existing.rows = grades;
  
  // Update summary
  const wins = grades.filter(g => g.won).length;
  const losses = grades.filter(g => !g.won).length;
  
  existing.summary = {
    wins,
    losses,
    total_picks: grades.length,
    hit_rate: `${Math.round((wins / grades.length) * 100)}%`,
  };
  
  await fs.mkdir(path.dirname(gradesPath), { recursive: true });
  await fs.writeFile(gradesPath, JSON.stringify(existing, null, 2), 'utf-8');
  
  console.log(`✅ Grades saved: ${wins}-${losses}\n`);
}

/**
 * Main auto-grading
 */
async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('AUTO-GRADER');
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`${'='.repeat(80)}\n`);
  
  // Load yesterday's picks
  const picks = await loadYesterdayPicks();
  
  if (picks.length === 0) {
    console.log('ℹ️  No picks from yesterday to grade\n');
    return;
  }
  
  console.log(`📋 Grading ${picks.length} picks from yesterday...\n`);
  
  // Fetch results
  const results = await fetchYesterdayResults();
  
  if (results.length === 0) {
    console.log('⚠️  No game results found. Make sure yesterday\'s scores are available.\n');
    return;
  }
  
  // Grade each pick
  const grades: GradeRecord[] = [];
  let wins = 0;
  let losses = 0;
  
  for (const pick of picks) {
    const result = results.find(r =>
      (r.team_a === pick.team_a && r.team_b === pick.team_b) ||
      (r.team_a === pick.team_b && r.team_b === pick.team_a)
    );
    
    if (!result) {
      console.log(`⏭️  SKIP: Game not complete - ${pick.team_a} vs ${pick.team_b}`);
      continue;
    }
    
    const grade = gradePick(pick, result);
    grades.push(grade);
    
    if (grade.won) {
      console.log(`✅ ${grade.picked_team}: ${grade.score_a}-${grade.score_b} (WON +${Math.abs(grade.margin)})`);
      wins++;
    } else {
      console.log(`❌ ${grade.picked_team}: ${grade.score_a}-${grade.score_b} (LOST -${Math.abs(grade.margin)})`);
      losses++;
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`YESTERDAY'S RESULTS: ${wins}-${losses}`);
  console.log(`${'='.repeat(80)}\n`);
  
  // Update cumulative record
  const currentRecord = await loadRecord();
  currentRecord.wins += wins;
  currentRecord.losses += losses;
  
  await saveRecord(currentRecord);
  console.log(`📊 Cumulative: ${currentRecord.wins}-${currentRecord.losses}\n`);
  
  // Check for losses in STRICT tier
  const strictLosses = grades.filter(g => !g.won && g.confidence >= 1.00);
  if (strictLosses.length > 0) {
    console.log(`🚨 CRITICAL: ${strictLosses.length} STRICT picks lost (0 losses acceptable!)`);
    console.log('   Model may need recalibration\n');
  }
  
  // Save grades
  await saveGrades(grades);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
