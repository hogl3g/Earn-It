/**
 * Team Name Normalization Tool
 * 
 * Maintains a canonical mapping of team name variations to prevent
 * silent matching failures in grading and calibration
 */

const TEAM_NAME_MAP: Record<string, string> = {
  // Common abbreviations
  'St.': 'State',
  'St ': 'State ',
  'Saint ': 'St. ',
  
  // Specific team mappings (add as needed)
  'Ball St.': 'Ball State',
  'Ball State': 'Ball State',
  'San Diego St.': 'San Diego State',
  'Arizona St.': 'Arizona State',
  'Iowa St.': 'Iowa State',
  'Oklahoma St.': 'Oklahoma State',
  'Kansas St.': 'Kansas State',
  'Michigan St.': 'Michigan State',
  'Mississippi St.': 'Mississippi State',
  'Florida St.': 'Florida State',
  'Texas Tech': 'Texas Tech',
  'Boston College': 'Boston College',
  'Texas A&M': 'Texas A&M',
  'Texas A&m': 'Texas A&M',
  'Texas A & M': 'Texas A&M',
  'Texas A and M': 'Texas A&M',
  'TCU': 'Texas Christian',
  'Texas Christian': 'Texas Christian',
  'SMU': 'Southern Methodist',
  'Southern Methodist': 'Southern Methodist',
  'USC': 'Southern California',
  'Southern Cal': 'Southern California',
  'VCU': 'Virginia Commonwealth',
  'Virginia Commonwealth': 'Virginia Commonwealth',
  'UConn': 'Connecticut',
  'U Conn': 'Connecticut',
  'Connecticut': 'Connecticut',
  'UNC': 'North Carolina',
  'N.C.': 'North Carolina',
  'NC': 'North Carolina',
  'North Carolina': 'North Carolina',
  'UVA': 'Virginia',
  'U Va': 'Virginia',
  'Virginia': 'Virginia',
  'UNLV': 'Nevada Las Vegas',
  'Nevada (Las Vegas)': 'Nevada Las Vegas',
  'Nevada Las Vegas': 'Nevada Las Vegas',
  'UTEP': 'Texas El Paso',
  'Texas El Paso': 'Texas El Paso',
  'UCF': 'Central Florida',
  'Central Florida': 'Central Florida',
  'UAB': 'Alabama Birmingham',
  'Alabama Birmingham': 'Alabama Birmingham',
  'LSU': 'Louisiana State',
  'Louisiana State': 'Louisiana State',
  'Penn St.': 'Penn State',
  'Penn State': 'Penn State',
  'Miami (Fl.)': 'Miami Florida',
  'Miami Fl': 'Miami Florida',
  'Miami Fla': 'Miami Florida',
  'Miami Florida': 'Miami Florida',
  'Miami (OH)': 'Miami Ohio',
  'Miami Oh': 'Miami Ohio',
  'Miami Ohio': 'Miami Ohio',
  'Virginia Tech': 'Virginia Tech',
  'Wake Forest': 'Wake Forest',
  'San Jose St.': 'San Jose State',
  'San Jose State': 'San Jose State',
  'Fresno St.': 'Fresno State',
  'Fresno State': 'Fresno State',
  'Boise St.': 'Boise State',
  'Boise State': 'Boise State',
  'Colorado St.': 'Colorado State',
  'Colorado State': 'Colorado State',
  'Wyoming': 'Wyoming',
  'SDSU': 'San Diego State',
  'San Diego State': 'San Diego State',
  'New Mexico St.': 'New Mexico State',
  'New Mexico State': 'New Mexico State',
  'Utah St.': 'Utah State',
  'Utah State': 'Utah State',
  'Morgan St.': 'Morgan State',
  'Morgan State': 'Morgan State',
  'St. Peters': 'Saint Peters',
  'Saint Peters': 'Saint Peters',
  'Saint Peter\'s': 'Saint Peters',
  'St. Peter\'s': 'Saint Peters',
  'St. Mary\'s': 'Saint Marys',
  'Saint Mary\'s': 'Saint Marys',
  'Saint Marys': 'Saint Marys',
  'St. Francis': 'Saint Francis',
  'Saint Francis': 'Saint Francis',
  'St. John\'s': 'Saint Johns',
  'Saint John\'s': 'Saint Johns',
  'Saint Johns': 'Saint Johns',
  'St. Bonaventure': 'Saint Bonaventure',
  'Saint Bonaventure': 'Saint Bonaventure',
  'St. Louis': 'Saint Louis',
  'Saint Louis': 'Saint Louis',
  'St. Thomas': 'Saint Thomas',
  'Saint Thomas': 'Saint Thomas',
  'St. Anselm': 'Saint Anselm',
  'Saint Anselm': 'Saint Anselm',
  'NJIT': 'New Jersey Institute Technology',
  'New Jersey Institute Technology': 'New Jersey Institute Technology',
  'UMass': 'Massachusetts',
  'Massachusetts': 'Massachusetts',
  'UMass Lowell': 'Massachusetts Lowell',
  'Massachusetts Lowell': 'Massachusetts Lowell',
  'SIU': 'Southern Illinois',
  'Southern Illinois': 'Southern Illinois',
  'NIU': 'Northern Illinois',
  'Northern Illinois': 'Northern Illinois',
  'UIC': 'Illinois Chicago',
  'Illinois Chicago': 'Illinois Chicago',
  'Seton Hall': 'Seton Hall',
  'Rutgers': 'Rutgers',
  'High Point': 'High Point',
  'Middle Tennessee': 'Middle Tennessee',
  'MTSU': 'Middle Tennessee',
  'Chattanooga': 'Chattanooga',
  'The Citadel': 'Citadel',
  'Citadel': 'Citadel',
  'VMI': 'Virginia Military',
  'Virginia Military': 'Virginia Military',
  'Merrimack': 'Merrimack',
  'Quinnipiac': 'Quinnipiac',
  'Sacred Heart': 'Sacred Heart',
  'Rider': 'Rider',
  'Marist': 'Marist',
  'Ohio': 'Ohio University',
  'Creighton': 'Creighton',
  'Providence': 'Providence',
  'East Carolina': 'East Carolina',
  'ECU': 'East Carolina'
};

export function normalizeTeamName(name: string): string {
  if (!name) return '';
  
  // Trim whitespace
  let normalized = name.trim();
  
  // Check direct map first
  if (TEAM_NAME_MAP[normalized]) {
    return TEAM_NAME_MAP[normalized];
  }
  
  // Try case-insensitive match
  const lowerName = normalized.toLowerCase();
  for (const [key, value] of Object.entries(TEAM_NAME_MAP)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  
  // Remove extra whitespace and special characters for comparison
  const cleaned = normalized
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Do fuzzy matching for common patterns
  for (const [key, value] of Object.entries(TEAM_NAME_MAP)) {
    const keyClean = key
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (keyClean === cleaned) {
      return value;
    }
  }
  
  // Return original if no match found
  return normalized;
}

export function createTeamNameMatcher() {
  return (name: string) => normalizeTeamName(name);
}

// Test the mapping
if (import.meta.url === `file://${process.argv[1]}`) {
  const testNames = [
    'Ball St.',
    'Saint Francis',
    'St. Francis',
    'Miami (FL)',
    'Miami (OH)',
    'Texas A&M',
    'San Diego St.',
    'Quinnipiac'
  ];
  
  console.log('Team Name Normalization Test');
  console.log('============================\n');
  
  for (const name of testNames) {
    const normalized = normalizeTeamName(name);
    console.log(`${name.padEnd(25)} -> ${normalized}`);
  }
}
