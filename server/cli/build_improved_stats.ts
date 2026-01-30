/**
 * ============================================================================
 * IMPROVED TEAM STATS BUILDER WITH SMART MATCHING
 * ============================================================================
 * 
 * Combines offensive + defensive stats with intelligent team name matching
 * Handles name variations and provides better data quality
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
 * Normalize team names for matching
 * Removes mascot, handles common variations
 */
function normalizeTeamName(name: string): string {
  if (!name) return '';
  
  // Remove common suffixes
  let normalized = name
    .replace(/\s+(Wolverines|Spartans|Panthers|Tigers|Eagles|Hawks|Owls|Bulls|Hurricanes|Deacons|Demons|Knights|Crimson|Tide|Bulldogs|Wildcats|Gators|Razorbacks|Cavilers|Spiders|Hokies|Friars|Bears|Bruins|Trojans|Ducks|Beavers|Cougars|Utes|Sun Devils|Jayhawks|Longhorns|Aggies|Mustangs|Red Raiders|Mountaineers|Sooners|Cowboys|Crimson Tide|Golden Eagles|Blue Devils|Tar Heels|Demon Deacons|Seminoles|Hurricanes|Yellow Jackets|Cardinals|Fighting Irish|Boilermakers|Hoosiers|Badgers|Buckeyes|Nittany Lions|Scarlet Knights|Terrapins|Cavaliers|Hokies|Commodores|Volunteers|Rebels|Bulldogs)$/i, '')
    .trim()
    .toLowerCase();
  
  return normalized;
}

/**
 * Find best team match between two lists
 */
function findBestMatch(targetName: string, candidates: Map<string, any>): any | null {
  const normalized = normalizeTeamName(targetName);
  
  // Try exact normalized match
  for (const [key, value] of candidates) {
    if (normalizeTeamName(key) === normalized) {
      return value;
    }
  }
  
  // Try partial match
  for (const [key, value] of candidates) {
    const keyNorm = normalizeTeamName(key);
    if (keyNorm && normalized && (keyNorm.includes(normalized.split(' ')[0]) || normalized.includes(keyNorm.split(' ')[0]))) {
      return value;
    }
  }
  
  return null;
}

/**
 * Parse CSV data
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
 * Main: Build improved team stats
 */
async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('IMPROVED TEAM STATS BUILDER');
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const rawDir = path.join(root, 'data', 'raw');

    // Find latest files
    const files = await fs.readdir(rawDir);
    const offensiveFile = files.filter(f => f.startsWith('offensive_stats_') && f.endsWith('.csv')).sort().pop();
    const defensiveFile = files.filter(f => f.startsWith('defensive_stats_') && f.endsWith('.csv')).sort().pop();

    if (!offensiveFile || !defensiveFile) {
      console.error('❌ Missing stats files');
      process.exit(1);
    }

    console.log(`📂 Offensive: ${offensiveFile}`);
    console.log(`📂 Defensive: ${defensiveFile}\n`);

    // Load data
    const offensiveContent = readFileSync(path.join(rawDir, offensiveFile), 'utf-8');
    const defensiveContent = readFileSync(path.join(rawDir, defensiveFile), 'utf-8');

    const offensiveRows = parseCSV(offensiveContent);
    const defensiveRows = parseCSV(defensiveContent);

    // Build maps with original names for lookup
    const offensiveMap = new Map<string, Record<string, string>>();
    for (const row of offensiveRows) {
      const name = row.team_name;
      if (name) {
        offensiveMap.set(name, row);
      }
    }

    const defensiveMap = new Map<string, Record<string, string>>();
    for (const row of defensiveRows) {
      const name = row.Team;
      if (name) {
        defensiveMap.set(name, row);
      }
    }

    console.log(`✓ Offensive stats: ${offensiveMap.size} teams`);
    console.log(`✓ Defensive stats: ${defensiveMap.size} teams\n`);

    // Build combined stats with intelligent matching
    const teams: ESPNTeamStats[] = [];
    const processed = new Set<string>();
    let matched = 0;
    let partialMatch = 0;

    // Process offensive teams first (best data)
    for (const [offName, offRow] of offensiveMap) {
      const normalized = normalizeTeamName(offName);
      if (processed.has(normalized)) continue;
      processed.add(normalized);

      // Try to find matching defensive stats
      let defRow = defensiveMap.get(offName);
      if (!defRow) {
        defRow = findBestMatch(offName, defensiveMap);
        if (defRow) partialMatch++;
      } else {
        matched++;
      }

      const pts_for = parseFloat(offRow.pts) || 75.0;
      const pts_against = defRow ? (parseFloat(defRow.PTS) || 72.0) : 72.0;
      const fg_pct = parseFloat(offRow.fg_pct) || 0.45;
      const reb = parseFloat(offRow.reb) || 40.0;
      const ast = parseFloat(offRow.ast) || 15.0;
      const to = parseFloat(offRow.to) || 0;

      teams.push({
        team_name: offName,
        conference: 'D1',
        wins: 0,
        losses: 0,
        pts_for,
        pts_against,
        fg_pct,
        reb,
        ast,
        turnover_margin: to,
      });
    }

    // Process defensive-only teams
    for (const [defName, defRow] of defensiveMap) {
      const normalized = normalizeTeamName(defName);
      if (processed.has(normalized)) continue;
      processed.add(normalized);

      const pts_for = 75.0; // Default
      const pts_against = parseFloat(defRow.PTS) || 72.0;

      teams.push({
        team_name: defName,
        conference: 'D1',
        wins: 0,
        losses: 0,
        pts_for,
        pts_against,
        fg_pct: 0.45,
        reb: 40.0,
        ast: 15.0,
        turnover_margin: 0,
      });
    }

    console.log(`✓ Exact matches: ${matched}`);
    console.log(`✓ Partial matches: ${partialMatch}`);
    console.log(`✅ Combined stats for ${teams.length} teams\n`);

    // Save to JSON
    const outputPath = path.join(root, 'data', 'processed', 'espn_team_stats.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(teams, null, 2), 'utf-8');

    console.log(`✅ Saved to espn_team_stats.json`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
