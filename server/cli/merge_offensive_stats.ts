import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

interface EnhancedTeam {
  team_name: string;
  adjO: number;
  adjD: number;
  Source: string;
  conference: string;
  win_rate: number;
  strength_rating: number;
  schedule_strength: number;
  momentum_score: number;
  offensive_ppg?: number;
  offensive_rating?: number;
  fg_efficiency?: number;
  three_point_rating?: number;
  rebounding_rating?: number;
  passing_rating?: number;
  ball_security?: number;
}

interface OffensiveRating {
  team_name: string;
  ppg: number;
  overall_offensive_rating: number;
  fg_efficiency: number;
  three_point_rating: number;
  rebounding_rating: number;
  passing_rating: number;
  ball_security: number;
}

function normalizeTeamName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function findTeamMatch(offensiveName: string, enhancedTeams: EnhancedTeam[]): EnhancedTeam | null {
  const normalized = normalizeTeamName(offensiveName);
  const parts = normalized.split(' ');
  const firstWord = parts[0];

  // Try exact match first
  for (const team of enhancedTeams) {
    if (normalizeTeamName(team.team_name) === normalized) {
      return team;
    }
  }

  // Try first word match
  for (const team of enhancedTeams) {
    const teamParts = normalizeTeamName(team.team_name).split(' ');
    if (teamParts[0] === firstWord) {
      return team;
    }
  }

  return null;
}

async function mergeOffensiveStats() {
  try {
    console.log('📊 Merging offensive ratings into team enhancement database...\n');

    // Load offensive ratings
    const ratingsPath = path.join(
      process.cwd(),
      'data/results/offensive_ratings_2026_01_22.csv'
    );
    const ratingsContent = fs.readFileSync(ratingsPath, 'utf-8');
    const ratings = parse(ratingsContent, {
      columns: true,
      skip_empty_lines: true,
    }) as OffensiveRating[];

    console.log(`✅ Loaded ${ratings.length} offensive ratings\n`);

    // Load enhanced team data
    const enhancedPath = path.join(
      process.cwd(),
      'data/raw/d1_teams_enhanced.csv'
    );
    const enhancedContent = fs.readFileSync(enhancedPath, 'utf-8');
    const enhanced = parse(enhancedContent, {
      columns: true,
      skip_empty_lines: true,
    }) as EnhancedTeam[];

    console.log(`✅ Loaded ${enhanced.length} enhanced teams\n`);

    // Merge offensive stats
    let matched = 0;
    let updated = 0;

    ratings.forEach((rating) => {
      const match = findTeamMatch(rating.team_name, enhanced);
      if (match) {
        matched++;
        // Add offensive metrics to matched team
        Object.assign(match, {
          offensive_ppg: parseFloat(rating.ppg.toString()),
          offensive_rating: parseFloat(rating.overall_offensive_rating.toString()),
          fg_efficiency: parseFloat(rating.fg_efficiency.toString()),
          three_point_rating: parseFloat(rating.three_point_rating.toString()),
          rebounding_rating: parseFloat(rating.rebounding_rating.toString()),
          passing_rating: parseFloat(rating.passing_rating.toString()),
          ball_security: parseFloat(rating.ball_security.toString()),
        });
        updated++;
      }
    });

    console.log(`🎯 Matched ${matched}/${ratings.length} offensive teams (${((matched / ratings.length) * 100).toFixed(1)}%)\n`);

    // Save merged data
    const mergedPath = path.join(
      process.cwd(),
      'data/raw/d1_teams_enhanced.csv'
    );

    // Prepare output with standardized header order
    const headers = [
      'team_name',
      'adjO',
      'adjD',
      'Source',
      'conference',
      'win_rate',
      'strength_rating',
      'schedule_strength',
      'momentum_score',
      'offensive_ppg',
      'offensive_rating',
      'fg_efficiency',
      'three_point_rating',
      'rebounding_rating',
      'passing_rating',
      'ball_security',
    ];

    const rows = enhanced.map((team) => ({
      team_name: team.team_name,
      adjO: team.adjO || '',
      adjD: team.adjD || '',
      Source: team.Source || '',
      conference: team.conference || '',
      win_rate: team.win_rate || '',
      strength_rating: team.strength_rating || '',
      schedule_strength: team.schedule_strength || '',
      momentum_score: team.momentum_score || '',
      offensive_ppg: team.offensive_ppg || '',
      offensive_rating: team.offensive_rating || '',
      fg_efficiency: team.fg_efficiency || '',
      three_point_rating: team.three_point_rating || '',
      rebounding_rating: team.rebounding_rating || '',
      passing_rating: team.passing_rating || '',
      ball_security: team.ball_security || '',
    }));

    const csvContent = stringify(rows, { header: true, columns: headers });
    fs.writeFileSync(mergedPath, csvContent);

    console.log(`📁 Updated: data/raw/d1_teams_enhanced.csv\n`);

    // Display sample merged teams
    const offensiveTeams = enhanced.filter((t) => t.offensive_rating);
    console.log(`🏆 TEAMS WITH FULL PROFILES:\n`);
    offensiveTeams.sort((a, b) => (parseFloat(b.offensive_rating?.toString() || '0') - parseFloat(a.offensive_rating?.toString() || '0'))).slice(0, 10).forEach((team, i) => {
      console.log(
        `${(i + 1).toString().padStart(2)}. ${team.team_name.padEnd(35)} | Strength: ${parseFloat(team.strength_rating?.toString() || '0').toFixed(3)} | Offense: ${parseFloat(team.offensive_rating?.toString() || '0').toFixed(3)} | PPG: ${parseFloat(team.offensive_ppg?.toString() || '0').toFixed(1)}`
      );
    });

    console.log(`\n📈 SUMMARY:\n`);
    console.log(`- Total enhanced teams: ${enhanced.length}`);
    console.log(`- Teams with strength metrics: ${enhanced.filter((t) => t.strength_rating).length}`);
    console.log(`- Teams with offensive metrics: ${enhanced.filter((t) => t.offensive_rating).length}`);
    console.log(`- Teams with both: ${enhanced.filter((t) => t.strength_rating && t.offensive_rating).length}`);

    console.log(`\n✅ Offensive stats merge complete!\n`);
  } catch (error) {
    console.error('❌ Error merging offensive stats:', error);
    throw error;
  }
}

mergeOffensiveStats().catch(console.error);
