import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

interface StandingsRow {
  team_name: string;
  abbreviation: string;
  conference: string;
  conf_wins: number;
  conf_losses: number;
  overall_wins: number;
  overall_losses: number;
  win_pct: number;
  home_record: string;
  away_record: string;
  streak: string;
  ap_rank?: number;
  usa_rank?: number;
}

interface EnhancedTeamMetrics {
  team_name: string;
  abbreviation: string;
  conference: string;
  overall_record: string;
  win_rate: number;
  conf_win_rate: number;
  home_win_rate: number;
  away_win_rate: number;
  ap_rank?: number;
  usa_rank?: number;
  strength_rating: number;
  schedule_strength: number;
  momentum_score: number;
}

function parseRecord(record: string): { wins: number; losses: number } {
  const parts = record.split('-');
  return {
    wins: parseInt(parts[0], 10),
    losses: parseInt(parts[1], 10),
  };
}

function calculateStrengthRating(winPct: number, confWinRate: number, apRank?: number): number {
  // Strength = (Overall Win % * 0.5) + (Conf Win % * 0.3) + (Poll Boost * 0.2)
  const pollBoost = apRank && apRank > 0 ? Math.max(0, 1 - apRank / 50) : 0;
  return winPct * 0.5 + confWinRate * 0.3 + pollBoost * 0.2;
}

function calculateScheduleStrength(conference: string, winPct: number): number {
  // Power conferences get higher schedule strength
  const powerConferences = [
    'Big East',
    'Big 12',
    'ACC',
    'SEC',
    'Big Ten',
    'West Coast',
  ];

  const isPower = powerConferences.includes(conference);
  const baseStrength = isPower ? 0.65 : 0.45;

  // Teams with better records face tougher competition
  return baseStrength + winPct * 0.15;
}

function calculateMomentum(streak: string): number {
  if (!streak) return 0;

  const direction = streak.charAt(0); // 'W' or 'L'
  const count = parseInt(streak.substring(1), 10);

  if (direction === 'W') {
    return Math.min(1, count * 0.15); // Max 1.0
  } else {
    return Math.max(-0.5, -count * 0.1); // Min -0.5
  }
}

async function integrateStandings() {
  try {
    console.log('📊 Integrating college basketball standings...\n');

    // Read standings
    const standingsPath = path.join(
      process.cwd(),
      'data/raw/standings_2026_01_22.csv'
    );
    const standingsContent = fs.readFileSync(standingsPath, 'utf-8');
    const standings = parse(standingsContent, {
      columns: true,
      skip_empty_lines: true,
    }) as StandingsRow[];

    console.log(`✅ Loaded ${standings.length} teams from standings\n`);

    // Process each team
    const enhancedMetrics: EnhancedTeamMetrics[] = standings.map((row) => {
      const confWins = parseInt(row.conf_wins.toString(), 10);
      const confLosses = parseInt(row.conf_losses.toString(), 10);
      const overallWins = parseInt(row.overall_wins.toString(), 10);
      const overallLosses = parseInt(row.overall_losses.toString(), 10);

      const confWinRate = (confWins / (confWins + confLosses)) || 0;
      const overallWinRate = parseFloat(row.win_pct.toString());

      const homeRecord = parseRecord(row.home_record);
      const awayRecord = parseRecord(row.away_record);

      const homeWinRate =
        homeRecord.wins / (homeRecord.wins + homeRecord.losses) || 0;
      const awayWinRate =
        awayRecord.wins / (awayRecord.wins + awayRecord.losses) || 0;

      const apRank = row.ap_rank ? parseInt(row.ap_rank.toString(), 10) : 0;

      return {
        team_name: row.team_name,
        abbreviation: row.abbreviation,
        conference: row.conference,
        overall_record: `${overallWins}-${overallLosses}`,
        win_rate: parseFloat(overallWinRate.toFixed(3)),
        conf_win_rate: parseFloat(confWinRate.toFixed(3)),
        home_win_rate: parseFloat(homeWinRate.toFixed(3)),
        away_win_rate: parseFloat(awayWinRate.toFixed(3)),
        ap_rank: apRank > 0 ? apRank : undefined,
        usa_rank: undefined,
        strength_rating: parseFloat(
          calculateStrengthRating(overallWinRate, confWinRate, apRank).toFixed(3)
        ),
        schedule_strength: parseFloat(
          calculateScheduleStrength(row.conference, overallWinRate).toFixed(3)
        ),
        momentum_score: parseFloat(calculateMomentum(row.streak).toFixed(3)),
      };
    });

    // Save enhanced metrics
    const metricsPath = path.join(
      process.cwd(),
      'data/results/team_metrics_2026_01_22.csv'
    );
    const metricsCSV = stringify(enhancedMetrics, { header: true });
    fs.writeFileSync(metricsPath, metricsCSV);

    console.log(`📁 Saved enhanced metrics to: data/results/team_metrics_2026_01_22.csv`);

    // Summary statistics
    const topTeams = enhancedMetrics
      .sort((a, b) => b.strength_rating - a.strength_rating)
      .slice(0, 10);

    const pollTeams = enhancedMetrics
      .filter((t) => t.ap_rank && t.ap_rank > 0)
      .sort((a, b) => (a.ap_rank || 999) - (b.ap_rank || 999));

    console.log('\n🏆 TOP 10 TEAMS BY STRENGTH RATING:\n');
    topTeams.forEach((team, i) => {
      console.log(
        `${i + 1}. ${team.team_name.padEnd(35)} | ${team.overall_record.padEnd(6)} | SR: ${team.strength_rating.toFixed(3)} | SS: ${team.schedule_strength.toFixed(3)}`
      );
    });

    console.log(`\n📊 POLLS (${pollTeams.length} ranked teams):\n`);
    pollTeams.slice(0, 15).forEach((team) => {
      console.log(
        `#${team.ap_rank
          ?.toString()
          .padStart(2)} ${team.team_name.padEnd(30)} | ${team.overall_record.padEnd(6)} | Strength: ${team.strength_rating.toFixed(3)}`
      );
    });

    // Conference breakdown
    const conferences = new Map<string, { teams: number; avgStrength: number }>();
    enhancedMetrics.forEach((team) => {
      if (!conferences.has(team.conference)) {
        conferences.set(team.conference, { teams: 0, avgStrength: 0 });
      }
      const conf = conferences.get(team.conference)!;
      conf.teams += 1;
      conf.avgStrength += team.strength_rating;
    });

    console.log(`\n🏫 CONFERENCE STRENGTH:\n`);
    Array.from(conferences.entries())
      .sort((a, b) => b[1].avgStrength / b[1].teams - a[1].avgStrength / a[1].teams)
      .slice(0, 10)
      .forEach(([conf, stats]) => {
        const avg = (stats.avgStrength / stats.teams).toFixed(3);
        console.log(
          `${conf.padEnd(35)} | ${stats.teams} teams | Avg Strength: ${avg}`
        );
      });

    console.log('\n✅ Standings integration complete!\n');

    return enhancedMetrics;
  } catch (error) {
    console.error('❌ Error integrating standings:', error);
    throw error;
  }
}

integrateStandings().catch(console.error);
