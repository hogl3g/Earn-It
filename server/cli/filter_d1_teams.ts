import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'raw');

// Current D1 teams that we know are valid
const D1_TEAMS = [
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
  
  // Pac-12
  'Arizona', 'Arizona State', 'Colorado', 'Oregon', 'Oregon State', 'Utah',
  'Washington', 'Washington State',
  
  // MAC
  'Akron', 'Bowling Green', 'Buffalo', 'Central Michigan', 'Eastern Michigan',
  'Kent State', 'Miami (OH)', 'Northern Illinois', 'Ohio University', 'Toledo',
  'Western Michigan',
  
  // Mountain West
  'Air Force', 'Boise State', 'Colorado State', 'Fresno State', 'New Mexico',
  'Nevada', 'San Diego State', 'San Jose State', 'UNLV', 'Wyoming',
  
  // American
  'East Carolina', 'Memphis', 'Navy', 'South Florida', 'Temple', 'Tulane',
  'Tulsa', 'UTEP', 'UAB',
  
  // Conference USA
  'Florida Atlantic', 'Florida International', 'Marshall', 'Middle Tennessee',
  'North Texas', 'Old Dominion', 'Rice', 'Southern Miss', 'Texas-San Antonio',
  'Western Kentucky',
  
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
  
  // OVC
  'Austin Peay', 'Eastern Illinois', 'Eastern Kentucky', 'Jacksonville State',
  'Morehead State', 'Murray State', 'SIU Edwardsville', 'Southeast Missouri',
  'Tennessee-Martin', 'UT Martin',
  
  // Southland
  'Incarnate Word', 'Lamar', 'McNeese State', 'Nicholls State', 'Northwestern State',
  'Sam Houston State', 'Stephen F. Austin', 'Texas Southern', 'Abilene Christian',
  'Houston Baptist', 'UTRGV', 'Prairie View A&M',
  
  // Horizon
  'Cleveland State', 'Detroit Mercy', 'Green Bay', 'Illinois-Chicago', 'Purdue Fort Wayne',
  'UMBC', 'Wright State', 'Youngstown State',
  
  // MEAC
  'Coppin State', 'Delaware State', 'Florida A&M', 'Howard', 'Morgan State',
  'North Carolina A&T', 'North Carolina Central', 'Savannah State',
  'Southern University', 'Texas Southern',
  
  // More D1
  'Belmont', 'Bradley', 'Brooke', 'Butler', 'Campbell', 'Canisius',
  'Central Connecticut', 'Charleston', 'Chattanooga', 'Cheyney',
  'Citadel', 'Colgate', 'College of Charleston', 'Connecticut', 'Creighton',
  'Davidson', 'Delaware', 'Denver', 'DePaul', 'Drexel',
  'Duquesne', 'Evansville', 'ETSU', 'Fairfield', 'Fairleigh Dickinson',
  'Fordham', 'Furman', 'George Mason', 'George Washington', 'Georgetown',
  'Gonzaga', 'Grambling State', 'Grand Canyon', 'Hampton', 'Hartford',
  'Hofstra', 'Holy Cross', 'Houston', 'Idaho', 'Idaho State',
  'Illinois State', 'Indiana State', 'Iona', 'Jackson State', 'Jacksonville',
  'Jacksonville State', 'James Madison', 'Kennesaw State', 'La Salle',
  'Lehigh', 'Lipscomb', 'Long Beach State', 'Longwood', 'Louisiana',
  'Louisiana Tech', 'Loyola Chicago', 'Loyola Marymount', 'Manhattan',
  'Marquette', 'Massachusetts', 'McNeese', 'Merrimack', 'Michigan Tech',
  'Middle Tennessee State', 'Milwaukee', 'Monmouth', 'Montana', 'Montana State',
  'Morehead State', 'Mount St. Mary\'s', 'Murray', 'New Hampshire', 'Niagara',
  'Nicholls State', 'Norfolk State', 'North Carolina A&T', 'North Carolina Central',
  'North Dakota', 'North Dakota State', 'Northern Arizona', 'Northern Colorado',
  'Northern Illinois', 'Northern Kentucky', 'Northwestern State', 'Oakland',
  'Oklahoma', 'Oklahoma State', 'Oral Roberts', 'Pacific', 'Prairie View',
  'Providence', 'Quinnipiac', 'Radford', 'Rhode Island', 'Richmond',
  'Rider', 'Robert Morris', 'Sacramento State', 'Sacred Heart', 'Saint Francis',
  'Saint Joseph\'s', 'Saint Louis', 'Saint Mary\'s', 'Samford', 'San Diego',
  'Santa Clara', 'Seton Hall', 'Siena', 'SIU Edwardsville', 'South Carolina',
  'South Dakota', 'South Dakota State', 'Southeastern Louisiana', 'Southern Illinois',
  'Southern Methodist', 'Southern Mississippi', 'Southwestern Louisiana', 'Stony Brook',
  'St. Bonaventure', 'St. John\'s', 'St. Peter\'s', 'Stetson', 'Stephen F. Austin',
  'Temple', 'Tennessee', 'Tennessee-Martin', 'Tennessee State', 'Tennessee Tech',
  'Texas', 'Texas A&M', 'Texas A&M-Corpus Christi', 'Texas-Arlington', 'Texas Christian',
  'Texas-San Antonio', 'Texas Southern', 'Texas State', 'Texas Tech',
  'The Citadel', 'Toledo', 'Towson', 'Troy', 'Tulane', 'Tulsa',
  'UAB', 'UAlbany', 'UConn', 'UMBC', 'UNC-Asheville', 'UNC-Wilmington',
  'UNCG', 'UNLV', 'UNI', 'Utah State', 'UTEP', 'UTRGV',
  'Vanderbilt', 'VCU', 'Vermont', 'Villanova', 'VMI',
  'Wake Forest', 'Washington State', 'Weber State', 'West Carolina', 'Western Carolina',
  'Western Illinois', 'Western Kentucky', 'Western Michigan', 'Wichita State',
  'William & Mary', 'Winthrop', 'Wisconsin', 'Wisconsin-Green Bay', 'Wisconsin-Milwaukee',
  'Wofford', 'Xavier', 'Yale', 'Youngstown State'
];

function main() {
  console.log('\n📊 FILTERING TO D1 TEAMS ONLY\n');

  // Read the comprehensive list
  const csvPath = path.join(DATA_DIR, 'comprehensive_d1_teams.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  
  // Build normalized D1 set
  const d1Set = new Set(
    D1_TEAMS.map(t => t.toLowerCase().replace(/[^\w\s]/g, '').trim())
  );
  
  console.log(`D1 reference teams: ${D1_TEAMS.length}`);
  
  // Filter and add with conference
  const filtered = [];
  let matched = 0;
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const [team] = lines[i].split(',');
    const normalized = team.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    if (d1Set.has(normalized)) {
      filtered.push(lines[i]);
      matched++;
    }
  }
  
  console.log(`Matched to D1: ${matched}`);
  
  // Add any D1 teams not in the scraped list
  const scrapedSet = new Set(
    filtered.map(line => line.split(',')[0].toLowerCase().replace(/[^\w\s]/g, '').trim())
  );
  
  const missing = D1_TEAMS.filter(
    t => !scrapedSet.has(t.toLowerCase().replace(/[^\w\s]/g, '').trim())
  );
  
  console.log(`Missing from scraped data: ${missing.length}`);
  if (missing.length > 0) {
    console.log('  Adding:', missing.slice(0, 5).join(', ') + (missing.length > 5 ? '...' : ''));
    for (const team of missing) {
      filtered.push(`${team},100,100,Manual D1 List`);
    }
  }
  
  // Save final D1 list
  const d1CsvPath = path.join(DATA_DIR, 'd1_teams_complete.csv');
  const header = 'Team,OffRating,DefRating,Source\n';
  const d1Content = header + filtered.join('\n');
  
  fs.writeFileSync(d1CsvPath, d1Content);
  
  console.log(`\n✅ RESULTS:`);
  console.log(`Total D1 teams: ${filtered.length}`);
  console.log(`Saved to: ${d1CsvPath}\n`);
  
  // Show sample
  console.log('Sample D1 teams:');
  filtered.slice(0, 15).forEach(line => {
    const [team] = line.split(',');
    console.log(`  - ${team}`);
  });
}

main();
