/**
 * Comprehensive team ratings fetcher with multiple fallback sources
 * Tries: BartTorvik → T-Rank → Sagarin → Conference averages
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

interface TeamRating {
  team: string;
  adjO: number;
  adjD: number;
  source: string;
}

// BartTorvik scraper
async function fetchBarttorvik(): Promise<TeamRating[]> {
  console.log('📊 Fetching BartTorvik ratings...');
  try {
    const url = 'https://barttorvik.com/trank.php?year=2026&sort=&top=0&conlimit=All';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const teams: TeamRating[] = [];

    // Parse table rows - match entire table structure
    const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
    if (!tableMatch) throw new Error('Table not found');

    const tableHtml = tableMatch[1];
    const rows = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];

    for (const row of rows) {
      if (row.includes('<th')) continue; // Skip header rows

      // Extract cells
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
      if (cells.length < 10) continue;

      // Clean cell content
      const cleanCell = (cell: string): string =>
        cell
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .trim();

      const teamName = cleanCell(cells[1]);
      const adjOStr = cleanCell(cells[4]);
      const adjDStr = cleanCell(cells[5]);

      const adjO = parseFloat(adjOStr);
      const adjD = parseFloat(adjDStr);

      if (teamName && isFinite(adjO) && isFinite(adjD)) {
        teams.push({
          team: teamName,
          adjO,
          adjD,
          source: 'BartTorvik'
        });
      }
    }

    if (teams.length > 0) {
      console.log(`✓ BartTorvik: ${teams.length} teams`);
      return teams;
    }
    throw new Error('No teams parsed from BartTorvik');
  } catch (err) {
    console.log(`✗ BartTorvik failed: ${err}`);
    return [];
  }
}

// T-Rank scraper (alternative to KenPom)
async function fetchTRank(): Promise<TeamRating[]> {
  console.log('📊 Fetching T-Rank ratings...');
  try {
    const url = 'https://www.torvik.dev/';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const teams: TeamRating[] = [];

    // T-Rank uses JSON data in script tags
    const jsonMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (!jsonMatch) throw new Error('Data not found in T-Rank page');

    // Look for team data patterns
    const lines = jsonMatch[1].split('\n');
    for (const line of lines) {
      // Match patterns like: ["Team Name", rating1, rating2, ...]
      const match = line.match(/\["([^"]+)",([0-9.]+),([0-9.]+)/);
      if (match) {
        teams.push({
          team: match[1],
          adjO: parseFloat(match[2]),
          adjD: parseFloat(match[3]),
          source: 'T-Rank'
        });
      }
    }

    if (teams.length > 0) {
      console.log(`✓ T-Rank: ${teams.length} teams`);
      return teams;
    }
    throw new Error('No teams parsed from T-Rank');
  } catch (err) {
    console.log(`✗ T-Rank failed: ${err}`);
    return [];
  }
}

// Sagarin ratings (free, historical)
async function fetchSagarin(): Promise<TeamRating[]> {
  console.log('📊 Fetching Sagarin ratings...');
  try {
    const url = 'https://www.mratings.com/cbb/data/all-ratings';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const teams: TeamRating[] = [];

    // Sagarin format: Team Rating Strength Schedule
    const lines = html.split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        const teamName = parts.slice(0, -3).join(' ');
        const rating = parseFloat(parts[parts.length - 3]);
        const strength = parseFloat(parts[parts.length - 2]);

        // Convert to AdjO/AdjD-like scale (rough approximation)
        if (teamName && isFinite(rating) && isFinite(strength)) {
          teams.push({
            team: teamName,
            adjO: rating,
            adjD: 100 - strength,
            source: 'Sagarin'
          });
        }
      }
    }

    if (teams.length > 0) {
      console.log(`✓ Sagarin: ${teams.length} teams`);
      return teams;
    }
    throw new Error('No teams parsed from Sagarin');
  } catch (err) {
    console.log(`✗ Sagarin failed: ${err}`);
    return [];
  }
}

// Load existing KenPom data we have
function loadExistingKenPom(): TeamRating[] {
  try {
    const kenpomPath = path.join(process.cwd(), 'data', 'raw', 'kenpom_2024.csv');
    if (!fs.existsSync(kenpomPath)) return [];

    const content = fs.readFileSync(kenpomPath, 'utf8');
    const rows = parse(content, { columns: true, skip_empty_lines: true }) as any[];

    return rows
      .map((r: any) => ({
        team: r.Team || r.team || '',
        adjO: parseFloat(r.AdjO || r.adjO || '0'),
        adjD: parseFloat(r.AdjD || r.adjD || '0'),
        source: 'KenPom'
      }))
      .filter((t: TeamRating) => t.team && isFinite(t.adjO) && isFinite(t.adjD));
  } catch (err) {
    console.log(`✗ Loading existing KenPom failed: ${err}`);
    return [];
  }
}

// Merge ratings, preferring sources in order
function mergeRatings(allRatings: TeamRating[][]): Map<string, TeamRating> {
  const merged = new Map<string, TeamRating>();

  // Flatten and normalize team names
  const normalize = (name: string): string => name.trim().toLowerCase().replace(/[^\w]/g, '');

  // Add in priority order (first source wins for duplicates)
  for (const source of allRatings) {
    for (const rating of source) {
      const key = normalize(rating.team);
      if (!merged.has(key)) {
        merged.set(key, rating);
      }
    }
  }

  return merged;
}

// Calculate conference averages for teams without data
function fillWithConferenceAverages(
  ratings: Map<string, TeamRating>,
  allTeams: string[]
): Map<string, TeamRating> {
  const conferenceMap = new Map<string, { adjO: number[]; adjD: number[] }>();

  // Group by conference (rough guess based on team name patterns)
  const conferencePatterns: Record<string, RegExp> = {
    'Big Ten': /Ohio St|Michigan|Penn St|Wisconsin|Indiana|Illinois|Purdue|Northwestern|Minnesota|Iowa|Nebraska|Rutgers/i,
    'ACC': /Duke|Carolina|Virginia|Syracuse|Louisville|Boston College|Clemson|Georgia Tech|Miami|Wake Forest/i,
    'SEC': /Alabama|Auburn|Arkansas|Florida|Georgia|LSU|Ole Miss|Mississippi St|Missouri|South Carolina|Tennessee|Vanderbilt|Kentucky/i,
    'Pac-12': /UCLA|USC|Oregon|Washington|Arizona|Colorado|Utah|Stanford|Cal/i,
    'Big 12': /Baylor|Texas|Oklahoma|Kansas|TCU|West Virginia|Iowa St|Oklahoma St|Texas Tech/i,
    'Big East': /Georgetown|Villanova|Providence|Marquette|DePaul|Butler|Creighton|Seton Hall/i,
    'MAC': /Central Michigan|Western Michigan|Ball State|Bowling Green|Kent State|Miami Ohio|Ohio University|Toledo|Akron/i,
    'C-USA': /East Carolina|Houston|Memphis|SMU|Tulane|UCF|Temple|Rice/i,
  };

  // Build conference map from existing ratings
  for (const [_, rating] of ratings) {
    for (const [conf, pattern] of Object.entries(conferencePatterns)) {
      if (pattern.test(rating.team)) {
        if (!conferenceMap.has(conf)) {
          conferenceMap.set(conf, { adjO: [], adjD: [] });
        }
        const stats = conferenceMap.get(conf)!;
        stats.adjO.push(rating.adjO);
        stats.adjD.push(rating.adjD);
      }
    }
  }

  // Calculate averages and fill gaps
  const filled = new Map(ratings);
  const normalize = (name: string): string => name.trim().toLowerCase().replace(/[^\w]/g, '');

  for (const team of allTeams) {
    const key = normalize(team);
    if (!filled.has(key)) {
      // Find conference
      let confAvg: { adjO: number; adjD: number } | null = null;
      for (const [conf, pattern] of Object.entries(conferencePatterns)) {
        if (pattern.test(team)) {
          const stats = conferenceMap.get(conf);
          if (stats && stats.adjO.length > 0) {
            confAvg = {
              adjO: stats.adjO.reduce((a, b) => a + b, 0) / stats.adjO.length,
              adjD: stats.adjD.reduce((a, b) => a + b, 0) / stats.adjD.length
            };
          }
          break;
        }
      }

      if (confAvg) {
        filled.set(key, {
          team,
          adjO: confAvg.adjO,
          adjD: confAvg.adjD,
          source: 'Conference Average'
        });
      } else {
        // Final fallback to neutral
        filled.set(key, {
          team,
          adjO: 100,
          adjD: 100,
          source: 'Neutral (No Data)'
        });
      }
    }
  }

  return filled;
}

async function main() {
  console.log('\n🔄 Starting comprehensive team ratings fetch...\n');

  // Fetch from multiple sources
  const barttorvik = await fetchBarttorvik();
  const trank = await fetchTRank();
  const sagarin = await fetchSagarin();
  const kenpom = loadExistingKenPom();

  // Merge with priority: BartTorvik > T-Rank > Sagarin > KenPom
  const merged = mergeRatings([barttorvik, trank, sagarin, kenpom]);

  console.log(`\n✓ Total unique teams collected: ${merged.size}`);

  // Output CSV
  const outputPath = path.join(process.cwd(), 'data', 'raw', 'comprehensive_ratings.csv');
  const csvContent = [
    'team,adjO,adjD,source',
    ...Array.from(merged.values()).map(
      (r) => `"${r.team}",${r.adjO.toFixed(2)},${r.adjD.toFixed(2)},${r.source}`
    )
  ].join('\n');

  fs.writeFileSync(outputPath, csvContent);
  console.log(`\n📁 Saved to: ${outputPath}`);

  // Summary by source
  const bySource = new Map<string, number>();
  for (const [_, rating] of merged) {
    bySource.set(rating.source, (bySource.get(rating.source) || 0) + 1);
  }

  console.log('\n📊 Teams by source:');
  for (const [source, count] of Array.from(bySource.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${source}: ${count}`);
  }
}

main().catch(console.error);
