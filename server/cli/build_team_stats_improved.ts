/**
 * ============================================================================
 * IMPROVED TEAM STATS BUILDER - FUZZY MATCHING & COMPREHENSIVE COVERAGE
 * ============================================================================
 * 
 * Enhancements:
 * - Fuzzy name matching (handles name variations)
 * - Loads ALL defensive stats (365 teams)
 * - Better pts_against estimation
 * - Team strength scoring improvements
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
 * Normalize team name for matching
 */
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    // Remove common suffixes for matching
    .replace(/\s+(gators|bulldogs|panthers|wildcats|crimson|tide|aggies|billikens|wolverines|bulls|razorbacks|bears|cougars|trojans|cowboys|longhorns|cardinals|jaguars|falcons|cyclones|devils|illini|wolfpack|cavaliers|hurricanes|titans|red\s+raiders|rams|pioneers|knights|mustangs|eagles|owls|racers|friars|hurricane|owls|bearkats|ospreys|huskies)$/i, '')
    .trim();
}

/**
 * Calculate similarity between two strings (Levenshtein-ish)
 */
function stringSimilarity(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  const maxLen = Math.max(aLen, bLen);
  
  if (maxLen === 0) return 1.0;
  
  let matches = 0;
  const minLen = Math.min(aLen, bLen);
  
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) matches++;
  }
  
  return matches / maxLen;
}

/**
 * Find best matching team name
 */
function findBestMatch(needle: string, haystack: Set<string>): string | null {
  const normNeedle = normalizeTeamName(needle);
  let bestMatch = null;
  let bestScore = 0.6; // Minimum 60% similarity
  
  for (const hay of haystack) {
    const normHay = normalizeTeamName(hay);
    
    // Exact match
    if (normNeedle === normHay) return hay;
    
    // Partial match
    if (normNeedle.includes(normHay) || normHay.includes(normNeedle)) {
      return hay;
    }
    
    // Similarity score
    const score = stringSimilarity(normNeedle, normHay);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = hay;
    }
  }
  
  return bestMatch;
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
    if (row[headers[0]]) { // Skip empty rows
      rows.push(row);
    }
  }
  
  return rows;
}

/**
 * Main: Build improved team stats
 */
async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('IMPROVED TEAM STATS BUILDER - FUZZY MATCHING');
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
    const offensiveNames = new Set<string>();
    
    for (const row of offensiveRows) {
      const name = row.team_name;
      if (name) {
        offensiveMap.set(name.toLowerCase(), row);
        offensiveNames.add(name);
      }
    }

    // Build defensive stats map (ALL teams)
    const defensiveMap = new Map<string, Record<string, string>>();
    const defensiveNames = new Set<string>();
    
    for (const row of defensiveRows) {
      const name = row.Team;
      if (name) {
        defensiveMap.set(name.toLowerCase(), row);
        defensiveNames.add(name);
      }
    }

    console.log(`✓ Offensive stats: ${offensiveMap.size} teams`);
    console.log(`✓ Defensive stats: ${defensiveMap.size} teams`);

    // Combine all team names with fuzzy matching
    const allTeams = new Map<string, { off: Record<string, string> | null; def: Record<string, string> | null }>();
    
    // Add all offensive teams
    for (const [key, offRow] of offensiveMap) {
      allTeams.set(key, { off: offRow, def: null });
    }
    
    // Match defensive teams to offensive (or create new entries)
    let matched = 0;
    let newTeams = 0;
    
    for (const defName of defensiveNames) {
      const defKey = defName.toLowerCase();
      
      if (allTeams.has(defKey)) {
        // Exact match
        allTeams.get(defKey)!.def = defensiveMap.get(defKey)!;
        matched++;
      } else {
        // Try fuzzy matching
        const bestOffMatch = findBestMatch(defName, offensiveNames);
        if (bestOffMatch) {
          const bestKey = bestOffMatch.toLowerCase();
          allTeams.get(bestKey)!.def = defensiveMap.get(defKey)!;
          matched++;
        } else {
          // New team (defensive only)
          allTeams.set(defKey, { off: null, def: defensiveMap.get(defKey)! });
          newTeams++;
        }
      }
    }
    
    console.log(`✓ Fuzzy matched: ${matched} defensive to offensive`);
    console.log(`✓ New teams (def only): ${newTeams}`);
    console.log(`✓ Total unique teams: ${allTeams.size}\n`);

    // Build combined stats
    const teams: ESPNTeamStats[] = [];
    let processed = 0;
    let missingDefStats = 0;

    for (const [key, { off, def }] of allTeams) {
      // Get display name
      let displayName = key;
      if (off?.team_name) {
        displayName = off.team_name;
      } else if (def?.Team) {
        displayName = def.Team;
      }

      // Parse offensive stats
      const pts_for = off ? (parseFloat(off.pts) || 75.0) : 75.0;
      const fg_pct_off = off ? (parseFloat(off.fg_pct) || 0.45) : 0.45;
      const reb_off = off ? (parseFloat(off.reb) || 40.0) : 40.0;
      const ast = off ? (parseFloat(off.ast) || 15.0) : 15.0;
      const to = off ? (parseFloat(off.to) || 0) : 0;

      // Parse defensive stats (opponent points = our defensive rating)
      let pts_against = def ? (parseFloat(def.PTS) || null) : null;
      
      if (pts_against === null) {
        // Estimate if missing: use league average minus some variance based on offense
        // Good offenses tend to face better defenses
        pts_against = 72 - (pts_for - 75.0) * 0.3;
        missingDefStats++;
      }

      teams.push({
        team_name: displayName,
        conference: 'D1',
        wins: 0,
        losses: 0,
        pts_for,
        pts_against: Math.max(60, pts_against), // Min 60 PPG allowed
        fg_pct: fg_pct_off,
        reb: reb_off,
        ast,
        turnover_margin: to,
      });

      processed++;
    }

    console.log(`✅ Built stats for ${processed} teams`);
    console.log(`   ${missingDefStats} teams using estimated defense\n`);

    // Save to JSON
    const outputPath = path.join(root, 'data', 'processed', 'espn_team_stats.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(teams, null, 2), 'utf-8');

    console.log(`✅ Saved to espn_team_stats.json`);
    console.log(`   Teams: ${teams.length}`);
    console.log(`   Top 3: ${teams.slice(0, 3).map(t => t.team_name).join(', ')}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
