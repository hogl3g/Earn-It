const url = 'https://www.sports-reference.com/cbb/boxscores/index.cgi?month=01&day=17&year=2026';

fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
})
  .then(r => r.text())
  .then(html => {
    console.log(`HTML length: ${html.length}`);
    
    // Find the game_summaries div
    const summariesMatch = html.match(/<div[^>]*class="[^"]*game_summaries[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
    if (summariesMatch) {
      console.log('\nFound game_summaries section');
      const section = summariesMatch[0].substring(0, 3000);
      console.log(section);
    } else {
      console.log('\nNo game_summaries found, looking for game_summary...');
      const gameSummary = html.match(/<div[^>]*class="[^"]*game_summary[^"]*"[^>]*>[\s\S]{0,1000}/);
      if (gameSummary) {
        console.log(gameSummary[0]);
      } else {
        console.log('Also no game_summary found');
        // Show first table structure
        const table = html.match(/<table[^>]*>[\s\S]{0,2000}/);
        if (table) {
          console.log('\nFirst table structure:');
          console.log(table[0]);
        }
      }
    }
  })
  .catch(e => console.error('Error:', e));
