/**
 * ============================================================================
 * CLEAN STATS-BASED PROJECTOR
 * ============================================================================
 * 
 * LOCKED REQUIREMENTS (Non-negotiable):
 * - 100% STRICT picks (≥1.00 confidence): must win 100% of time, 0 losses acceptable
 * - 80% RELAXED picks (0.80-0.99 confidence): must win 80% of time, ±5% acceptable
 * - Picks only when confidence ≥ 80%
 * - Confidence % = Expected win %
 * - Pure stats-based: NO market edge calculations
 * - Moneyline is sanity check only (warn if diverges >15%)
 * 
 * ============================================================================
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
// @ts-ignore - Legacy metrics integration not needed
// import { loadTeamMetrics } from '../lib/team_metrics_integration.js';
import { CONFIDENCE_STRICT_MIN, CONFIDENCE_RELAXED_MIN } from '../../shared/betting_constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

interface Pick {
  date: string;
  team_a: string;         // Home team
  team_b: string;         // Away team
  picked_team: string;    // Which team to bet on (winner by stats)
  confidence: number;     // Win probability from stats (0.0 to 1.0)
  confidence_pct: string; // Formatted: "88%"
  tier: 'STRICT' | 'RELAXED' | 'SKIP';
  moneyline_warning?: string; // Alert if model disagrees with bookmakers
  moneyline_a?: string;
  moneyline_b?: string;
  market_spread?: number; // For reference only, not used in pick calculation
}

interface TeamRating {
  team_name: string;
  strength_rating: number;
  offensive_rating?: number;
  [key: string]: any;
}

/**
 * Calculate home court advantage (2.5 points)
 */
function getHomeCourtAdvantage(): number {
  return 2.5;
}

/**
 * Load all team ratings from metrics
 */
async function loadAllTeamRatings(): Promise<Map<string, TeamRating>> {
  const metricsPath = path.join(root, 'data', 'raw', 'd1_teams_enhanced.csv');
  
  if (!fs.stat(metricsPath).catch(() => null)) {
    console.warn(`⚠️  Team metrics not found at ${metricsPath}`);
    return new Map();
  }

  try {
    const content = await fs.readFile(metricsPath, 'utf-8');
    const lines = content.trim().split(/\r?\n/);
    if (lines.length < 2) return new Map();

    const headers = lines[0].split(',').map(h => h.trim());
    const teamNameIdx = headers.findIndex(h => h.includes('team'));
    const strengthIdx = headers.findIndex(h => h.includes('strength') || h.includes('rating'));
    const offensiveIdx = headers.findIndex(h => h.includes('offensive'));

    const ratings = new Map<string, TeamRating>();

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      const teamName = cols[teamNameIdx];
      
      if (!teamName) continue;

      const rating: TeamRating = {
        team_name: teamName,
        strength_rating: strengthIdx >= 0 ? parseFloat(cols[strengthIdx]) || 0.5 : 0.5,
        offensive_rating: offensiveIdx >= 0 ? parseFloat(cols[offensiveIdx]) || 0.5 : undefined,
      };

      ratings.set(teamName.toLowerCase(), rating);
    }

    return ratings;
  } catch (err) {
    console.error('Failed to load team ratings:', err);
    return new Map();
  }
}

/**
 * Get team rating (strength score 0.0-1.0)
 * Falls back to 0.5 if team not found
 */
function getTeamRating(teamName: string, ratings: Map<string, TeamRating>): number {
  const normalized = teamName.toLowerCase().replace(/[()]/g, '').trim();
  const rating = ratings.get(normalized);
  return rating ? rating.strength_rating : 0.5;
}

/**
 * Convert team rating delta to win probability
 * 
 * Formula: win_prob = 1 / (1 + exp(-k * delta))  (logistic function)
 * where delta = team_a_rating - team_b_rating + hca
 * k ≈ 3.0 (scaling factor - higher = more extreme probabilities)
 */
function ratingDeltaToWinProb(ratingA: number, ratingB: number, isHomeA: boolean): number {
  const hca = isHomeA ? getHomeCourtAdvantage() / 100 : -getHomeCourtAdvantage() / 100;
  const delta = (ratingA - ratingB) + hca;
  
  // Logistic function
  const k = 3.0;
  const winProb = 1 / (1 + Math.exp(-k * delta));
  
  return Math.max(0.01, Math.min(0.99, winProb));
}

/**
 * Classify confidence into tier
 */
function classifyTier(confidence: number): 'STRICT' | 'RELAXED' | 'SKIP' {
  if (confidence >= CONFIDENCE_STRICT_MIN) {
    return 'STRICT';
  } else if (confidence >= CONFIDENCE_RELAXED_MIN) {
    return 'RELAXED';
  } else {
    return 'SKIP';
  }
}

/**
 * Check moneyline sanity
 * Return warning if model confidence diverges significantly from implied probability
 */
function checkMoneylineSanity(
  modelConfidence: number,
  moneylineA: string | undefined,
  moneylineB: string | undefined,
  predictedWinner: string,
  teamA: string
): string | undefined {
  if (!moneylineA || !moneylineB) return undefined;

  try {
    // Parse moneyline to implied probabilities
    const mlA = parseInt(moneylineA);
    const mlB = parseInt(moneylineB);

    const impliedProbA = mlA < 0 ? Math.abs(mlA) / (Math.abs(mlA) + 100) : 100 / (mlA + 100);
    const impliedProbB = mlB < 0 ? Math.abs(mlB) / (Math.abs(mlB) + 100) : 100 / (mlB + 100);

    // Determine which team is favored by market
    const marketFavored = impliedProbA > 0.5 ? teamA : 'Team B';
    const impliedProb = impliedProbA > 0.5 ? impliedProbA : impliedProbB;

    // Check divergence
    const divergence = Math.abs(modelConfidence - impliedProb);

    if (divergence > 0.15) {
      return `⚠️  Model (${(modelConfidence * 100).toFixed(0)}%) disagrees with market (${(impliedProb * 100).toFixed(0)}%) - possible miscalibration`;
    }
  } catch (err) {
    // Silent fail - moneylines might not be present
  }

  return undefined;
}

/**
 * Main: Generate picks
 */
async function main() {
  const refDate = process.argv[2] || new Date().toISOString().split('T')[0];
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('CLEAN STATS-BASED PROJECTOR');
  console.log(`Generated: ${refDate}`);
  console.log(`${'='.repeat(80)}\n`);

  // Load games for the date
  const schedPath = path.join(root, 'data', 'raw', `schedule_${refDate.replace(/-/g, '')}.csv`);
  const gamesContent = await fs.readFile(schedPath, 'utf-8').catch(() => '');
  
  if (!gamesContent) {
    console.log(`⚠️  No schedule found for ${refDate}`);
    return;
  }

  // Load team ratings
  const ratings = await loadAllTeamRatings();
  if (ratings.size === 0) {
    console.warn('⚠️  Failed to load team ratings');
  }

  // Parse games
  const lines = gamesContent.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim());
  const picks: Pick[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const gameObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      gameObj[h] = cols[idx] || '';
    });

    const teamA = gameObj.team_a || gameObj.home || '';
    const teamB = gameObj.team_b || gameObj.away || '';
    const isHome = gameObj.location === 'H' || gameObj.location === 'HOME';
    const spread = parseFloat(gameObj.spread) || 0;
    const moneylineA = gameObj.moneyline_a || gameObj.ml_a;
    const moneylineB = gameObj.moneyline_b || gameObj.ml_b;

    if (!teamA || !teamB) continue;

    // Get team ratings
    const ratingA = getTeamRating(teamA, ratings);
    const ratingB = getTeamRating(teamB, ratings);

    // Calculate win probability (stats only)
    const winProbA = ratingDeltaToWinProb(ratingA, ratingB, isHome);
    const winProbB = 1 - winProbA;

    // Pick the team with higher win probability
    const predictedWinner = winProbA > winProbB ? teamA : teamB;
    const confidence = Math.max(winProbA, winProbB);

    // Classify
    const tier = classifyTier(confidence);

    // Sanity check
    const warning = checkMoneylineSanity(confidence, moneylineA, moneylineB, predictedWinner, teamA);

    // Only include picks with >= 80% confidence
    if (tier !== 'SKIP') {
      picks.push({
        date: refDate,
        team_a: teamA,
        team_b: teamB,
        picked_team: predictedWinner,
        confidence,
        confidence_pct: `${Math.round(confidence * 100)}%`,
        tier,
        moneyline_warning: warning,
        moneyline_a: moneylineA,
        moneyline_b: moneylineB,
        market_spread: spread || undefined,
      });
    }
  }

  // Sort by confidence descending
  picks.sort((a, b) => b.confidence - a.confidence);

  // Write CSV: date, team_a (home), team_b (away), picked_team, confidence
  const csvRows = [
    ['date', 'team_a', 'team_b', 'picked_team', 'confidence', 'tier'].join(','),
  ];

  for (const pick of picks) {
    csvRows.push([
      pick.date,
      pick.team_a,
      pick.team_b,
      pick.picked_team,
      pick.confidence.toFixed(4),
      pick.tier,
    ].join(','));
  }

  // Save files
  try {
    const outDir = path.join(root, 'data', 'results');
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, 'ts_projector_picks.csv'), csvRows.join('\n'), 'utf-8');

    const publicDir = path.join(root, 'public');
    await fs.mkdir(publicDir, { recursive: true });
    await fs.writeFile(path.join(publicDir, 'ts_projector_picks.csv'), csvRows.join('\n'), 'utf-8');

    console.log(`✅ Picks saved to data/results/ts_projector_picks.csv`);
  } catch (err) {
    console.error('Failed to write CSV:', err);
  }

  // Display picks
  console.log(`\nFOUND ${picks.length} PICKS (≥80% confidence):\n`);

  picks.forEach((p, i) => {
    const marker = p.tier === 'STRICT' ? '🔒' : '📊';
    console.log(`${i + 1}. ${marker} ${p.picked_team} (${p.confidence_pct}) [${p.tier}]`);
    console.log(`   ${p.team_a} vs ${p.team_b}`);
    if (p.moneyline_warning) {
      console.log(`   ${p.moneyline_warning}`);
    }
  });

  console.log(`\n${'='.repeat(80)}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
