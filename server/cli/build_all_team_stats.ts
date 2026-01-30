/**
 * ============================================================================
 * BUILD COMPREHENSIVE ESPN STATS FROM ALL AVAILABLE DATA
 * ============================================================================
 * 
 * Combines:
 * - offensive_stats_*.csv (offensive metrics)
 * - defensive_stats_*.csv (defensive metrics / opponent stats)
 * 
 * Outputs: espn_team_stats.json with all D1 teams
 * 
 * ============================================================================
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

interface ESPNTeamStats {
  team_name: string;
  conference: string;
  wins: number;
  losses: number;
  pts_for: number;
  pts_against: number;
  fg_pct: number;
  reb: number;
  ast: number;
  turnover_margin: number;
}

/**
 * Load CSV data
 */
function parseCSV(content: string): Array<Record<string, string>> {
  const lines = content.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim());
  const rows: Array<Record<string, string>> = [];
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (parts[idx] || '').trim();
    });
    rows.push(row);
  }
  
  return rows;
}

/**
 * Main: Build comprehensive team stats
 */
async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('BUILD COMPREHENSIVE ESPN STATS');
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const rawDir = path.join(root, 'data', 'raw');

    // Find latest files
    const files = await fs.readdir(rawDir);
    const offensiveFile = files.filter(f => f.startsWith('offensive_stats_') && f.endsWith('.csv')).sort().pop();
    const defensiveFile = files.filter(f => f.startsWith('defensive_stats_') && f.endsWith('.csv')).sort().pop();

    if (!offensiveFile || !defensiveFile) {
      console.error('❌ Missing offensive or defensive stats files');
      process.exit(1);
    }

    console.log(`📂 Using: ${offensiveFile}`);
    console.log(`📂 Using: ${defensiveFile}\n`);

    // Load data
    const offensiveContent = readFileSync(path.join(rawDir, offensiveFile), 'utf-8');
    const defensiveContent = readFileSync(path.join(rawDir, defensiveFile), 'utf-8');

    const offensiveRows = parseCSV(offensiveContent);
    const defensiveRows = parseCSV(defensiveContent);

    // Build offensive stats map
    const offensiveMap = new Map<string, Record<string, string>>();
    for (const row of offensiveRows) {
      const name = row.team_name?.toLowerCase();
      if (name) {
        offensiveMap.set(name, row);
      }
    }

    // Build defensive stats map (opponent stats = defensive metrics)
    const defensiveMap = new Map<string, Record<string, string>>();
    for (const row of defensiveRows) {
      const name = row.Team?.toLowerCase();
      if (name) {
        defensiveMap.set(name, row);
      }
    }

    // Combine all team names
    const teamNames = new Set<string>();
    offensiveMap.forEach((_, name) => teamNames.add(name));
    defensiveMap.forEach((_, name) => teamNames.add(name));

    console.log(`✓ Offensive stats: ${offensiveMap.size} teams`);
    console.log(`✓ Defensive stats: ${defensiveMap.size} teams`);
    console.log(`✓ Total unique teams: ${teamNames.size}\n`);

    // Build combined stats
    const teams: ESPNTeamStats[] = [];
    let processed = 0;

    for (const lowerName of Array.from(teamNames).sort()) {
      const offRow = offensiveMap.get(lowerName);
      const defRow = defensiveMap.get(lowerName);

      // Get display name
      let displayName = lowerName;
      if (offRow?.team_name) {
        displayName = offRow.team_name;
      } else if (defRow?.Team) {
        displayName = defRow.Team;
      }

      // Parse offensive stats
      const pts_for = offRow ? (parseFloat(offRow.pts) || 75.0) : 75.0;
      const fg_pct_off = offRow ? (parseFloat(offRow.fg_pct) || 0.45) : 0.45;
      const reb_off = offRow ? (parseFloat(offRow.reb) || 40.0) : 40.0;
      const ast = offRow ? (parseFloat(offRow.ast) || 15.0) : 15.0;
      const to = offRow ? (parseFloat(offRow.to) || 0) : 0;

      // Parse defensive stats (opponent points = our defensive rating)
      const pts_against = defRow ? (parseFloat(defRow.PTS) || 72.0) : 72.0;

      teams.push({
        team_name: displayName,
        conference: 'D1',
        wins: 0,
        losses: 0,
        pts_for,
        pts_against,
        fg_pct: fg_pct_off,
        reb: reb_off,
        ast,
        turnover_margin: to,
      });

      processed++;
    }

    console.log(`✅ Combined stats for ${processed} teams\n`);

    // Save to JSON
    const outputPath = path.join(root, 'data', 'processed', 'espn_team_stats.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(teams, null, 2), 'utf-8');

    console.log(`✅ Saved to espn_team_stats.json`);
    console.log(`   Sample teams: ${teams.slice(0, 3).map(t => t.team_name).join(', ')}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
