/**
 * ============================================================================
 * BUILD ESPN TEAM STATS FROM EXISTING CSV DATA
 * ============================================================================
 * 
 * Loads team data from:
 * - offensive_stats_*.csv (latest stats)
 * - defensive_stats_*.csv (defensive metrics)
 * - d1_teams_complete.csv (all D1 teams)
 * 
 * Outputs: espn_team_stats.json with comprehensive team metrics
 * 
 * ============================================================================
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

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
 * Parse CSV file line by line
 */
async function parseCSV(filePath: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const lines: string[][] = [];
    const stream = createReadStream(filePath, { encoding: 'utf-8' });
    
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });
    
    rl.on('line', (line) => {
      // Simple CSV parsing (handles basic cases)
      lines.push(line.split(','));
    });
    
    rl.on('close', () => resolve(lines));
    rl.on('error', reject);
  });
}

/**
 * Load offensive stats from CSV
 */
async function loadOffensiveStats(): Promise<Map<string, any>> {
  console.log('📊 Loading offensive stats...');
  
  const statsDir = path.join(root, 'data', 'raw');
  const files = await fs.readdir(statsDir);
  
  // Find latest offensive stats file
  const offensiveFile = files
    .filter(f => f.startsWith('offensive_stats_') && f.endsWith('.csv'))
    .sort()
    .pop();
  
  if (!offensiveFile) {
    console.warn('⚠️  No offensive stats file found');
    return new Map();
  }
  
  const filePath = path.join(statsDir, offensiveFile);
  console.log(`  Loading from ${offensiveFile}`);
  
  const lines = await parseCSV(filePath);
  const headers = lines[0];
  const stats = new Map<string, any>();
  
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const obj: any = {};
    headers.forEach((h, idx) => obj[h.trim()] = row[idx] ? row[idx].trim() : '');
    
    const teamName = obj.team_name || '';
    if (teamName) {
      stats.set(teamName, obj);
    }
  }
  
  console.log(`  ✓ Loaded stats for ${stats.size} teams`);
  return stats;
}

/**
 * Load defensive stats from CSV
 */
async function loadDefensiveStats(): Promise<Map<string, any>> {
  console.log('🛡️  Loading defensive stats...');
  
  const statsDir = path.join(root, 'data', 'raw');
  const files = await fs.readdir(statsDir);
  
  // Find latest defensive stats file
  const defensiveFile = files
    .filter(f => f.startsWith('defensive_stats_') && f.endsWith('.csv'))
    .sort()
    .pop();
  
  if (!defensiveFile) {
    console.warn('⚠️  No defensive stats file found');
    return new Map();
  }
  
  const filePath = path.join(statsDir, defensiveFile);
  console.log(`  Loading from ${defensiveFile}`);
  
  const lines = await parseCSV(filePath);
  const headers = lines[0];
  const stats = new Map<string, any>();
  
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const obj: any = {};
    headers.forEach((h, idx) => obj[h.trim()] = row[idx] ? row[idx].trim() : '');
    
    const teamName = obj.team_name || '';
    if (teamName) {
      stats.set(teamName, obj);
    }
  }
  
  console.log(`  ✓ Loaded stats for ${stats.size} teams`);
  return stats;
}

/**
 * Load all D1 teams
 */
async function loadAllTeams(): Promise<string[]> {
  console.log('👥 Loading all D1 teams...');
  
  const filePath = path.join(root, 'data', 'raw', 'd1_teams_complete.csv');
  const lines = await parseCSV(filePath);
  const headers = lines[0];
  
  const teams: string[] = [];
  const teamNameIdx = headers.indexOf('team_name');
  
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const teamName = row[teamNameIdx];
    if (teamName) {
      teams.push(teamName);
    }
  }
  
  console.log(`  ✓ Loaded ${teams.length} D1 teams`);
  return teams;
}

/**
 * Combine stats to create ESPN team stats
 */
async function buildTeamStats(): Promise<ESPNTeamStats[]> {
  console.log('\n📈 Building team stats...');
  
  const offStats = await loadOffensiveStats();
  const defStats = await loadDefensiveStats();
  const allTeams = await loadAllTeams();
  
  const teams: ESPNTeamStats[] = [];
  
  for (const teamName of allTeams) {
    const offStat = offStats.get(teamName);
    const defStat = defStats.get(teamName);
    
    // Extract metrics with fallbacks
    const pts_for = offStat ? parseFloat(offStat.pts) || 74.0 : 74.0;
    const pts_against = defStat ? parseFloat(defStat.pts) || 70.0 : 70.0;
    const fg_pct = offStat ? (parseFloat(offStat.fg_pct) || 45.0) / 100.0 : 0.45;
    const reb = offStat ? parseFloat(offStat.reb) || 40.0 : 40.0;
    const ast = offStat ? parseFloat(offStat.ast) || 15.0 : 15.0;
    const to_margin = (offStat ? parseFloat(offStat.to) || 12.0 : 12.0) - 
                      (defStat ? parseFloat(defStat.to) || 12.0 : 12.0);
    
    teams.push({
      team_name: teamName,
      conference: 'Unknown',
      wins: 0,
      losses: 0,
      pts_for,
      pts_against,
      fg_pct,
      reb,
      ast,
      turnover_margin: to_margin,
    });
  }
  
  console.log(`  ✓ Built stats for ${teams.length} teams`);
  return teams;
}

/**
 * Save teams to JSON
 */
async function saveTeams(teams: ESPNTeamStats[]): Promise<void> {
  const outputPath = path.join(root, 'data', 'processed', 'espn_team_stats.json');
  
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(teams, null, 2), 'utf-8');
  
  console.log(`\n✅ Saved ${teams.length} teams to espn_team_stats.json`);
}

/**
 * Main
 */
async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('BUILD ESPN TEAM STATS FROM CSV DATA');
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`${'='.repeat(80)}\n`);
  
  try {
    const teams = await buildTeamStats();
    
    if (teams.length > 0) {
      await saveTeams(teams);
      console.log('✅ Team stats built successfully!');
    } else {
      console.log('❌ Failed to build team stats');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
