/**
 * Fetch scores and schedules from USA Today Sports Data
 * More reliable date alignment than ESPN/Talisman
 */

import { normalizeTeamName } from '../../shared/team_names.js';

interface USATodayGame {
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  completed: boolean;
  scheduled: boolean;
  date: string;
}

export async function fetchUSATodayScores(date: string): Promise<USATodayGame[]> {
  // date format: YYYY-MM-DD
  const season = date.slice(0, 4); // Extract year
  const url = `https://sportsdata.usatoday.com/basketball/ncaab/scores?date=${date}&season=${parseInt(season) - 1}`;
  
  try {
    console.log(`  Fetching USA Today scores for ${date}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const resp = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    clearTimeout(timeoutId);
    
    if (!resp.ok) {
      console.warn(`  USA Today API returned ${resp.status}`);
      return [];
    }
    
    const html = await resp.text();
    const games: USATodayGame[] = [];
    
    // Parse the HTML for game data
    // USA Today embeds JSON in data attributes or script tags
    const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    if (!scriptMatches) return [];
    
    for (const scriptTag of scriptMatches) {
      // Look for JSON data containing game info
      const jsonMatch = scriptTag.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          // Extract games from the data structure
          if (data.games && Array.isArray(data.games)) {
            for (const game of data.games) {
              games.push({
                awayTeam: normalizeTeamName(game.away?.name || game.away?.team || ''),
                homeTeam: normalizeTeamName(game.home?.name || game.home?.team || ''),
                awayScore: parseInt(game.away?.score || '0'),
                homeScore: parseInt(game.home?.score || '0'),
                completed: game.status === 'final' || game.completed === true,
                scheduled: game.status === 'scheduled' || game.scheduled === true,
                date
              });
            }
          }
        } catch (err) {
          continue;
        }
      }
    }
    
    // Fallback: Parse HTML directly for game cards
    if (games.length === 0) {
      const gameCardPattern = /data-away-team="([^"]+)"[\s\S]*?data-home-team="([^"]+)"[\s\S]*?data-away-score="(\d+)"[\s\S]*?data-home-score="(\d+)"[\s\S]*?data-status="([^"]+)"/g;
      let match;
      
      while ((match = gameCardPattern.exec(html)) !== null) {
        const [, away, home, awayScore, homeScore, status] = match;
        games.push({
          awayTeam: normalizeTeamName(away),
          homeTeam: normalizeTeamName(home),
          awayScore: parseInt(awayScore),
          homeScore: parseInt(homeScore),
          completed: status.toLowerCase().includes('final'),
          scheduled: status.toLowerCase().includes('scheduled'),
          date
        });
      }
    }
    
    console.log(`  Found ${games.filter(g => g.completed).length} completed games, ${games.filter(g => g.scheduled).length} scheduled`);
    return games;
    
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('  USA Today API timeout (15 seconds)');
    } else {
      console.error('  Error fetching USA Today scores:', err.message);
    }
    return [];
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  (async () => {
    const date = process.argv[2] || new Date().toISOString().split('T')[0];
    const games = await fetchUSATodayScores(date);
    
    console.log(`\n=== Games for ${date} ===`);
    for (const game of games) {
      const status = game.completed ? 'FINAL' : game.scheduled ? 'SCHEDULED' : 'IN PROGRESS';
    console.log(`${game.awayTeam.padEnd(25)} @ ${game.homeTeam.padEnd(25)} ${game.awayScore}-${game.homeScore} [${status}]`);
    }
  })();
}
