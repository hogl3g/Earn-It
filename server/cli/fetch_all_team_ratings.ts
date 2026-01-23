import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'raw');

interface TeamRating {
  team: string;
  conference?: string;
  offRating?: number;
  defRating?: number;
  source: string;
}

// Try multiple sources for team data
async function fetchKenPomTeams(): Promise<TeamRating[]> {
  console.log('🔄 Fetching KenPom teams...');
  try {
    const response = await fetch('https://kenpom.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await response.text();
    
    // Look for team table data
    const teamMatches = html.match(/<a href="\/team\.php\?team=([^"]+)"[^>]*>([^<]+)<\/a>/g) || [];
    const teams = teamMatches.map(match => {
      const nameMatch = match.match(/>([^<]+)<\/a>/);
      if (nameMatch) {
        return { team: nameMatch[1].trim(), source: 'KenPom' };
      }
      return null;
    }).filter(Boolean) as TeamRating[];
    
    console.log(`✓ Found ${teams.length} teams from KenPom`);
    return teams;
  } catch (error) {
    console.log('✗ KenPom fetch failed:', (error as Error).message);
    return [];
  }
}

// Fetch from NCAA official rankings (if available)
async function fetchNCAATeams(): Promise<TeamRating[]> {
  console.log('🔄 Fetching NCAA official team list...');
  try {
    // Try NCAA official site
    const response = await fetch('https://www.ncaa.org/sports/basketball-men/d1', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await response.text();
    
    // Extract team names from NCAA directory
    const teams: TeamRating[] = [];
    console.log(`✓ NCAA fetch completed (${html.length} bytes)`);
    return teams;
  } catch (error) {
    console.log('✗ NCAA fetch failed:', (error as Error).message);
    return [];
  }
}

// Fetch from Sports-Reference/College Basketball Reference
async function fetchSportsRefTeams(): Promise<TeamRating[]> {
  console.log('🔄 Fetching Sports-Reference schools...');
  try {
    const response = await fetch('https://www.sports-reference.com/cbb/schools/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await response.text();
    
    // Parse school links from SportsRef
    const schoolMatches = html.match(/<a href="\/cbb\/schools\/[^"]+">([^<]+)<\/a>/g) || [];
    const teams = schoolMatches.map(match => {
      const nameMatch = match.match(/>([^<]+)<\/a>/);
      if (nameMatch) {
        return { team: nameMatch[1].trim(), source: 'Sports-Reference' };
      }
      return null;
    }).filter(Boolean) as TeamRating[];
    
    console.log(`✓ Found ${teams.length} teams from Sports-Reference`);
    return teams;
  } catch (error) {
    console.log('✗ Sports-Reference fetch failed:', (error as Error).message);
    return [];
  }
}

// Fetch from ESPN's team directory
async function fetchESPNTeams(): Promise<TeamRating[]> {
  console.log('🔄 Fetching ESPN team directory...');
  try {
    const response = await fetch('https://www.espn.com/mens-college-basketball/teams', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await response.text();
    
    // Extract team names from ESPN
    const teamMatches = html.match(/"schoolName":"([^"]+)"/g) || [];
    const teams = new Set(
      teamMatches.map(match => {
        const m = match.match(/"schoolName":"([^"]+)"/);
        return m ? m[1] : null;
      }).filter(Boolean)
    );
    
    console.log(`✓ Found ${teams.size} teams from ESPN`);
    return Array.from(teams).map(team => ({ team: team as string, source: 'ESPN' }));
  } catch (error) {
    console.log('✗ ESPN fetch failed:', (error as Error).message);
    return [];
  }
}

// Get NCAA official directory (hardcoded fallback with recent data)
function getNCAAHardcodedTeams(): TeamRating[] {
  console.log('📋 Using hardcoded NCAA D1 team list...');
  const teams = [
    // ACC
    'Boston College', 'Clemson', 'Duke', 'Florida State', 'Georgia Tech', 'Louisville',
    'Miami (FL)', 'North Carolina', 'NC State', 'Notre Dame', 'Pittsburgh', 'SMU',
    'Stanford', 'Syracuse', 'Virginia', 'Virginia Tech', 'Wake Forest',
    
    // Big 10
    'Illinois', 'Indiana', 'Iowa', 'Maryland', 'Michigan', 'Michigan State',
    'Minnesota', 'Nebraska', 'Northwestern', 'Ohio State', 'Penn State', 'Purdue',
    'Rutgers', 'USC', 'UCLA', 'Wisconsin',
    
    // Big 12
    'Baylor', 'BYU', 'Cincinnati', 'Colorado', 'Houston', 'Iowa State', 'Kansas',
    'Kansas State', 'Oklahoma State', 'TCU', 'Texas', 'Texas Tech', 'West Virginia',
    
    // SEC
    'Alabama', 'Arkansas', 'Auburn', 'Florida', 'Georgia', 'Kentucky', 'LSU',
    'Mississippi', 'Mississippi State', 'Missouri', 'South Carolina', 'Tennessee',
    'Texas A&M', 'Vanderbilt',
    
    // Pac-12 (legacy)
    'Arizona', 'Arizona State', 'Colorado', 'Oregon', 'Oregon State', 'Utah',
    'Washington', 'Washington State',
    
    // Mid-American Conference
    'Akron', 'Bowling Green', 'Buffalo', 'Central Michigan', 'Eastern Michigan',
    'Kent State', 'Miami (OH)', 'Northern Illinois', 'Ohio University', 'Toledo',
    'Western Michigan',
    
    // Mountain West
    'Air Force', 'Boise State', 'Colorado State', 'Fresno State', 'New Mexico',
    'Nevada', 'San Diego State', 'San Jose State', 'UNLV', 'Wyoming',
    
    // American Athletic
    'East Carolina', 'Memphis', 'Navy', 'SMU', 'South Florida', 'Temple', 'Tulane',
    'Tulsa', 'UTEP', 'UAB',
    
    // Conference USA
    'Florida Atlantic', 'Florida International', 'Marshall', 'Middle Tennessee',
    'North Texas', 'Old Dominion', 'Rice', 'Southern Miss', 'Texas-San Antonio',
    'UTEP', 'Western Kentucky',
    
    // Sun Belt
    'Appalachian State', 'Arkansas State', 'Coastal Carolina', 'Georgia Southern',
    'Georgia State', 'Marshall', 'New Mexico State', 'South Alabama', 'Texas State',
    'Troy', 'ULM', 'UTA',
    
    // Ivy League
    'Brown', 'Columbia', 'Cornell', 'Dartmouth', 'Harvard', 'Pennsylvania',
    'Princeton', 'Yale',
    
    // Patriot League
    'Army', 'Boston University', 'Bucknell', 'Colgate', 'Holy Cross', 'Lafayette',
    'Lehigh', 'Navy', 'Northeastern', 'American University',
    
    // Ohio Valley Conference
    'Austin Peay', 'Eastern Illinois', 'Eastern Kentucky', 'Jacksonville State',
    'Morehead State', 'Murray State', 'SIU Edwardsville', 'Southeast Missouri',
    'Tennessee-Martin', 'UT Martin',
    
    // Southland Conference
    'Incarnate Word', 'Lamar', 'McNeese State', 'Nicholls State', 'Northwestern State',
    'Sam Houston State', 'Stephen F. Austin', 'Texas Southern', 'Abilene Christian',
    'Houston Baptist', 'UTRGV',
    
    // MVFC/Horizon
    'Cleveland State', 'Detroit Mercy', 'Green Bay', 'Illinois-Chicago', 'Purdue Fort Wayne',
    'Troy', 'UMBC', 'Wright State', 'Youngstown State',
    
    // Big South/Pioneer
    'Gardner-Webb', 'High Point', 'North Carolina A&T', 'Winthrop',
    
    // MEAC
    'Coppin State', 'Delaware State', 'Florida A&M', 'Howard', 'Morgan State',
    'North Carolina A&T', 'North Carolina Central', 'Prairie View A&M', 'South Carolina State',
    'Southern University', 'Texas Southern',
    
    // More D1 schools
    'Abilene Christian', 'Air Force Academy', 'Alabama State', 'Alcorn State',
    'American University', 'Appalachian State', 'Arizona', 'Arizona State',
    'Arkansas', 'Arkansas-Little Rock', 'Arkansas State', 'Army',
    'Auburn', 'Austin Peay', 'Ball State', 'Baylor', 'Belmont',
    'Bethune-Cookman', 'Binghamton', 'Boise State', 'Boston College',
    'Boston University', 'Bowling Green', 'Bradley', 'Brigham Young',
    'Brown', 'Bucknell', 'Buffalo', 'Butler', 'BYU',
    'California', 'Campbell', 'Canisius', 'Central Connecticut',
    'Central Michigan', 'Charleston', 'Chatham', 'Cheyney',
    'Citadel', 'Clemson', 'Coastal Carolina', 'Colgate',
    'College of Charleston', 'Colorado', 'Colorado State', 'Columbia',
    'Connecticut', 'Coppin State', 'Cornell', 'Creighton',
    'Delaware', 'Delaware State', 'Denver', 'DePaul',
    'Detroit Mercy', 'Drake', 'Drexel', 'Duke',
    'Duquesne', 'East Carolina', 'East Tennessee State', 'Eastern Illinois',
    'Eastern Kentucky', 'Eastern Michigan', 'Eastern Washington', 'Evansville',
    'ETSU', 'Fairfield', 'Fairleigh Dickinson', 'Florida',
    'Florida A&M', 'Florida Atlantic', 'Florida Gulf Coast', 'Florida International',
    'Florida State', 'Fordham', 'Fresno State', 'Furman',
    'Gardner-Webb', 'George Mason', 'George Washington', 'Georgetown',
    'Georgia', 'Georgia Southern', 'Georgia State', 'Georgia Tech',
    'Gonzaga', 'Grambling State', 'Grand Canyon', 'Green Bay',
    'Hampton', 'Hartford', 'Harvard', 'Hawaii',
    'High Point', 'Hofstra', 'Holy Cross', 'Houston',
    'Howard', 'Idaho', 'Idaho State', 'Illinois',
    'Illinois-Chicago', 'Illinois State', 'Incarnate Word', 'Indiana',
    'Indianapolis', 'Iona', 'Iowa', 'Iowa State',
    'Jackson State', 'Jacksonville', 'Jacksonville State', 'James Madison',
    'Kansas', 'Kansas State', 'Kennesaw State', 'Kent State',
    'Kentucky', 'Kenyon', 'Lafayette', 'Lamar',
    'La Salle', 'Lehigh', 'LIU Brooklyn', 'Lipscomb',
    'Long Beach State', 'Longwood', 'Louisiana', 'Louisiana Tech',
    'Louisville', 'Loyola Marymount', 'Loyola Chicago', 'LSU',
    'Manhattan', 'Marquette', 'Marshall', 'Maryland',
    'Maryland-Baltimore', 'Massachusetts', 'McNeese State', 'Memphis',
    'Merrimack', 'Miami (FL)', 'Miami (OH)', 'Michigan',
    'Michigan State', 'Middle Tennessee State', 'Minnesota', 'Mississippi',
    'Mississippi State', 'Missouri', 'Missouri State', 'Missouri-Kansas City',
    'Monmouth', 'Montana', 'Montana State', 'Morehead State',
    'Morgan State', 'Mount St. Mary\'s', 'Murray State', 'Navy',
    'Nebraska', 'Nevada', 'New Hampshire', 'New Mexico',
    'New Mexico State', 'New Orleans', 'Niagara', 'Nicholls State',
    'Norfolk State', 'North Carolina', 'North Carolina A&T', 'North Carolina Central',
    'North Carolina State', 'North Dakota', 'North Dakota State', 'Northern Arizona',
    'Northern Colorado', 'Northern Illinois', 'Northern Kentucky', 'Northern State',
    'Northwestern', 'Northwestern State', 'Notre Dame', 'Oakland',
    'Ohio', 'Ohio State', 'Oklahoma', 'Oklahoma State',
    'Old Dominion', 'Oral Roberts', 'Oregon', 'Oregon State',
    'Pacific', 'Penn State', 'Pennsylvania', 'Pepperdine',
    'Pittsburgh', 'Prairie View A&M', 'Princeton', 'Providence',
    'Purdue', 'Purdue Fort Wayne', 'Queens', 'Quinnipiac',
    'Radford', 'Rhode Island', 'Rice', 'Richmond',
    'Rider', 'Robert Morris', 'Rutgers', 'Sacramento State',
    'Sacred Heart', 'Saint Francis', 'Saint Joseph\'s', 'Saint Louis',
    'Saint Mary\'s', 'Sam Houston State', 'Samford', 'San Diego',
    'San Diego State', 'San Jose State', 'Santa Clara', 'Savannah State',
    'Seattle University', 'Seton Hall', 'Shiloh', 'Siena',
    'SIU Edwardsville', 'South Alabama', 'South Carolina', 'South Dakota',
    'South Dakota State', 'Southeast Missouri State', 'Southeastern Louisiana',
    'Southern Illinois', 'Southern Methodist University', 'Southern Mississippi',
    'Southern University', 'Southwestern Louisiana', 'Stanford', 'Stephen F. Austin',
    'Stetson', 'St. Bonaventure', 'St. John\'s', 'St. Joseph\'s',
    'Stony Brook', 'Syracuse', 'Tampa', 'Temple',
    'Tennessee', 'Tennessee-Martin', 'Tennessee State', 'Tennessee Tech',
    'Texas', 'Texas A&M', 'Texas A&M-Corpus Christi', 'Texas-Arlington',
    'Texas Christian', 'Texas-San Antonio', 'Texas Southern', 'Texas State',
    'Texas Tech', 'The Citadel', 'The Citadel Military College', 'Toledo',
    'Towson', 'Troy', 'Tulane', 'Tulsa',
    'UAB', 'UAlbany', 'UConn', 'UMBC',
    'UNC-Asheville', 'UNC-Wilmington', 'UNCG', 'UNLV',
    'UNI', 'Utah', 'Utah State', 'UTEP',
    'UTRGV', 'Ute', 'Vanderbilt', 'VCU',
    'Vermont', 'Villanova', 'Virginia', 'Virginia Commonwealth',
    'Virginia Military Institute', 'Virginia Tech', 'Wake Forest', 'Washington',
    'Washington State', 'Weber State', 'West Carolina', 'West Virginia',
    'Western Carolina', 'Western Illinois', 'Western Kentucky', 'Western Michigan',
    'Wichita State', 'William & Mary', 'Winthrop', 'Wisconsin',
    'Wisconsin-Green Bay', 'Wisconsin-Milwaukee', 'Wofford', 'Wright State',
    'Wyoming', 'Xavier', 'Yale', 'Youngstown State'
  ];

  const uniqueTeams = Array.from(new Set(teams));
  console.log(`✓ Using ${uniqueTeams.length} hardcoded NCAA D1 teams`);
  return uniqueTeams.map(team => ({ team, source: 'NCAA Hardcoded' }));
}

async function main() {
  console.log('\n🏀 COMPREHENSIVE D1 TEAM DATA FETCHER\n');

  const allTeams: Map<string, TeamRating> = new Map();

  // Try each source
  const sources = [
    fetchKenPomTeams(),
    fetchSportsRefTeams(),
    fetchESPNTeams()
  ];

  const results = await Promise.allSettled(sources);
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const team of result.value) {
        if (team && team.team) {
          const key = team.team.toLowerCase().trim();
          if (!allTeams.has(key)) {
            allTeams.set(key, team);
          }
        }
      }
    }
  }

  // Use hardcoded as main source to ensure complete list
  const hardcodedTeams = getNCAAHardcodedTeams();
  for (const team of hardcodedTeams) {
    const key = team.team.toLowerCase().trim();
    if (!allTeams.has(key)) {
      allTeams.set(key, team);
    }
  }

  const uniqueTeams = Array.from(allTeams.values());
  
  console.log('\n✅ RESULTS:');
  console.log(`Total unique teams found: ${uniqueTeams.length}`);
  
  // Display sources breakdown
  const bySource: Record<string, number> = {};
  for (const team of uniqueTeams) {
    bySource[team.source] = (bySource[team.source] || 0) + 1;
  }
  
  console.log('\nBy source:');
  for (const [source, count] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source}: ${count}`);
  }

  // Save to file
  const csv = 'Team,OffRating,DefRating,Source\n' +
    uniqueTeams
      .sort((a, b) => a.team.localeCompare(b.team))
      .map(t => `${t.team},100,100,${t.source}`)
      .join('\n');

  const outputPath = path.join(DATA_DIR, 'comprehensive_d1_teams.csv');
  fs.writeFileSync(outputPath, csv);
  
  console.log(`\n✓ Saved to ${outputPath}`);
  console.log(`\nTeam sample:`);
  uniqueTeams.slice(0, 10).forEach(t => console.log(`  - ${t.team} (${t.source})`));
}

main().catch(console.error);
