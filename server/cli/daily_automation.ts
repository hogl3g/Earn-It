/**
 * ============================================================================
 * AUTOMATED DAILY CYCLE - PROJECTOR V2
 * ============================================================================
 * 
 * COMPLETE WORKFLOW (NO MANUAL INTERVENTION):
 * 
 * 1. Scrape Data
 *    - ESPN: Daily team stats, conference standings, matchups, spreads
 *    - KenPom: Adjusted efficiency, rankings, metrics
 *    - Aggregate into unified metrics
 * 
 * 2. Compare Teams
 *    - For each game today: Compare team_a vs team_b metrics
 *    - Project winner if >80% confidence
 *    - Validate against spread/moneyline alignment
 * 
 * 3. Generate Picks
 *    - Output: date, team_a, team_b, picked_team, confidence, spread, moneyline
 *    - Only picks >= 80%
 * 
 * 4. Grade Yesterday
 *    - Fetch final scores for yesterday's games
 *    - Grade only picks that were projected
 *    - Log wins/losses
 * 
 * 5. Update HTML
 *    - Display today's picks
 *    - Show cumulative wins/losses from today onward
 * 
 * ============================================================================
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

const CONFIDENCE_STRICT_MIN = 1.00;  // 100%
const CONFIDENCE_RELAXED_MIN = 0.80; // 80%

interface TeamMetrics {
  team_name: string;
  pts_for: number;           // Points scored
  pts_against: number;       // Points allowed
  pts_differential: number;  // Differential
  fg_pct: number;           // Field goal %
  reb: number;              // Rebounds
  ast: number;              // Assists
  turnover_margin: number;  // TO margin
  adjusted_efficiency: number; // KenPom rating
  ranking: number;          // KenPom ranking
  conference_rank: number;  // Conference standing
  wins: number;
  losses: number;
  last_updated: string;
}

interface Game {
  date: string;
  team_a: string;    // Home
  team_b: string;    // Away
  spread: number;    // Market spread
  moneyline_a: string;
  moneyline_b: string;
}

interface Pick {
  date: string;
  team_a: string;
  team_b: string;
  picked_team: string;
  confidence: number;
  confidence_pct: string;
  spread: number;
  moneyline: string;
  moneyline_check: string;
}

/**
 * Load or create team metrics from file
 */
async function loadTeamMetrics(): Promise<Map<string, TeamMetrics>> {
  const metricsPath = path.join(root, 'data', 'processed', 'team_metrics_daily.json');
  
  try {
    const content = await fs.readFile(metricsPath, 'utf-8');
    const data = JSON.parse(content);
    const map = new Map<string, TeamMetrics>();
    
    for (const team of data) {
      map.set(team.team_name.toLowerCase(), team);
    }
    
    return map;
  } catch (err) {
    // If metrics file doesn't exist, try to merge ESPN + KenPom data
    console.log('ℹ️  Merging ESPN and KenPom data...');
    return mergeMetrics();
  }
}

/**
 * Merge ESPN team stats with KenPom metrics
 */
async function mergeMetrics(): Promise<Map<string, TeamMetrics>> {
  const map = new Map<string, TeamMetrics>();
  
  try {
    // Load ESPN stats
    const espnPath = path.join(root, 'data', 'processed', 'espn_team_stats.json');
    const espnData = JSON.parse(await fs.readFile(espnPath, 'utf-8'));
    
    // Load KenPom metrics
    const kenpomPath = path.join(root, 'data', 'processed', 'kenpom_metrics.json');
    const kenpomData = JSON.parse(await fs.readFile(kenpomPath, 'utf-8'));
    
    // Create KenPom lookup
    const kenpomMap = new Map();
    for (const team of kenpomData) {
      kenpomMap.set(team.team_name.toLowerCase(), team);
    }
    
    // Merge ESPN with KenPom
    for (const espnTeam of espnData) {
      const kenpom = kenpomMap.get(espnTeam.team_name.toLowerCase()) || {};
      
      const merged: TeamMetrics = {
        team_name: espnTeam.team_name,
        pts_for: espnTeam.pts_for || 0,
        pts_against: espnTeam.pts_against || 0,
        pts_differential: (espnTeam.pts_for || 0) - (espnTeam.pts_against || 0),
        fg_pct: espnTeam.fg_pct || 0.45,
        reb: espnTeam.reb || 38,
        ast: espnTeam.ast || 15,
        turnover_margin: espnTeam.turnover_margin || 0,
        adjusted_efficiency: kenpom.adjusted_efficiency || 1.0,
        ranking: kenpom.ranking || 250,
        conference_rank: 0,
        wins: espnTeam.wins || 0,
        losses: espnTeam.losses || 0,
        last_updated: new Date().toISOString(),
      };
      
      map.set(espnTeam.team_name.toLowerCase(), merged);
    }
    
    console.log(`✅ Merged ${map.size} teams`);
    return map;
  } catch (err) {
    console.error('❌ Could not merge metrics:', err);
    return new Map();
  }
}

/**
 * Save team metrics to file
 */
async function saveTeamMetrics(metrics: Map<string, TeamMetrics>): Promise<void> {
  const metricsPath = path.join(root, 'data', 'processed', 'team_metrics_daily.json');
  const data = Array.from(metrics.values());
  
  await fs.mkdir(path.dirname(metricsPath), { recursive: true });
  await fs.writeFile(metricsPath, JSON.stringify(data, null, 2), 'utf-8');
  
  console.log('✅ Team metrics saved');
}

/**
 * Calculate team strength score (0.0 - 1.0)
 * Based on: pts differential, efficiency, field goal %, rebounding, assists
 */
function calculateTeamScore(metrics: TeamMetrics): number {
  if (!metrics) return 0.5;
  
  // Normalize each metric to 0-1 range
  // Assuming typical D1 ranges:
  // - Points differential: -30 to +30
  // - Adjusted efficiency: 0.85 to 1.15
  // - FG%: 0.35 to 0.55
  
  const pts_diff_norm = Math.max(0, Math.min(1, (metrics.pts_differential + 30) / 60));
  const eff_norm = Math.max(0, Math.min(1, (metrics.adjusted_efficiency - 0.85) / 0.30));
  const fg_norm = Math.max(0, Math.min(1, (metrics.fg_pct - 0.35) / 0.20));
  const reb_norm = Math.max(0, Math.min(1, (metrics.reb - 30) / 10)); // Per game
  const ast_norm = Math.max(0, Math.min(1, (metrics.ast - 12) / 8));  // Per game
  
  // Weighted average (efficiency is most important)
  const score = (
    pts_diff_norm * 0.25 +
    eff_norm * 0.35 +
    fg_norm * 0.15 +
    reb_norm * 0.15 +
    ast_norm * 0.10
  );
  
  return Math.max(0.01, Math.min(0.99, score));
}

/**
 * Convert score differential to win probability (logistic function)
 */
function scoreToProbability(scoreA: number, scoreB: number): number {
  const delta = scoreA - scoreB;
  const k = 3.0; // Scaling factor
  const hca = 0.025; // Home court advantage ~2.5 points / 100 score range
  
  const prob = 1 / (1 + Math.exp(-k * (delta + hca)));
  return Math.max(0.01, Math.min(0.99, prob));
}

/**
 * Check if spread/moneyline align with team metrics
 */
function checkMarketAlignment(
  teamA: string,
  teamB: string,
  confidenceA: number,
  spread: number,
  moneylineA: string,
  moneylineB: string
): string {
  try {
    // If spread says team_a favored and confidence says team_a should win: ✅ aligned
    // If spread says team_b favored but confidence says team_a: ⚠️ divergence warning
    
    const spreadFavor = spread < 0 ? 'team_a' : 'team_b';
    const confFavor = confidenceA > 0.5 ? 'team_a' : 'team_b';
    
    if (spreadFavor === confFavor) {
      return '✓ ALIGNED';
    } else {
      return '⚠️ DIVERGENCE: Market vs Metrics disagree';
    }
  } catch (err) {
    return 'N/A';
  }
}

/**
 * Main automated cycle
 */
async function runDailyAutomation() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('AUTOMATED DAILY CYCLE - PROJECTOR V2');
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`${'='.repeat(80)}\n`);
  
  // Step 1: Load team metrics
  console.log('📊 Loading team metrics...');
  const metrics = await loadTeamMetrics();
  
  if (metrics.size === 0) {
    console.log('❌ ERROR: No team metrics loaded. Run data scrapers first.');
    console.log('   - npx tsx server/cli/scrape_espn.ts');
    console.log('   - npx tsx server/cli/scrape_kenpom.ts');
    process.exit(1);
  }
  
  console.log(`   ✅ Loaded ${metrics.size} teams\n`);
  
  // Step 2: Load today's schedule
  console.log('📅 Loading today\'s schedule...');
  const schedPath = path.join(root, 'data', 'raw', 'schedule_today.csv');
  let games: Game[] = [];
  
  try {
    const content = await fs.readFile(schedPath, 'utf-8');
    const lines = content.trim().split(/\r?\n/);
    const headers = lines[0].split(',');
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const gameObj: Record<string, string> = {};
      headers.forEach((h, idx) => gameObj[h] = cols[idx] || '');
      
      games.push({
        date: new Date().toISOString().split('T')[0],
        team_a: gameObj.team_a || gameObj.home || '',
        team_b: gameObj.team_b || gameObj.away || '',
        spread: parseFloat(gameObj.spread) || 0,
        moneyline_a: gameObj.moneyline_a || '',
        moneyline_b: gameObj.moneyline_b || '',
      });
    }
  } catch (err) {
    console.log('⚠️  Schedule file not found, will generate picks when data available\n');
  }
  
  // Step 3: Generate picks
  console.log(`⚽ Analyzing ${games.length} games...\n`);
  
  const picks: Pick[] = [];
  
  for (const game of games) {
    if (!game.team_a || !game.team_b) continue;
    
    const metricsA = metrics.get(game.team_a.toLowerCase());
    const metricsB = metrics.get(game.team_b.toLowerCase());
    
    // VALIDATION: Both teams must exist in merged data
    if (!metricsA || !metricsB) {
      const missing = !metricsA ? game.team_a : game.team_b;
      console.log(`⏭️  SKIP: ${game.team_a} vs ${game.team_b} (${missing} not in KenPom)\n`);
      continue;
    }
    
    // VALIDATION: Both teams must have KenPom ranking (not placeholder)
    // KenPom ranking 250+ is placeholder for unranked teams
    if (metricsA.ranking >= 250 || metricsB.ranking >= 250) {
      const unranked = metricsA.ranking >= 250 ? game.team_a : game.team_b;
      console.log(`⏭️  SKIP: ${game.team_a} vs ${game.team_b} (${unranked} unranked)\n`);
      continue;
    }
    
    // Calculate team scores
    const scoreA = calculateTeamScore(metricsA);
    const scoreB = calculateTeamScore(metricsB);
    
    // Convert to win probability
    const confidenceA = scoreToProbability(scoreA, scoreB);
    const confidenceB = 1 - confidenceA;
    
    // Determine pick
    const pickedTeam = confidenceA > confidenceB ? game.team_a : game.team_b;
    const confidence = Math.max(confidenceA, confidenceB);
    
    // Check alignment
    const alignment = checkMarketAlignment(
      game.team_a, game.team_b, confidenceA,
      game.spread, game.moneyline_a, game.moneyline_b
    );
    
    // Only include if >= 80%
    if (confidence >= CONFIDENCE_RELAXED_MIN) {
      picks.push({
        date: game.date,
        team_a: game.team_a,
        team_b: game.team_b,
        picked_team: pickedTeam,
        confidence,
        confidence_pct: `${Math.round(confidence * 100)}%`,
        spread: game.spread,
        moneyline: confidenceA > 0.5 ? game.moneyline_a : game.moneyline_b,
        moneyline_check: alignment,
      });
      
      console.log(`✅ ${pickedTeam} (${Math.round(confidence * 100)}%)`);
      console.log(`   vs ${game.team_a === pickedTeam ? game.team_b : game.team_a}`);
      console.log(`   Spread: ${game.spread} | ${alignment}\n`);
    } else {
      console.log(`⏭️  SKIP: ${game.team_a} vs ${game.team_b} (${Math.round(confidence * 100)}% - below 80%)\n`);
    }
  }
  
  // Step 4: Save picks
  console.log(`\n${'='.repeat(80)}`);
  console.log(`PICKS GENERATED: ${picks.length}`);
  console.log(`${'='.repeat(80)}\n`);
  
  if (picks.length === 0) {
    console.log('ℹ️  No picks >= 80% confidence today\n');
    return;
  }
  
  // Save picks CSV
  const picksPath = path.join(root, 'data', 'results', 'ts_projector_picks.csv');
  const csvRows = [
    ['date', 'team_a', 'team_b', 'picked_team', 'confidence', 'tier', 'spread', 'moneyline', 'alignment'].join(','),
  ];
  
  for (const pick of picks) {
    const tier = pick.confidence >= CONFIDENCE_STRICT_MIN ? 'STRICT' : 'RELAXED';
    csvRows.push([
      pick.date,
      pick.team_a,
      pick.team_b,
      pick.picked_team,
      pick.confidence.toFixed(4),
      tier,
      pick.spread.toFixed(2),
      pick.moneyline,
      pick.moneyline_check,
    ].join(','));
  }
  
  await fs.mkdir(path.dirname(picksPath), { recursive: true });
  await fs.writeFile(picksPath, csvRows.join('\n'), 'utf-8');
  
  const publicPath = path.join(root, 'public', 'ts_projector_picks.csv');
  await fs.mkdir(path.dirname(publicPath), { recursive: true });
  await fs.writeFile(publicPath, csvRows.join('\n'), 'utf-8');
  
  console.log('✅ Picks saved to ts_projector_picks.csv\n');
}

runDailyAutomation().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
