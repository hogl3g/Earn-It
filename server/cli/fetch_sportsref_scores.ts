interface SportsRefGame {
  date: string;
  away_team: string;
  away_score: number;
  home_team: string;
  home_score: number;
  status: 'completed' | 'scheduled';
}

async function fetchSportsRefScores(date: string): Promise<SportsRefGame[]> {
  // date format: YYYY-MM-DD
  const [year, month, day] = date.split('-');
  const url = `https://www.sports-reference.com/cbb/boxscores/index.cgi?month=${month}&day=${day}&year=${year}`;
  
  console.log(`Fetching: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`Response length: ${html.length} bytes`);
    
    const games: SportsRefGame[] = [];
    
    // Sports Reference uses game_summary divs with winner/loser table rows
    // Each game has two rows: winner and loser (not necessarily in that order)
    const gameSummaryRegex = /<div class="game_summary[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="game_summary|<\/div>)/g;
    
    let match;
    while ((match = gameSummaryRegex.exec(html)) !== null) {
      const gameBlock = match[1];
      
      // Extract both teams and scores from the table rows
      const rows = Array.from(gameBlock.matchAll(/<tr class="(winner|loser)"[^>]*>([\s\S]*?)<\/tr>/g));
      
      if (rows.length === 2) {
        const teams: Array<{team: string, score: number, isHome: boolean}> = [];
        
        for (let i = 0; i < rows.length; i++) {
          const rowContent = rows[i][2];
          const teamMatch = rowContent.match(/<a[^>]*>([^<]+)<\/a>/);
          const scoreMatch = rowContent.match(/<td class="right">(\d+)<\/td>/);
          
          if (teamMatch && scoreMatch) {
            teams.push({
              team: teamMatch[1].trim(),
              score: parseInt(scoreMatch[1]),
              isHome: i === 1  // Second row is typically home team
            });
          }
        }
        
        if (teams.length === 2) {
          // Determine away and home (first team mentioned is away, second is home)
          const away = teams[0];
          const home = teams[1];
          
          games.push({
            date,
            away_team: away.team,
            away_score: away.score,
            home_team: home.team,
            home_score: home.score,
            status: 'completed'
          });
        }
      }
    }
    
    console.log(`Found ${games.length} games`);
    return games;
    
  } catch (error) {
    console.error('Fetch error:', error);
    return [];
  }
}

// CLI usage - simplified check
const isMain = process.argv[1]?.includes('fetch_sportsref_scores');
if (isMain) {
  const dateArg = process.argv[2];
  if (!dateArg) {
    console.error('Usage: npx tsx fetch_sportsref_scores.ts YYYY-MM-DD');
    process.exit(1);
  }
  
  fetchSportsRefScores(dateArg).then(games => {
    if (games.length === 0) {
      console.log('No games found');
    } else {
      console.log('\nGames:');
      games.forEach(g => {
        const score = g.status === 'completed' ? `${g.away_score}-${g.home_score}` : 'scheduled';
        console.log(`  ${g.away_team} @ ${g.home_team} - ${score}`);
      });
    }
  });
}

export { fetchSportsRefScores, SportsRefGame };
