/**
 * ============================================================================
 * CONVERT OFFENSIVE STATS CSV TO JSON
 * ============================================================================
 * 
 * Loads the latest offensive_stats_*.csv file and converts to espn_team_stats.json
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
 * Main: Load offensive stats CSV and convert to JSON
 */
async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('CONVERT OFFENSIVE STATS TO JSON');
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    // Find latest offensive stats file
    const statsDir = path.join(root, 'data', 'raw');
    const files = await fs.readdir(statsDir);
    const offensiveFile = files
      .filter(f => f.startsWith('offensive_stats_') && f.endsWith('.csv'))
      .sort()
      .pop();

    if (!offensiveFile) {
      console.error('❌ No offensive stats file found');
      process.exit(1);
    }

    console.log(`📂 Using: ${offensiveFile}`);
    const filePath = path.join(statsDir, offensiveFile);

    // Read CSV file
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split(/\r?\n/);
    const headers = lines[0].split(',');

    const teams: ESPNTeamStats[] = [];
    let processed = 0;
    let skipped = 0;

    // Parse each line
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      const row: Record<string, string> = {};
      
      headers.forEach((h, idx) => {
        row[h.trim()] = parts[idx] || '';
      });

      const teamName = row.team_name?.trim();
      if (!teamName) {
        skipped++;
        continue;
      }

      // Parse stats
      const pts_for = parseFloat(row.pts) || 75.0;
      const fg_pct = parseFloat(row.fg_pct) || 0.45;
      const reb = parseFloat(row.reb) || 40.0;
      const ast = parseFloat(row.ast) || 15.0;

      // Estimate pts_against (using average D1 for now since we don't have defense in offensive stats)
      const pts_against = 72.0;

      teams.push({
        team_name: teamName,
        conference: 'D1', // Will be updated if we have conference data
        wins: 0,
        losses: 0,
        pts_for,
        pts_against,
        fg_pct,
        reb,
        ast,
        turnover_margin: parseFloat(row.to) || 0,
      });

      processed++;
    }

    console.log(`✅ Processed ${processed} teams`);
    console.log(`⏭️  Skipped ${skipped} invalid entries`);

    // Save to JSON
    const outputPath = path.join(root, 'data', 'processed', 'espn_team_stats.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(teams, null, 2), 'utf-8');

    console.log(`✅ Saved to espn_team_stats.json\n`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
