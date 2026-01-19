import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { normalizeTeamName } from '../../shared/team_names';

interface PickToGrade {
  date: string; // YYYYMMDD
  team_a: string;
  team_b: string;
  market_spread: number;
  model_spread: number;
  cover_prob: number;
}

interface GameResult {
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
  note?: string;
}

interface ESPNGame {
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  completed: boolean;
}

async function fetchESPNScores(date: string): Promise<ESPNGame[]> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}`;
    console.log(`  Fetching ESPN scores for ${date}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!resp.ok) {
      console.warn(`  ESPN API returned ${resp.status}`);
      return [];
    }
    
    const data = await resp.json();
    const games: ESPNGame[] = [];
    
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
    
    console.log(`  Found ${games.length} completed games`);
    return games;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('  ESPN API timeout (10 seconds)');
    } else {
      console.error('  Error fetching ESPN scores:', err.message);
    }
    return [];
  }
}

function findScore(pick: PickToGrade, games: ESPNGame[]): { a_score: number | null; b_score: number | null } {
  const normalizedPickA = normalizeTeamName(pick.team_a);
  const normalizedPickB = normalizeTeamName(pick.team_b);
  
  for (const game of games) {
    const normalizedAway = normalizeTeamName(game.awayTeam);
    const normalizedHome = normalizeTeamName(game.homeTeam);
    
    const matchA = normalizedPickA === normalizedAway || normalizedPickA === normalizedHome;
    const matchB = normalizedPickB === normalizedAway || normalizedPickB === normalizedHome;
    
    if (matchA && matchB) {
      if (normalizedPickA === normalizedAway) {
        return { a_score: game.awayScore, b_score: game.homeScore };
      } else {
        return { a_score: game.homeScore, b_score: game.awayScore };
      }
    }
  }
  
  return { a_score: null, b_score: null };
}

async function fetchGameScore(teamA: string, teamB: string, date: string): Promise<{ a_score: number | null; b_score: number | null }> {
  // This is now a wrapper - actual fetching happens once per date in main()
  return { a_score: null, b_score: null };
}

function calculateProfit(covered: boolean, stake: number, price: number = -110): number {
  if (!covered) return -stake;
  const winAmount = price > 0 ? (stake * price / 100) : (stake * 100 / Math.abs(price));
  return winAmount;
}

function ensureDir(p: string) { 
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); 
}

function readPicksForDate(picksPath: string, targetDate: string): PickToGrade[] {
  if (!fs.existsSync(picksPath)) return [];
  const content = fs.readFileSync(picksPath, 'utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true });
  const out: PickToGrade[] = [];
  
  for (const r of rows) {
    const dateRaw = String(r.date || r.Date || '').trim();
    const date = dateRaw.replace(/[^0-9]/g, '').slice(0, 8);
    if (date !== targetDate) continue;
    
    const team_a = normalizeTeamName(String(r.team_a ?? r.team ?? '').trim());
    const team_b = normalizeTeamName(String(r.team_b ?? r.opponent ?? '').trim());
    const cover_prob = Number(r.cover_prob ?? r.coverProb ?? r.CoverProb ?? 0.5);
    const market_spread = Number(r.market_spread ?? r.marketSpread ?? r.spread ?? 0);
    const model_spread = Number(r.model_spread ?? r.modelSpread ?? 0);
    
    if (!team_a || !team_b) continue;
    out.push({ date, team_a, team_b, market_spread, model_spread, cover_prob });
  }
  return out;
}

function getExistingGrades(gradesPath: string): any {
  if (!fs.existsSync(gradesPath)) {
    return { summary: { date: '', total_picks: 0 }, rows: [] };
  }
  return JSON.parse(fs.readFileSync(gradesPath, 'utf8'));
}

function calculateStake(coverProb: number, bankroll: number = 1000): number {
  // Kelly criterion: half-kelly with 25% cap
  const price = -110;
  const decimalOdds = Math.abs(price) / 100 + 1;
  const kelly = (coverProb * decimalOdds - 1) / (decimalOdds - 1);
  const fraction = Math.max(0, Math.min(0.25, kelly / 2));
  return bankroll * fraction;
}

async function main() {
  const metaPath = decodeURIComponent(new URL(import.meta.url).pathname);
  const filePath = path.normalize(metaPath.replace(/^\//, ''));
  const workspace = path.resolve(path.dirname(filePath), '../..');
  const resultsDir = path.join(workspace, 'data', 'results');
  ensureDir(resultsDir);

  const picksPath = path.join(resultsDir, 'ts_projector_picks.csv');
  
  if (!fs.existsSync(picksPath)) {
    console.log('No picks file found:', picksPath);
    return;
  }

  // Parse all picks and identify unique dates
  const content = fs.readFileSync(picksPath, 'utf8');
  const allRows = parse(content, { columns: true, skip_empty_lines: true });
  const dateSet = new Set<string>();
  
  for (const r of allRows) {
    const dateRaw = String(r.date || r.Date || '').trim();
    const date = dateRaw.replace(/[^0-9]/g, '').slice(0, 8);
    if (date && date.length === 8) dateSet.add(date);
  }

  const dates = Array.from(dateSet).sort();
  console.log(`Found ${dates.length} unique pick dates to grade`);

  let totalGraded = 0;
  let totalNew = 0;
  let totalScored = 0;

  for (const date of dates) {
    const picks = readPicksForDate(picksPath, date);
    if (picks.length === 0) continue;

    const gradesPath = path.join(resultsDir, `grades_${date}.json`);
    const existingGrades = getExistingGrades(gradesPath);
    const existingTeams = new Set(existingGrades.rows.map((r: any) => `${r.team_a}:${r.team_b}`));

    // Fetch ESPN scores once per date
    const espnGames = await fetchESPNScores(date);
    
    // Debug: log team names for troubleshooting
    if (espnGames.length > 0 && picks.length > 0) {
      console.log(`  Sample pick teams: ${picks[0].team_a} vs ${picks[0].team_b}`);
      console.log(`  Sample ESPN teams: ${espnGames[0].awayTeam} vs ${espnGames[0].homeTeam}`);
    }
    
    const newResults: GameResult[] = [];

    for (const pick of picks) {
      const key = `${pick.team_a}:${pick.team_b}`;
      if (existingTeams.has(key)) {
        totalGraded++;
        continue; // Already graded
      }

      // Find scores from ESPN
      const { a_score, b_score } = findScore(pick, espnGames);

      if (a_score === null || b_score === null) {
        // Can't grade without scores - add placeholder
        newResults.push({
          team_a: pick.team_a,
          team_b: pick.team_b,
          a_score: 0,
          b_score: 0,
          margin: 0,
          market_spread: pick.market_spread,
          model_spread: pick.model_spread,
          covered: false,
          won: false,
          stake: 0,
          profit: 0,
          note: 'score not found'
        });
        totalNew++;
        continue;
      }

      const margin = a_score - b_score;
      const adjustedMargin = margin - pick.market_spread;
      const covered = adjustedMargin > 0;
      const won = covered;
      const stake = calculateStake(pick.cover_prob);
      const profit = calculateProfit(covered, stake);

      newResults.push({
        team_a: pick.team_a,
        team_b: pick.team_b,
        a_score,
        b_score,
        margin,
        market_spread: pick.market_spread,
        model_spread: pick.model_spread,
        covered,
        won,
        stake,
        profit
      });
      totalNew++;
      totalScored++;
    }

    if (newResults.length > 0) {
      existingGrades.rows.push(...newResults);
      existingGrades.summary.total_picks = existingGrades.rows.length;
      existingGrades.summary.date = date;
      
      const scored = newResults.filter(r => !r.note).length;
      const pending = newResults.filter(r => r.note).length;
      
      fs.writeFileSync(gradesPath, JSON.stringify(existingGrades, null, 2));
      console.log(`✓ ${date}: ${scored} graded, ${pending} pending`);
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                   AUTO-GRADING COMPLETE                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`Total picks checked: ${totalGraded + totalNew}`);
  console.log(`Already graded: ${totalGraded}`);
  console.log(`New grades added: ${totalNew}`);
  console.log(`  • Successfully scored: ${totalScored}`);
  console.log(`  • Pending scores: ${totalNew - totalScored}`);
  
  if (totalNew - totalScored > 0) {
    console.log('\n⚠️  Some games are not yet completed or not found in ESPN data.');
    console.log('   Run daily_refresh.ts again tomorrow to pick up final scores.\n');
  } else {
    console.log('\n✓ All picks successfully graded with ESPN scores!\n');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
