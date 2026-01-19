import { fetchSportsRefScores } from './fetch_sportsref_scores.js';
import { normalizeTeamName } from '../../shared/team_names.js';
import fs from 'fs';
import path from 'path';

async function gradePicks(date: string) {
  console.log(`\nGrading picks for ${date} using Sports Reference...`);
  
  // Load existing grades file
  const gradesPath = path.join(process.cwd(), 'data', 'results', `grades_${date.replace(/-/g, '')}.json`);
  
  if (!fs.existsSync(gradesPath)) {
    console.error(`No grades file found at: ${gradesPath}`);
    return;
  }
  
  const grades = JSON.parse(fs.readFileSync(gradesPath, 'utf8'));
  console.log(`Loaded ${grades.rows.length} picks from grades file`);
  
  // Fetch Sports Reference scores
  const games = await fetchSportsRefScores(date);
  console.log(`Fetched ${games.length} completed games from Sports Reference\n`);
  
  if (games.length === 0) {
    console.error('No games found from Sports Reference');
    return;
  }
  
  // Grade each pick
  let graded = 0;
  let notFound = 0;
  
  for (const pick of grades.rows) {
    const normA = normalizeTeamName(pick.team_a);
    const normB = normalizeTeamName(pick.team_b);
    
    // Find matching game
    let found = false;
    for (const game of games) {
      const awayNorm = normalizeTeamName(game.away_team);
      const homeNorm = normalizeTeamName(game.home_team);
      
      // Check both orderings
      if ((normA === awayNorm && normB === homeNorm) || (normA === homeNorm && normB === awayNorm)) {
        // Determine which team is A and which is B
        let a_score, b_score;
        if (normA === awayNorm) {
          a_score = game.away_score;
          b_score = game.home_score;
        } else {
          a_score = game.home_score;
          b_score = game.away_score;
        }
        
        // Update pick with scores
        pick.a_score = a_score;
        pick.b_score = b_score;
        pick.margin = a_score - b_score;
        
        // Calculate if covered (team A vs spread)
        const adjustedMargin = pick.margin - pick.market_spread;
        pick.covered = adjustedMargin > 0;
        pick.won = pick.covered;
        
        // Calculate stake and profit (quarter Kelly)
        const coverProb = 0.7; // Default assumption
        const price = -110;
        const decimalOdds = Math.abs(price) / 100 + 1;
        const kelly = (coverProb * decimalOdds - 1) / (decimalOdds - 1);
        const fraction = Math.max(0, Math.min(0.25, kelly / 2));
        const bankroll = 1000;
        pick.stake = bankroll * fraction;
        pick.profit = pick.won ? (pick.stake * 100 / Math.abs(price)) : -pick.stake;
        
        delete pick.note;
        found = true;
        graded++;
        break;
      }
    }
    
    if (!found) {
      notFound++;
      // Keep as "score not found"
    }
  }
  
  console.log(`\nGrading Results:`);
  console.log(`  Successfully graded: ${graded}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Total picks: ${grades.rows.length}`);
  
  // Calculate summary stats
  const wins = grades.rows.filter(r => r.won && r.a_score > 0).length;
  const losses = grades.rows.filter(r => !r.won && r.a_score > 0).length;
  const totalProfit = grades.rows.reduce((sum, r) => sum + (r.profit || 0), 0);
  
  console.log(`\n  Wins: ${wins}`);
  console.log(`  Losses: ${losses}`);
  console.log(`  Win Rate: ${((wins / (wins + losses)) * 100).toFixed(1)}%`);
  console.log(`  Total Profit: $${totalProfit.toFixed(2)}`);
  
  // Save updated grades
  const outputPath = path.join(process.cwd(), 'data', 'results', `grades_${date.replace(/-/g, '')}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(grades, null, 2));
  console.log(`\nSaved updated grades to: ${outputPath}`);
}

// Run for Jan 17
const date = process.argv[2] || '2026-01-17';
gradePicks(date).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
