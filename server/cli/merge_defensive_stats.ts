/**
 * Merge Defensive Stats into Team Database
 * 
 * Matches defensive ratings to 311-team database and adds defensive fields
 * Handles team name normalization and fuzzy matching
 */

import fs from 'fs';
import path from 'path';

interface TeamMetrics {
  team_name: string;
  [key: string]: string | number;
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

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\b(st|saint)\b/gi, 'st')
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, '')
    .trim();
}

function parseCSV(content: string): string[][] {
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => {
    const parts = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim().replace(/^"|"$/g, ''));
    return parts;
  });
}

function findTeamMatch(defensiveName: string, teamNames: string[]): string | null {
  const normalized = normalizeTeamName(defensiveName);

  // Exact match
  for (const team of teamNames) {
    if (normalizeTeamName(team) === normalized) {
      return team;
    }
  }

  // Partial match (e.g., "Gonzaga" matches "Gonzaga Bulldogs")
  for (const team of teamNames) {
    const normalizedTeam = normalizeTeamName(team);
    if (normalizedTeam.includes(normalized) || normalized.includes(normalizedTeam.split(' ')[0])) {
      return team;
    }
  }

  return null;
}

function mergeDefensiveStats() {
  const defensiveRatingsPath = path.join(process.cwd(), 'data', 'results', 'defensive_ratings_2026_01_22.csv');
  const teamsPath = path.join(process.cwd(), 'data', 'raw', 'd1_teams_enhanced.csv');
  const outputPath = path.join(process.cwd(), 'data', 'raw', 'd1_teams_enhanced.csv');

  console.log('🛡️  Merging Defensive Stats into Team Database...\n');

  // Read defensive ratings
  const defensiveContent = fs.readFileSync(defensiveRatingsPath, 'utf-8');
  const defensiveLines = parseCSV(defensiveContent);
  const defensiveHeader = defensiveLines[0];
  const defensiveData = defensiveLines.slice(1);

  const defensiveMap = new Map<string, DefensiveRating>();
  for (const row of defensiveData) {
    if (row.length < 7) continue;
    defensiveMap.set(normalizeTeamName(row[0]), {
      team: row[0],
      defensive_rating: parseFloat(row[1]),
      ppg_allowed: parseFloat(row[2]),
      fg_efficiency_allowed: parseFloat(row[3]),
      three_point_allowed: parseFloat(row[4]),
      rebounding_defense: parseFloat(row[5]),
      turnover_generation: parseFloat(row[6]),
    });
  }

  console.log(`✓ Loaded ${defensiveData.length} defensive ratings`);

  // Read team database
  const teamsContent = fs.readFileSync(teamsPath, 'utf-8');
  const teamsLines = parseCSV(teamsContent);
  const teamsHeader = teamsLines[0];
  const teamsData = teamsLines.slice(1);

  // Check if defensive columns already exist
  const defensiveColumns = [
    'defensive_rating',
    'ppg_allowed',
    'fg_efficiency_allowed',
    'three_point_allowed',
    'rebounding_defense',
    'turnover_generation',
  ];

  let newHeader = [...teamsHeader];
  for (const col of defensiveColumns) {
    if (!newHeader.includes(col)) {
      newHeader.push(col);
    }
  }

  console.log(`✓ Loaded ${teamsData.length} teams`);

  // Get list of team names from database
  const teamNameIndex = teamsHeader.indexOf('team_name');
  const teamNames = teamsData.map(row => row[teamNameIndex]).filter(Boolean);

  // Merge data
  let matched = 0;
  const updatedRows = teamsData.map(row => {
    const teamName = row[teamNameIndex];
    const match = findTeamMatch(teamName, Array.from(defensiveMap.keys()).map(k => {
      const def = defensiveMap.get(k);
      return def ? def.team : k;
    }));

    if (match) {
      const defensive = defensiveMap.get(normalizeTeamName(match));
      if (defensive) {
        matched++;
        // Pad row to match header length
        while (row.length < newHeader.length) {
          row.push('');
        }

        // Update defensive fields
        row[newHeader.indexOf('defensive_rating')] = defensive.defensive_rating.toString();
        row[newHeader.indexOf('ppg_allowed')] = defensive.ppg_allowed.toString();
        row[newHeader.indexOf('fg_efficiency_allowed')] = defensive.fg_efficiency_allowed.toString();
        row[newHeader.indexOf('three_point_allowed')] = defensive.three_point_allowed.toString();
        row[newHeader.indexOf('rebounding_defense')] = defensive.rebounding_defense.toString();
        row[newHeader.indexOf('turnover_generation')] = defensive.turnover_generation.toString();
      }
    }

    return row;
  });

  // Write updated database
  const output = [
    newHeader.join(','),
    ...updatedRows.map(row => row.map(cell => {
      if (typeof cell === 'string' && cell.includes(',')) {
        return `"${cell}"`;
      }
      return cell;
    }).join(',')),
  ].join('\n');

  fs.writeFileSync(outputPath, output);

  console.log(`✓ Matched ${matched} teams (${((matched / defensiveData.length) * 100).toFixed(1)}%)`);
  console.log(`✓ Updated database with defensive fields\n`);

  // Show top teams with full profiles
  console.log('🏀 TOP 10 TEAMS WITH DEFENSIVE PROFILES:\n');
  let count = 0;
  const updatedTeams = updatedRows
    .map((row, i) => ({
      name: row[teamNameIndex],
      defensive: parseFloat(row[newHeader.indexOf('defensive_rating')] || '0'),
      ppg: parseFloat(row[newHeader.indexOf('ppg_allowed')] || '0'),
    }))
    .filter(t => t.defensive > 0)
    .sort((a, b) => b.defensive - a.defensive);

  for (const team of updatedTeams.slice(0, 10)) {
    console.log(
      `${++count}. ${team.name.padEnd(35)} | ` +
      `Defensive: ${team.defensive.toFixed(3)} | ` +
      `PPG Allowed: ${team.ppg.toFixed(1)}`
    );
  }

  // Coverage summary
  const withStrength = updatedRows.filter(r => r[teamsHeader.indexOf('strength_rating')] || false).length;
  const withOffensive = updatedRows.filter(r => r[teamsHeader.indexOf('offensive_rating')] || false).length;
  const withDefensive = updatedRows.filter(r => r[newHeader.indexOf('defensive_rating')] || false).length;
  const withBoth = updatedRows.filter(r => 
    (r[teamsHeader.indexOf('strength_rating')] || false) && 
    (r[newHeader.indexOf('defensive_rating')] || false)
  ).length;
  const withAll = updatedRows.filter(r => 
    (r[teamsHeader.indexOf('strength_rating')] || false) && 
    (r[teamsHeader.indexOf('offensive_rating')] || false) &&
    (r[newHeader.indexOf('defensive_rating')] || false)
  ).length;

  console.log('\n📊 COVERAGE SUMMARY:\n');
  console.log(`Teams with strength:           ${withStrength}/${updatedRows.length} (${((withStrength / updatedRows.length) * 100).toFixed(1)}%)`);
  console.log(`Teams with offensive:          ${withOffensive}/${updatedRows.length} (${((withOffensive / updatedRows.length) * 100).toFixed(1)}%)`);
  console.log(`Teams with defensive:          ${withDefensive}/${updatedRows.length} (${((withDefensive / updatedRows.length) * 100).toFixed(1)}%)`);
  console.log(`Teams with strength + def:     ${withBoth}/${updatedRows.length} (${((withBoth / updatedRows.length) * 100).toFixed(1)}%)`);
  console.log(`Teams with all 3 metrics:      ${withAll}/${updatedRows.length} (${((withAll / updatedRows.length) * 100).toFixed(1)}%)`);
}

mergeDefensiveStats();
