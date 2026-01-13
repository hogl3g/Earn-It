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
async function fetchYesterdayScores(): Promise<GameScore[]> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0].replace(/-/g, '');
  
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${dateStr}`;
    console.log(`Fetching scores from: ${url}`);
    
    const resp = await fetch(url);
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
            awayTeam: away.team?.displayName || away.team?.name || '',
            homeTeam: home.team?.displayName || home.team?.name || '',
            awayScore: parseInt(away.score || '0'),
            homeScore: parseInt(home.score || '0'),
            completed: true
          });
        }
      }
    }
    
    console.log(`Found ${games.length} completed games`);
    return games;
  } catch (err) {
    console.error('Error fetching ESPN scores:', err);
    return [];
  }
}

// Normalize team name for matching
function normalizeTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bst\.\b/g, 'st')
    .replace(/\bstate\b/g, 'st')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Find score for a matchup
function findScore(teamA: string, teamB: string, scores: GameScore[]): { aScore: number; bScore: number } | null {
  const normA = normalizeTeam(teamA);
  const normB = normalizeTeam(teamB);
  
  for (const game of scores) {
    const normAway = normalizeTeam(game.awayTeam);
    const normHome = normalizeTeam(game.homeTeam);
    
    // Match either direction
    if ((normA === normAway && normB === normHome) || (normA === normHome && normB === normAway)) {
      return normA === normAway 
        ? { aScore: game.awayScore, bScore: game.homeScore }
        : { aScore: game.homeScore, bScore: game.awayScore };
    }
  }
  
  return null;
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
    const score = findScore(pick.team_a, pick.team_b, scores);
    
    if (!score) {
      return { ...pick, a_score: null, b_score: null, margin: null, covered: null, won: null, profit: null };
    }
    
    const margin = score.aScore - score.bScore;
    const covered = margin > pick.market_spread;
    const won = margin > 0;
    const profit = covered ? pick.stake_dollars * 0.91 : -pick.stake_dollars; // -110 odds
    
    return {
      ...pick,
      a_score: score.aScore,
      b_score: score.bScore,
      margin,
      covered,
      won,
      profit
    };
  });
}

// Main
async function main() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];
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
  const scores = await fetchYesterdayScores();
  
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
