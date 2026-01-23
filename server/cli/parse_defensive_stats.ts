/**
 * Parse Defensive Stats - Opponent Points Per Game Analysis
 * 
 * Converts opponent PPG and defensive efficiency stats into normalized ratings (0.0-1.0)
 * Lower opponent PPG = better defense
 * 
 * Rating Components:
 * - PPG Allowed (40% weight): Points allowed per game
 * - FG% Allowed (30% weight): Opponent field goal percentage
 * - 3P% Allowed (15% weight): Opponent three-point percentage  
 * - Rebounding Defense (10% weight): Opponent rebounding advantage
 * - Turnover Forcing (5% weight): Steals per game
 */

import fs from 'fs';
import path from 'path';

interface DefensiveTeamStats {
  team: string;
  opponent: string;
  gp: number;
  pts_allowed: number;
  fgm_allowed: number;
  fga_allowed: number;
  fg_pct_allowed: number;
  three_pm_allowed: number;
  three_pa_allowed: number;
  three_p_pct_allowed: number;
  ftm_allowed: number;
  fta_allowed: number;
  ft_pct_allowed: number;
  or_allowed: number;
  dr_allowed: number;
  reb_allowed: number;
  ast_allowed: number;
  stl: number;
  blk: number;
  to_forced: number;
  pf: number;
}

interface DefensiveRating {
  team: string;
  defensive_rating: number;
  ppg_allowed: number;
  fg_efficiency_allowed: number;
  three_point_allowed: number;
  rebounding_defense: number;
  turnover_generation: number;
}

function parseDefensiveStats(csvPath: string): DefensiveTeamStats[] {
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file is empty or missing header');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const stats: DefensiveTeamStats[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    
    if (values.length < 20) continue;

    const stat: DefensiveTeamStats = {
      team: values[0].trim(),
      opponent: values[1].trim(),
      gp: parseInt(values[2]) || 0,
      pts_allowed: parseFloat(values[3]) || 0,
      fgm_allowed: parseFloat(values[4]) || 0,
      fga_allowed: parseFloat(values[5]) || 0,
      fg_pct_allowed: parseFloat(values[6]) || 0,
      three_pm_allowed: parseFloat(values[7]) || 0,
      three_pa_allowed: parseFloat(values[8]) || 0,
      three_p_pct_allowed: parseFloat(values[9]) || 0,
      ftm_allowed: parseFloat(values[10]) || 0,
      fta_allowed: parseFloat(values[11]) || 0,
      ft_pct_allowed: parseFloat(values[12]) || 0,
      or_allowed: parseFloat(values[13]) || 0,
      dr_allowed: parseFloat(values[14]) || 0,
      reb_allowed: parseFloat(values[15]) || 0,
      ast_allowed: parseFloat(values[16]) || 0,
      stl: parseFloat(values[17]) || 0,
      blk: parseFloat(values[18]) || 0,
      to_forced: parseFloat(values[19]) || 0,
      pf: parseFloat(values[20]) || 0,
    };

    stats.push(stat);
  }

  return stats;
}

function calculateDefensiveRatings(stats: DefensiveTeamStats[]): DefensiveRating[] {
  const ratings: DefensiveRating[] = [];

  // Find benchmarks for normalization
  const ppgAllowed = stats.map(s => s.pts_allowed);
  const fgPctAllowed = stats.map(s => s.fg_pct_allowed);
  const threePctAllowed = stats.map(s => s.three_p_pct_allowed);

  const minPPG = Math.min(...ppgAllowed);
  const maxPPG = Math.max(...ppgAllowed);
  const minFG = Math.min(...fgPctAllowed);
  const maxFG = Math.max(...fgPctAllowed);
  const minThreePct = Math.min(...threePctAllowed);
  const maxThreePct = Math.max(...threePctAllowed);

  for (const stat of stats) {
    // PPG Allowed: Lower is better, so invert the scale
    const ppgRating = 1.0 - (stat.pts_allowed - minPPG) / (maxPPG - minPPG);

    // FG% Allowed: Lower is better
    const fgEfficiencyAllowed = 1.0 - (stat.fg_pct_allowed - minFG) / (maxFG - minFG);

    // 3P% Allowed: Lower is better
    const threePtAllowed = 1.0 - (stat.three_p_pct_allowed - minThreePct) / (maxThreePct - minThreePct);

    // Rebounding Defense: Average opponent rebounds (lower is better for defense)
    const reboundingDefense = 1.0 - (stat.reb_allowed / 50); // Normalize to 50 rebounds max

    // Turnover Generation: Steals per game (higher is better)
    const turnoverGen = Math.min(stat.stl / 15, 1.0); // Normalize to 15 steals max

    // Weighted composite defensive rating
    const defensiveRating = Math.min(
      1.0,
      (ppgRating * 0.40) +
      (fgEfficiencyAllowed * 0.30) +
      (threePtAllowed * 0.15) +
      (reboundingDefense * 0.10) +
      (turnoverGen * 0.05)
    );

    ratings.push({
      team: stat.team,
      defensive_rating: parseFloat(defensiveRating.toFixed(3)),
      ppg_allowed: parseFloat(stat.pts_allowed.toFixed(1)),
      fg_efficiency_allowed: parseFloat(stat.fg_pct_allowed.toFixed(1)),
      three_point_allowed: parseFloat(stat.three_p_pct_allowed.toFixed(1)),
      rebounding_defense: parseFloat(reboundingDefense.toFixed(3)),
      turnover_generation: parseFloat(turnoverGen.toFixed(3)),
    });
  }

  return ratings.sort((a, b) => b.defensive_rating - a.defensive_rating);
}

function main() {
  const inputPath = path.join(process.cwd(), 'data', 'raw', 'defensive_stats_2026_01_22.csv');
  const outputPath = path.join(process.cwd(), 'data', 'results', 'defensive_ratings_2026_01_22.csv');

  console.log('📊 Parsing Defensive Stats...\n');

  const stats = parseDefensiveStats(inputPath);
  console.log(`✓ Loaded ${stats.length} teams`);

  const ratings = calculateDefensiveRatings(stats);

  // Write to CSV
  const header = 'team,defensive_rating,ppg_allowed,fg_efficiency_allowed,three_point_allowed,rebounding_defense,turnover_generation\n';
  const rows = ratings.map(r => 
    `${r.team},${r.defensive_rating},${r.ppg_allowed},${r.fg_efficiency_allowed},${r.three_point_allowed},${r.rebounding_defense},${r.turnover_generation}`
  ).join('\n');

  fs.writeFileSync(outputPath, header + rows);
  console.log(`✓ Saved to ${outputPath}`);

  // Display top defensive teams
  console.log('\n🛡️  TOP 10 DEFENSIVE TEAMS:\n');
  for (let i = 0; i < Math.min(10, ratings.length); i++) {
    const r = ratings[i];
    console.log(
      `${i + 1}. ${r.team.padEnd(35)} | ` +
      `Rating: ${r.defensive_rating.toFixed(3)} | ` +
      `PPG Allowed: ${r.ppg_allowed.toFixed(1)} | ` +
      `FG%: ${r.fg_efficiency_allowed.toFixed(1)}`
    );
  }

  console.log('\n📈 COMPONENT BREAKDOWN:\n');
  console.log('Best PPG Defense:', ratings.reduce((a, b) => a.ppg_allowed < b.ppg_allowed ? a : b).team, 
    ratings.reduce((a, b) => a.ppg_allowed < b.ppg_allowed ? a : b).ppg_allowed);
  console.log('Best FG% Defense:', ratings.reduce((a, b) => a.fg_efficiency_allowed < b.fg_efficiency_allowed ? a : b).team,
    ratings.reduce((a, b) => a.fg_efficiency_allowed < b.fg_efficiency_allowed ? a : b).fg_efficiency_allowed.toFixed(1) + '%');
  console.log('Best 3P% Defense:', ratings.reduce((a, b) => a.three_point_allowed < b.three_point_allowed ? a : b).team,
    ratings.reduce((a, b) => a.three_point_allowed < b.three_point_allowed ? a : b).three_point_allowed.toFixed(1) + '%');
  console.log('Best Rebounding Defense:', ratings.reduce((a, b) => a.rebounding_defense > b.rebounding_defense ? a : b).team,
    ratings.reduce((a, b) => a.rebounding_defense > b.rebounding_defense ? a : b).rebounding_defense.toFixed(3));
  console.log('Best Turnover Generation:', ratings.reduce((a, b) => a.turnover_generation > b.turnover_generation ? a : b).team,
    ratings.reduce((a, b) => a.turnover_generation > b.turnover_generation ? a : b).turnover_generation.toFixed(3), 'steals/game');
}

main();
