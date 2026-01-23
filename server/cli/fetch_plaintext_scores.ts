interface PlainTextGame {
  date: string;
  away_team: string;
  away_score: number;
  home_team: string;
  home_score: number;
  status: 'completed' | 'scheduled';
}

async function fetchPlainTextScores(date?: string): Promise<PlainTextGame[]> {
  const url = 'https://plaintextsports.com/ncaa-mb/';
  
  console.log(`Fetching: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const text = await response.text();
    console.log(`Response length: ${text.length} bytes`);
    
    const games: PlainTextGame[] = [];
    
    // Plain text format is typically:
    // Team A @ Team B - Score A-Score B
    // or Team A vs Team B (scheduled)
    // Look for common patterns
    
    const lines = text.split('\n');
    let currentDate = date || new Date().toISOString().split('T')[0];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for date headers (e.g., "January 17, 2026" or "2026-01-17")
      const dateMatch = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        currentDate = dateMatch[0];
        continue;
      }
      
      // Pattern 1: Team @ Team Score-Score
      const completedMatch = trimmed.match(/^(.+?)\s+@\s+(.+?)\s+[-–]\s*(\d+)\s*[-–]\s*(\d+)/);
      if (completedMatch) {
        const [, awayTeam, homeTeam, awayScore, homeScore] = completedMatch;
        games.push({
          date: currentDate,
          away_team: awayTeam.trim(),
          away_score: parseInt(awayScore),
          home_team: homeTeam.trim(),
          home_score: parseInt(homeScore),
          status: 'completed'
        });
        continue;
      }
      
      // Pattern 2: Team vs Team Score-Score
      const completedVsMatch = trimmed.match(/^(.+?)\s+vs\.?\s+(.+?)\s+[-–]\s*(\d+)\s*[-–]\s*(\d+)/);
      if (completedVsMatch) {
        const [, team1, team2, score1, score2] = completedVsMatch;
        games.push({
          date: currentDate,
          away_team: team1.trim(),
          away_score: parseInt(score1),
          home_team: team2.trim(),
          home_score: parseInt(score2),
          status: 'completed'
        });
        continue;
      }
      
      // Pattern 3: Team @ Team (scheduled)
      const scheduledMatch = trimmed.match(/^(.+?)\s+@\s+(.+?)$/);
      if (scheduledMatch && !trimmed.includes('-')) {
        const [, awayTeam, homeTeam] = scheduledMatch;
        games.push({
          date: currentDate,
          away_team: awayTeam.trim(),
          away_score: 0,
          home_team: homeTeam.trim(),
          home_score: 0,
          status: 'scheduled'
        });
      }
    }
    
    // Filter by date if specified
    const filteredGames = date ? games.filter(g => g.date === date) : games;
    
    console.log(`Found ${filteredGames.length} games${date ? ` for ${date}` : ''}`);
    return filteredGames;
    
  } catch (error) {
    console.error('Fetch error:', error);
    return [];
  }
}

// CLI usage - simplified check
const isMain = process.argv[1]?.includes('fetch_plaintext_scores');
if (isMain) {
  const dateArg = process.argv[2];
  
  fetchPlainTextScores(dateArg).then(games => {
    if (games.length === 0) {
      console.log('No games found');
    } else {
      console.log('\nGames:');
      games.forEach(g => {
        const score = g.status === 'completed' ? `${g.away_score}-${g.home_score}` : 'scheduled';
        console.log(`  ${g.date}: ${g.away_team} @ ${g.home_team} - ${score}`);
      });
    }
  });
}

export { fetchPlainTextScores, PlainTextGame };
