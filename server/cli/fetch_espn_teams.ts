/**
 * Fetch team data from ESPN API + ESPN teams list
 * Uses ESPN's public endpoints to get comprehensive team info
 */

import * as fs from 'fs';
import * as path from 'path';

interface TeamData {
  teamName: string;
  espnId: string;
  conference: string;
  wins: number;
  losses: number;
}

async function fetchESPNTeams(): Promise<TeamData[]> {
  console.log('📊 Fetching ESPN D1 teams...');
  
  try {
    // ESPN's CBB API endpoint for teams
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: any = await response.json();
    const teams: TeamData[] = [];

    if (data.sports && data.sports[0] && data.sports[0].leagues) {
      const league = data.sports[0].leagues[0];
      if (league.teams) {
        for (const teamGroup of league.teams) {
          const team = teamGroup.team || teamGroup;
          
          teams.push({
            teamName: team.displayName || team.name || '',
            espnId: team.id || '',
            conference: team.conferenceId || team.conference?.displayName || 'Unknown',
            wins: 0,
            losses: 0
          });
        }
      }
    }

    if (teams.length > 0) {
      console.log(`✓ ESPN: ${teams.length} teams fetched`);
      return teams;
    }

    throw new Error('No teams found in ESPN response');
  } catch (err) {
    console.error(`✗ ESPN teams fetch failed:`, err);
    return [];
  }
}

async function fetchTeamStandings(): Promise<TeamData[]> {
  console.log('📊 Fetching team standings...');
  
  try {
    // Current season standings
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/standings';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: any = await response.json();
    const teams: TeamData[] = [];

    if (data.standings) {
      for (const conference of data.standings) {
        const confName = conference.name || conference.displayName || 'Unknown';
        
        if (conference.teams) {
          for (const teamData of conference.teams) {
            const team = teamData.team || {};
            const record = teamData.stats?.find((s: any) => s.name === 'wins');
            const losses = teamData.stats?.find((s: any) => s.name === 'losses');
            
            teams.push({
              teamName: team.displayName || team.name || '',
              espnId: team.id || '',
              conference: confName,
              wins: record?.value || 0,
              losses: losses?.value || 0
            });
          }
        }
      }
    }

    if (teams.length > 0) {
      console.log(`✓ Standings: ${teams.length} teams with records`);
      return teams;
    }

    throw new Error('No standings found');
  } catch (err) {
    console.error(`✗ Standings fetch failed:`, err);
    return [];
  }
}

async function main() {
  console.log('\n🔄 Starting ESPN-based team data fetch...\n');

  // Fetch from ESPN
  const espnTeams = await fetchESPNTeams();
  const standings = await fetchTeamStandings();

  // Merge data
  const teamMap = new Map<string, TeamData>();
  
  // Add standings (more complete)
  for (const team of standings) {
    teamMap.set(team.teamName.toLowerCase(), team);
  }
  
  // Fill in gaps from direct teams list
  for (const team of espnTeams) {
    const key = team.teamName.toLowerCase();
    if (!teamMap.has(key)) {
      teamMap.set(key, team);
    }
  }

  console.log(`\n✓ Total teams collected: ${teamMap.size}`);

  // Output CSV with all available data
  const outputPath = path.join(process.cwd(), 'data', 'raw', 'espn_teams.csv');
  const csvContent = [
    'teamName,espnId,conference,wins,losses',
    ...Array.from(teamMap.values()).map(
      (t) => `"${t.teamName}","${t.espnId}","${t.conference}",${t.wins},${t.losses}`
    )
  ].join('\n');

  fs.writeFileSync(outputPath, csvContent);
  console.log(`\n📁 Saved to: ${outputPath}`);

  // Summary by conference
  const byConf = new Map<string, number>();
  for (const [_, team] of teamMap) {
    byConf.set(team.conference, (byConf.get(team.conference) || 0) + 1);
  }

  console.log('\n📊 Teams by conference:');
  for (const [conf, count] of Array.from(byConf.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${conf}: ${count}`);
  }
}

main().catch(console.error);
