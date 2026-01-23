import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

interface OffensiveStats {
  rank: number;
  team_name: string;
  gp: number;
  pts: number;
  fg_pct: number;
  three_pct: number;
  ft_pct: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  to: number;
}

interface OffensiveRatings {
  team_name: string;
  rank: number;
  ppg: number;
  fg_efficiency: number;
  three_point_rating: number;
  rebounding_rating: number;
  passing_rating: number;
  ball_security: number;
  overall_offensive_rating: number;
}

function calculateFGEfficiency(fgPct: number): number {
  // Normalize FG% to 0-1 scale (45% is baseline 0.5)
  return (fgPct - 40) / 20; // 40% = 0.0, 60% = 1.0
}

function calculateThreePointRating(threePct: number): number {
  // 3P% rating (30% baseline = 0.0, 40%+ = 1.0)
  return Math.min(1, (threePct - 30) / 10);
}

function calculateReboundingRating(rebPerGame: number): number {
  // Rebounds per game (38 = 0.0, 45+ = 1.0)
  return Math.min(1, (rebPerGame - 38) / 7);
}

function calculatePassingRating(astPerGame: number): number {
  // Assists per game (12 = 0.0, 18+ = 1.0)
  return Math.min(1, (astPerGame - 12) / 6);
}

function calculateBallSecurity(toPerGame: number): number {
  // Turnovers per game (higher is bad, so negative correlation)
  // 15 TO = 0.0 rating, 9 TO = 1.0 rating
  return Math.min(1, Math.max(0, (15 - toPerGame) / 6));
}

async function parseOffensiveStats() {
  try {
    console.log('🏀 Parsing offensive statistics...\n');

    const statsPath = path.join(
      process.cwd(),
      'data/raw/offensive_stats_2026_01_22.csv'
    );
    const statsContent = fs.readFileSync(statsPath, 'utf-8');
    const stats = parse(statsContent, {
      columns: true,
      skip_empty_lines: true,
    }) as any[];

    console.log(`✅ Loaded ${stats.length} teams\n`);

    const ratings: OffensiveRatings[] = stats.map((row) => {
      const ppg = parseFloat(row.pts);
      const fgPct = parseFloat(row.fg_pct);
      const threePct = parseFloat(row.three_pct);
      const ftPct = parseFloat(row.ft_pct);
      const reb = parseFloat(row.reb);
      const ast = parseFloat(row.ast);
      const to = parseFloat(row.to);

      // Calculate component ratings
      const fgEff = calculateFGEfficiency(fgPct);
      const threePtRating = calculateThreePointRating(threePct);
      const rebRating = calculateReboundingRating(reb);
      const passRating = calculatePassingRating(ast);
      const security = calculateBallSecurity(to);

      // Overall offensive rating (weighted average)
      const overallRating =
        fgEff * 0.35 +
        threePtRating * 0.15 +
        ftPct / 100 * 0.10 +
        rebRating * 0.15 +
        passRating * 0.15 +
        security * 0.10;

      return {
        team_name: row.team_name,
        rank: parseInt(row.rank, 10),
        ppg: parseFloat(ppg.toFixed(1)),
        fg_efficiency: parseFloat(fgEff.toFixed(3)),
        three_point_rating: parseFloat(threePtRating.toFixed(3)),
        rebounding_rating: parseFloat(rebRating.toFixed(3)),
        passing_rating: parseFloat(passRating.toFixed(3)),
        ball_security: parseFloat(security.toFixed(3)),
        overall_offensive_rating: parseFloat(overallRating.toFixed(3)),
      };
    });

    // Save ratings
    const ratingsPath = path.join(
      process.cwd(),
      'data/results/offensive_ratings_2026_01_22.csv'
    );
    const ratingsCSV = stringify(ratings, { header: true });
    fs.writeFileSync(ratingsPath, ratingsCSV);

    console.log(
      `📁 Saved offensive ratings to: data/results/offensive_ratings_2026_01_22.csv\n`
    );

    // Display top and bottom teams
    const topOffense = ratings.sort(
      (a, b) => b.overall_offensive_rating - a.overall_offensive_rating
    );
    const bottomOffense = topOffense.slice().reverse();

    console.log(`🔥 TOP 10 OFFENSES:\n`);
    topOffense.slice(0, 10).forEach((team, i) => {
      console.log(
        `${(i + 1).toString().padStart(2)}. ${team.team_name.padEnd(35)} | Rating: ${team.overall_offensive_rating.toFixed(3)} | PPG: ${team.ppg.toFixed(1)} | FG%: ${(team.fg_efficiency > 0 ? '+' : '')}${team.fg_efficiency.toFixed(2)}`
      );
    });

    console.log(`\n❄️  BOTTOM 10 OFFENSES:\n`);
    bottomOffense.slice(0, 10).forEach((team, i) => {
      console.log(
        `${(stats.length - i).toString().padStart(2)}. ${team.team_name.padEnd(35)} | Rating: ${team.overall_offensive_rating.toFixed(3)} | PPG: ${team.ppg.toFixed(1)} | FG%: ${(team.fg_efficiency > 0 ? '+' : '')}${team.fg_efficiency.toFixed(2)}`
      );
    });

    console.log(`\n📊 COMPONENT BREAKDOWN:\n`);
    console.log(`Top FG Efficiency: ${topOffense[0].team_name.padEnd(30)} ${(topOffense[0].fg_efficiency * 100).toFixed(1)}%`);
    const bestThree = ratings.sort(
      (a, b) => b.three_point_rating - a.three_point_rating
    )[0];
    console.log(
      `Best 3P Rating: ${bestThree.team_name.padEnd(35)} ${bestThree.three_point_rating.toFixed(3)}`
    );
    const bestReb = ratings.sort(
      (a, b) => b.rebounding_rating - a.rebounding_rating
    )[0];
    console.log(
      `Best Rebounding: ${bestReb.team_name.padEnd(33)} ${bestReb.rebounding_rating.toFixed(3)}`
    );
    const bestPass = ratings.sort(
      (a, b) => b.passing_rating - a.passing_rating
    )[0];
    console.log(
      `Best Passing: ${bestPass.team_name.padEnd(36)} ${bestPass.passing_rating.toFixed(3)}`
    );
    const bestSecurity = ratings.sort(
      (a, b) => b.ball_security - a.ball_security
    )[0];
    console.log(
      `Best Ball Security: ${bestSecurity.team_name.padEnd(29)} ${bestSecurity.ball_security.toFixed(3)}`
    );

    console.log(`\n✅ Offensive stats parsing complete!\n`);

    return ratings;
  } catch (error) {
    console.error('❌ Error parsing offensive stats:', error);
    throw error;
  }
}

parseOffensiveStats().catch(console.error);
