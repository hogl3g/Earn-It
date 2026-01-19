/**
 * Automated grading of yesterday's projector picks
 * Fetches scores from ESPN API and grades against enhanced_projector_picks.csv
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

/**
 * Team name mapping to handle ESPN naming variations
 * Prevents silent grading failures from team name mismatches
 */
const TEAM_NAME_MAPPING: Record<string, string> = {
  // A&M variations
  'texas a&m': 'Texas A&M',
  'tamu': 'Texas A&M',
  'a&m': 'Texas A&M',
  // UNC variations
  'north carolina': 'North Carolina',
  'unc': 'North Carolina',
  // UNC Greensboro
  'uncg': 'UNC Greensboro',
  'unc greensboro': 'UNC Greensboro',
  'north carolina greensboro': 'UNC Greensboro',
  // Other common variations
  'vcu': 'Virginia Commonwealth',
  'virginia commonwealth': 'Virginia Commonwealth',
  'smu': 'Southern Methodist',
  'southern methodist': 'Southern Methodist',
  'tcu': 'Texas Christian',
  'texas christian': 'Texas Christian',
  'utep': 'Texas El Paso',
  'texas el paso': 'Texas El Paso',
  'ole miss': 'Mississippi',
  'mississippi': 'Mississippi',
  'ole miss rebels': 'Mississippi',
  'usc': 'Southern California',
  'southern california': 'Southern California',
  'uconn': 'Connecticut',
  'connecticut': 'Connecticut',
  'vtech': 'Virginia Tech',
  'virginia tech': 'Virginia Tech',
  'psu': 'Penn State',
  'penn state': 'Penn State',
  'wvu': 'West Virginia',
  'west virginia': 'West Virginia',
};

function normalizeTeamName(rawName: string): string {
  if (!rawName) return '';
  const clean = rawName.toLowerCase().trim()
    .replace(/[^\w\s&]/g, '')  // Remove special chars except &
    .replace(/\s+/g, ' ');      // Normalize spaces
  
  // Check mapping first
  if (TEAM_NAME_MAPPING[clean]) {
    return TEAM_NAME_MAPPING[clean];
  }
  
  // Check if clean version is in mapping
  for (const [key, value] of Object.entries(TEAM_NAME_MAPPING)) {
    if (clean === key) return value;
    if (clean.includes(key) || key.includes(clean)) return value;
  }
  
  // Return original if no mapping found
  return rawName;
}

interface PickRow {
  date: string;
  team_a: string;
  team_b: string;
  market_spread: number;
  model_spread: number;
  cover_prob: number;
  kelly_pct: number;
  stake_dollars: number;
}

interface GameScore {
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  completed: boolean;
}

interface GradedPick extends PickRow {
  a_score: number | null;
  b_score: number | null;
  margin: number | null;
  covered: boolean | null;
  won: boolean | null;
  profit: number | null;
}

// Fetch yesterday's scores from ESPN CBB API
async function fetchYesterdayScores(dateOverride?: string): Promise<GameScore[]> {
  const yesterday = new Date();
  if (!dateOverride) {
    yesterday.setDate(yesterday.getDate() - 1);
  }
  const dateStr = (dateOverride || yesterday.toISOString().split('T')[0]).replace(/-/g, '');
  
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${dateStr}`;
    console.log(`Fetching scores from: ${url}`);
    
    // Add 10-second timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!resp.ok) {
      console.warn(`ESPN API returned ${resp.status}`);
      return [];
    }
    
    const data = await resp.json();
    const games: GameScore[] = [];
    
    for (const event of data.events || []) {
      if (event.status?.type?.completed) {
        const competition = event.competitions?.[0];
        if (!competition) continue;
        
        const competitors = competition.competitors || [];
        const away = competitors.find((c: any) => c.homeAway === 'away');
        const home = competitors.find((c: any) => c.homeAway === 'home');
        
        if (away && home) {
          games.push({
            awayTeam: normalizeTeamName(away.team?.displayName || away.team?.name || ''),
            homeTeam: normalizeTeamName(home.team?.displayName || home.team?.name || ''),
            awayScore: parseInt(away.score || '0'),
            homeScore: parseInt(home.score || '0'),
            completed: true
          });
        }
      }
    }
    
    return games;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('ESPN API fetch timeout (10 seconds)');
    } else {
      console.error('Error fetching ESPN scores:', err.message);
    }
    return [];
  }
}

// Find score for a pick, accounting for team name variations
function findScore(pick: PickRow, games: GameScore[]): { a_score: number | null; b_score: number | null; } {
  const normalizedPickA = normalizeTeamName(pick.team_a);
  const normalizedPickB = normalizeTeamName(pick.team_b);
  
  for (const game of games) {
    const normalizedAway = normalizeTeamName(game.awayTeam);
    const normalizedHome = normalizeTeamName(game.homeTeam);
    
    // Match by normalized names
    const matchA = normalizedPickA === normalizedAway || normalizedPickA === normalizedHome;
    const matchB = normalizedPickB === normalizedAway || normalizedPickB === normalizedHome;
    
    if (matchA && matchB) {
      // Found the game - determine which is away and which is home
      if (normalizedPickA === normalizedAway) {
        return { a_score: game.awayScore, b_score: game.homeScore };
      } else {
        return { a_score: game.homeScore, b_score: game.awayScore };
      }
    }
  }
  
  // No match found - log warning
  console.warn(`⚠️ Could not find game result for ${pick.team_a} vs ${pick.team_b}`);
  return { a_score: null, b_score: null };
}

// Parse CSV into pick rows
function parsePicksCsv(csvPath: string): PickRow[] {
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    return [];
  }
  
  const raw = fs.readFileSync(csvPath, 'utf-8').trim();
  const [header, ...lines] = raw.split(/\r?\n/);
  
  return lines.map(line => {
    const cols = line.split(',');
    return {
      date: cols[0],
      team_a: cols[1],
      team_b: cols[2],
      market_spread: parseFloat(cols[3]),
      model_spread: parseFloat(cols[4]),
      cover_prob: parseFloat(cols[5]),
      kelly_pct: parseFloat(cols[6]),
      stake_dollars: parseFloat(cols[7])
    };
  });
}

// Grade picks
function gradePicks(picks: PickRow[], scores: GameScore[]): GradedPick[] {
  return picks.map(pick => {
    const score = findScore(pick, scores);
    
    if (!score.a_score || !score.b_score) {
      return { ...pick, a_score: null, b_score: null, margin: null, covered: null, won: null, profit: null };
    }
    
    const margin = score.a_score - score.b_score;
    const covered = margin > pick.market_spread;
    const won = margin > 0;
    const profit = covered ? pick.stake_dollars * 0.91 : -pick.stake_dollars; // -110 odds
    
    return {
      ...pick,
      a_score: score.a_score,
      b_score: score.b_score,
      margin,
      covered,
      won,
      profit
    };
  });
}

// Main
async function main() {
  // Allow passing a date as CLI arg: npx tsx grade_yesterday.ts 2026-01-14
  const cliDate = process.argv[2];
  let dateStr: string;
  
  if (cliDate) {
    dateStr = cliDate;
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    dateStr = yesterday.toISOString().split('T')[0];
  }
  
  const dateKey = dateStr.replace(/-/g, '');
  
  console.log(`Grading picks for ${dateStr}...`);
  
  // Read yesterday's picks from enhanced_projector_picks.csv (filtered by date)
  const csvPath = path.join(root, 'data', 'results', 'enhanced_projector_picks.csv');
  const allPicks = parsePicksCsv(csvPath);
  const yesterdayPicks = allPicks.filter(p => p.date.startsWith(dateStr));
  
  if (yesterdayPicks.length === 0) {
    console.log(`No picks found for ${dateStr} in enhanced_projector_picks.csv`);
    return;
  }
  
  console.log(`Found ${yesterdayPicks.length} picks for ${dateStr}`);
  
  // Fetch scores
  const scores = await fetchYesterdayScores(dateStr);
  
  if (scores.length === 0) {
    console.warn('No scores fetched from ESPN. Skipping grading.');
    return;
  }
  
  // Grade
  const graded = gradePicks(yesterdayPicks, scores);
  
  // Calculate summary
  const total = graded.filter(g => g.covered !== null).length;
  const wins = graded.filter(g => g.won === true).length;
  const covers = graded.filter(g => g.covered === true).length;
  const totalStake = graded.reduce((sum, g) => sum + (g.stake_dollars || 0), 0);
  const totalProfit = graded.reduce((sum, g) => sum + (g.profit || 0), 0);
  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
  
  const summary = {
    date: dateStr,
    total_picks: total,
    wins,
    covers,
    total_stake: totalStake,
    total_profit: totalProfit,
    roi
  };
  
  // Write grades JSON
  const outPath = path.join(root, 'data', 'results', `grades_${dateKey}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ summary, rows: graded }, null, 2), 'utf-8');
  
  console.log(`✅ Wrote grades to ${outPath}`);
  console.log(`Summary: ${wins}/${total} wins, ${covers}/${total} covers, ROI: ${roi.toFixed(2)}%`);
}

main().catch(err => {
  console.error('Grading failed:', err);
  process.exit(1);
});
