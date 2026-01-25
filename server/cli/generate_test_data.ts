/**
 * Generate test data for full orchestrator cycle testing
 * Creates mock ESPN/KenPom data so the system can run end-to-end
 * 
 * Usage: npx tsx server/cli/generate_test_data.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

async function generateTestData() {
  console.log('🧪 Generating test data for orchestrator...\n');

  // Create ESPN team stats
  const espnData = [
    {
      team_name: 'Arizona',
      conference: 'Pac-12',
      wins: 15,
      losses: 1,
      pts_for: 88.5,
      pts_against: 62.2,
      fg_pct: 0.520,
      reb: 44.1,
      ast: 18.2,
      turnover_margin: 3.4,
    },
    {
      team_name: 'Kansas',
      conference: 'Big 12',
      wins: 14,
      losses: 2,
      pts_for: 85.3,
      pts_against: 68.1,
      fg_pct: 0.495,
      reb: 41.2,
      ast: 17.5,
      turnover_margin: 2.8,
    },
    {
      team_name: 'Duke',
      conference: 'ACC',
      wins: 5,
      losses: 9,
      pts_for: 72.5,
      pts_against: 78.3,
      fg_pct: 0.415,
      reb: 36.5,
      ast: 13.7,
      turnover_margin: -1.2,
    },
    {
      team_name: 'Houston',
      conference: 'American',
      wins: 7,
      losses: 6,
      pts_for: 76.8,
      pts_against: 72.4,
      fg_pct: 0.438,
      reb: 37.7,
      ast: 14.1,
      turnover_margin: 0.1,
    },
    {
      team_name: 'Gonzaga',
      conference: 'WCC',
      wins: 12,
      losses: 2,
      pts_for: 84.2,
      pts_against: 68.5,
      fg_pct: 0.485,
      reb: 42.3,
      ast: 17.8,
      turnover_margin: 2.9,
    },
  ];

  // Create KenPom metrics
  const kenpomData = [
    { team_name: 'Arizona', ranking: 1, adjusted_efficiency: 1.185 },
    { team_name: 'Kansas', ranking: 3, adjusted_efficiency: 1.155 },
    { team_name: 'Duke', ranking: 95, adjusted_efficiency: 0.952 },
    { team_name: 'Houston', ranking: 18, adjusted_efficiency: 1.065 },
    { team_name: 'Gonzaga', ranking: 7, adjusted_efficiency: 1.125 },
  ];

  // Create today's schedule with lines
  const today = new Date().toISOString().split('T')[0];
  const scheduleData = `date,team_a,team_b,spread,moneyline_a,moneyline_b
${today},Arizona,Duke,-14.5,-500,+380
${today},Kansas,Houston,-3.5,-145,+115
${today},Gonzaga,Houston,-7.0,-280,+220`;

  // Create yesterday's results for grading
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const yesterdayYYYYMMDD = yesterday.replace(/-/g, '');
  
  const gradesData = {
    summary: {
      date: yesterday,
      wins: 2,
      losses: 0,
      total_picks: 2,
      hit_rate: '100%',
    },
    rows: [
      {
        date: yesterday,
        team_a: 'Arizona',
        team_b: 'Stanford',
        picked_team: 'Arizona',
        a_score: 89,
        b_score: 65,
        margin: 24,
        won: true,
      },
      {
        date: yesterday,
        team_a: 'Kansas',
        team_b: 'Baylor',
        picked_team: 'Kansas',
        a_score: 78,
        b_score: 71,
        margin: 7,
        won: true,
      },
    ],
  };

  // Create yesterday's picks CSV
  const picksCSVYesterday = `date,team_a,team_b,picked_team,confidence,tier,spread,moneyline,alignment
${yesterday},Arizona,Stanford,Arizona,0.8934,RELAXED,-17.15,-500,✓ ALIGNED
${yesterday},Kansas,Baylor,Kansas,0.8231,RELAXED,-3.5,-145,✓ ALIGNED`;

  // Save files
  const processedDir = path.join(root, 'data', 'processed');
  const resultsDir = path.join(root, 'data', 'results');
  const rawDir = path.join(root, 'data', 'raw');

  await fs.mkdir(processedDir, { recursive: true });
  await fs.mkdir(resultsDir, { recursive: true });
  await fs.mkdir(rawDir, { recursive: true });

  // Save ESPN data
  await fs.writeFile(
    path.join(processedDir, 'espn_team_stats.json'),
    JSON.stringify(espnData, null, 2),
    'utf-8'
  );
  console.log('✅ ESPN team stats created');

  // Save KenPom data
  await fs.writeFile(
    path.join(processedDir, 'kenpom_metrics.json'),
    JSON.stringify(kenpomData, null, 2),
    'utf-8'
  );
  console.log('✅ KenPom metrics created');

  // Save schedule
  await fs.writeFile(
    path.join(rawDir, 'schedule_today.csv'),
    scheduleData,
    'utf-8'
  );
  console.log('✅ Today\'s schedule created');

  // Save yesterday's grades (for grading test)
  await fs.writeFile(
    path.join(resultsDir, `grades_${yesterdayYYYYMMDD}.json`),
    JSON.stringify(gradesData, null, 2),
    'utf-8'
  );
  console.log('✅ Yesterday\'s grades created');

  // Save yesterday's picks CSV
  await fs.writeFile(
    path.join(resultsDir, 'ts_projector_picks_yesterday.csv'),
    picksCSVYesterday,
    'utf-8'
  );
  console.log('✅ Yesterday\'s picks created');

  console.log('\n✅ Test data ready! Run: npx tsx server/cli/orchestrator.ts\n');
}

generateTestData().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
