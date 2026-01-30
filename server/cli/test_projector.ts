/**
 * Test the projector with known teams
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

interface TeamMetrics {
  team_name: string;
  pts_for: number;
  pts_against: number;
  pts_differential: number;
  fg_pct: number;
  reb: number;
  ast: number;
  turnover_margin: number;
  adjusted_efficiency: number;
  ranking: number;
  conference_rank: number;
  wins: number;
  losses: number;
  last_updated: string;
}

function calculateTeamScore(metrics: TeamMetrics): number {
  if (!metrics) return 0.5;
  
  const pts_diff_norm = Math.max(0, Math.min(1, (metrics.pts_differential + 30) / 60));
  const eff_norm = Math.max(0, Math.min(1, (metrics.adjusted_efficiency - 0.85) / 0.30));
  const fg_norm = Math.max(0, Math.min(1, (metrics.fg_pct - 0.35) / 0.20));
  const reb_norm = Math.max(0, Math.min(1, (metrics.reb - 30) / 10));
  const ast_norm = Math.max(0, Math.min(1, (metrics.ast - 12) / 8));
  
  const score = (
    pts_diff_norm * 0.25 +
    eff_norm * 0.35 +
    fg_norm * 0.15 +
    reb_norm * 0.15 +
    ast_norm * 0.10
  );
  
  return Math.max(0.01, Math.min(0.99, score));
}

function scoreToProbability(scoreA: number, scoreB: number): number {
  const delta = scoreA - scoreB;
  const k = 3.0;
  const hca = 0.025;
  
  const prob = 1 / (1 + Math.exp(-k * (delta + hca)));
  return Math.max(0.01, Math.min(0.99, prob));
}

async function testProjector() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('PROJECTOR TEST');
  console.log(`${'='.repeat(80)}\n`);

  // Load metrics
  const metricsPath = path.join(root, 'data', 'processed', 'espn_team_stats.json');
  const metricsData = JSON.parse(await fs.readFile(metricsPath, 'utf-8'));
  
  const metrics = new Map<string, TeamMetrics>();
  for (const team of metricsData) {
    const pts_differential = team.pts_for - team.pts_against;
    metrics.set(team.team_name.toLowerCase(), {
      ...team,
      pts_differential,
      adjusted_efficiency: 1.0,
      ranking: 250,
      conference_rank: 0,
      last_updated: new Date().toISOString(),
    });
  }
  
  console.log(`✅ Loaded ${metrics.size} teams\n`);
  
  // Test matchups
  const games = [
    { team_a: 'Michigan State Spartans', team_b: 'Michigan Wolverines' },
    { team_a: 'Florida Gators', team_b: 'Georgia Bulldogs' },
    { team_a: 'Gonzaga Bulldogs', team_b: 'South Florida Bulls' },
  ];
  
  for (const game of games) {
    const metA = metrics.get(game.team_a.toLowerCase());
    const metB = metrics.get(game.team_b.toLowerCase());
    
    if (!metA || !metB) {
      console.log(`❌ Missing: ${!metA ? game.team_a : game.team_b}`);
      continue;
    }
    
    const scoreA = calculateTeamScore(metA);
    const scoreB = calculateTeamScore(metB);
    const confA = scoreToProbability(scoreA, scoreB);
    const confB = 1 - confA;
    const picked = confA > 0.5 ? game.team_a : game.team_b;
    const conf = Math.max(confA, confB);
    
    console.log(`${game.team_a} vs ${game.team_b}`);
    console.log(`  ${metA.team_name}: ${metA.pts_for.toFixed(1)} PF, ${metA.pts_against.toFixed(1)} PA`);
    console.log(`  ${metB.team_name}: ${metB.pts_for.toFixed(1)} PF, ${metB.pts_against.toFixed(1)} PA`);
    console.log(`  → Pick: ${picked} (${Math.round(conf * 100)}%)\n`);
  }
}

testProjector().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
