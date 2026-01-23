import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

interface TeamMetrics {
  team_name: string;
  abbreviation: string;
  conference: string;
  overall_record: string;
  win_rate: number;
  conf_win_rate: number;
  home_win_rate: number;
  away_win_rate: number;
  ap_rank?: number;
  strength_rating: number;
  schedule_strength: number;
  momentum_score: number;
}

interface EnhancedTeamData {
  team_name: string;
  adjO: number;
  adjD: number;
  Source: string;
  conference?: string;
  win_rate?: number;
  strength_rating?: number;
  schedule_strength?: number;
  momentum_score?: number;
}

async function enhanceTeamData() {
  try {
    console.log('🎯 Enhancing team data with standings metrics...\n');

    // Read metrics
    const metricsPath = path.join(
      process.cwd(),
      'data/results/team_metrics_2026_01_22.csv'
    );
    const metricsContent = fs.readFileSync(metricsPath, 'utf-8');
    const metrics = parse(metricsContent, {
      columns: true,
      skip_empty_lines: true,
    }) as TeamMetrics[];

    console.log(`✅ Loaded ${metrics.length} team metrics\n`);

    // Read existing team data
    const teamsPath = path.join(
      process.cwd(),
      'data/raw/d1_teams_complete.csv'
    );
    const teamsContent = fs.readFileSync(teamsPath, 'utf-8');
    const teams = parse(teamsContent, {
      columns: true,
      skip_empty_lines: true,
    }) as any[];

    console.log(`✅ Loaded ${teams.length} teams from d1_teams_complete.csv\n`);

    // Create metrics lookup with multiple matching strategies
    const metricsMap = new Map<string, TeamMetrics>();
    const metricsFullMap = new Map<string, TeamMetrics>();
    
    metrics.forEach((m) => {
      // Full name match
      metricsFullMap.set(m.team_name.toLowerCase(), m);
      
      // Try first word only (for cases like "Alabama Crimson Tide" -> "Alabama")
      const firstWord = m.team_name.split(' ')[0].toLowerCase();
      if (!metricsMap.has(firstWord)) {
        metricsMap.set(firstWord, m);
      }
    });

    // Enhance teams
    let enhanced = 0;
    let missed = 0;
    const enhancedTeams: EnhancedTeamData[] = teams.map((team) => {
      // Try full name first
      let metric = metricsFullMap.get(team.team_name.toLowerCase());
      
      // Try first word match
      if (!metric) {
        const firstWord = team.team_name.split(' ')[0].toLowerCase();
        metric = metricsMap.get(firstWord);
      }

      if (metric) {
        enhanced++;
        return {
          team_name: team.team_name,
          adjO: parseFloat(team.adjO),
          adjD: parseFloat(team.adjD),
          Source: team.Source,
          conference: metric.conference,
          win_rate: metric.win_rate,
          strength_rating: metric.strength_rating,
          schedule_strength: metric.schedule_strength,
          momentum_score: metric.momentum_score,
        };
      } else {
        missed++;
        return {
          team_name: team.team_name,
          adjO: parseFloat(team.adjO),
          adjD: parseFloat(team.adjD),
          Source: team.Source,
        };
      }
    });

    console.log(`📊 Enhancement Summary:`);
    console.log(`   ✅ Enhanced: ${enhanced} teams`);
    console.log(`   ⚠️  Missed: ${missed} teams\n`);

    // Save enhanced data
    const enhancedPath = path.join(
      process.cwd(),
      'data/raw/d1_teams_enhanced.csv'
    );
    const enhancedCSV = stringify(enhancedTeams, { header: true });
    fs.writeFileSync(enhancedPath, enhancedCSV);

    console.log(`📁 Saved enhanced team data to: data/raw/d1_teams_enhanced.csv\n`);

    // Calculate team adjustments based on strength
    console.log(`📈 Team Adjustment Examples (Strength-based modifiers):\n`);

    const topTeams = enhancedTeams
      .filter((t) => t.strength_rating && typeof t.strength_rating === 'number' && t.strength_rating > 0.8)
      .sort((a, b) => (parseFloat(b.strength_rating?.toString() || '0')) - (parseFloat(a.strength_rating?.toString() || '0')))
      .slice(0, 5);

    const bottomTeams = enhancedTeams
      .filter((t) => t.strength_rating && typeof t.strength_rating === 'number' && t.strength_rating < 0.3)
      .sort((a, b) => (parseFloat(a.strength_rating?.toString() || '0')) - (parseFloat(b.strength_rating?.toString() || '0')))
      .slice(0, 5);

    topTeams.forEach((team) => {
      const sr = parseFloat(team.strength_rating?.toString() || '0');
      const boost = (sr - 0.5) * 10;
      const momentum = parseFloat(team.momentum_score?.toString() || '0');
      console.log(
        `${team.team_name.padEnd(30)} | SR: ${sr.toFixed(3)} | AdjO: +${boost.toFixed(1)} | Momentum: ${momentum.toFixed(2)}`
      );
    });

    console.log('');

    bottomTeams.forEach((team) => {
      const sr = parseFloat(team.strength_rating?.toString() || '0');
      const penalty = (sr - 0.5) * 10;
      const momentum = parseFloat(team.momentum_score?.toString() || '0');
      console.log(
        `${team.team_name.padEnd(30)} | SR: ${sr.toFixed(3)} | AdjO: ${penalty.toFixed(1)} | Momentum: ${momentum.toFixed(2)}`
      );
    });

    console.log('\n✅ Team data enhancement complete!\n');

    // Return stats for projector integration
    return {
      total_teams: enhancedTeams.length,
      enhanced_with_metrics: enhanced,
      teams_with_ratings: enhancedTeams.filter(
        (t) => t.strength_rating && typeof t.strength_rating === 'number' && t.strength_rating > 0
      ).length,
      avg_strength: (
        enhancedTeams.reduce((sum, t) => sum + (typeof t.strength_rating === 'number' ? t.strength_rating : 0), 0) /
        enhanced
      ).toFixed(3),
    };
  } catch (error) {
    console.error('❌ Error enhancing team data:', error);
    throw error;
  }
}

enhanceTeamData().catch(console.error);
