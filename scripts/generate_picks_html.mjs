import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const enhancedCsvPath = path.join(root, 'data', 'results', 'enhanced_projector_picks.csv');
const legacyCsvPath = path.join(root, 'data', 'results', 'ts_projector_picks.csv');
const publicDir = path.join(root, 'public');
const outPath = path.join(publicDir, 'index.html');

// Prefer enhanced projector output if present
const csvPath = fs.existsSync(enhancedCsvPath) ? enhancedCsvPath : legacyCsvPath;

if (!fs.existsSync(csvPath)) {
  console.error(`Missing CSV at ${csvPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(csvPath, 'utf-8').trim();
if (!raw) {
  console.error('CSV is empty');
  process.exit(1);
}

const [headerLine, ...rows] = raw.split(/\r?\n/);
const headers = headerLine.split(',');

fs.mkdirSync(publicDir, { recursive: true });

// Copy CSV for download (stable filename, enhanced content if available)
fs.writeFileSync(path.join(publicDir, 'ts_projector_picks.csv'), raw, 'utf-8');

const escaped = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Load KenPom rankings
let kenpomRankings = new Map(); // team_name -> ranking
try {
  const kenpomPath = path.join(root, 'data', 'processed', 'kenpom_metrics.json');
  if (fs.existsSync(kenpomPath)) {
    const kenpomData = JSON.parse(fs.readFileSync(kenpomPath, 'utf-8'));
    if (Array.isArray(kenpomData)) {
      kenpomData.forEach(team => {
        if (team.team_name && team.ranking) {
          kenpomRankings.set(team.team_name.toLowerCase(), team.ranking);
        }
      });
    }
  }
} catch (err) {
  console.warn('Could not load KenPom rankings');
}

// Try to locate graded results JSON for the date present in picks
let gradesSummary = null;
let gradesMap = null;
let pickedTeamMap = null; // Store which team was picked for each game
let extendedHeaders = ['date', 'team_a', 'team_b', 'line', 'moneyline'];

try {
  // Parse the date from the first row (ISO string in column 0)
  const firstCols = rows.length ? rows[0].split(',') : null;
  const iso = firstCols ? firstCols[0] : null;
  const d = iso ? new Date(iso) : null;
  const yyyy = d ? String(d.getUTCFullYear()) : null;
  const mm = d ? String(d.getUTCMonth() + 1).padStart(2, '0') : null;
  const dd = d ? String(d.getUTCDate()).padStart(2, '0') : null;
  const gradesJsonPath = (yyyy && mm && dd)
    ? path.join(root, 'data', 'results', `grades_${yyyy}${mm}${dd}.json`)
    : null;

  // Also load picked teams from CSV
  pickedTeamMap = new Map();
  rows.forEach(line => {
    const cols = line.split(',');
    if (cols.length >= 4) {
      const team_a = cols[1];
      const team_b = cols[2];
      const picked_team = cols[3];
      pickedTeamMap.set(`${team_a}|${team_b}`, picked_team);
    }
  });

  if (gradesJsonPath && fs.existsSync(gradesJsonPath)) {
    let gj = fs.readFileSync(gradesJsonPath, 'utf-8');
    // Replace NaN tokens with null to satisfy JSON.parse
    gj = gj.replace(/\bNaN\b/g, 'null');
    const parsed = JSON.parse(gj);
    gradesSummary = parsed.summary || null;
    const rowsJson = Array.isArray(parsed.rows) ? parsed.rows : [];
    gradesMap = new Map(rowsJson.map(r => [
      `${String(r.team_a)}|${String(r.team_b)}`, r
    ]));
    // Append graded columns to headers
    extendedHeaders = [...extendedHeaders, 'a_score', 'b_score', 'margin', 'result'];
  }
} catch (err) {
  console.warn('Could not parse graded results JSON:', err?.message || String(err));
}

const tableRows = rows.map((line) => {
  const cols = line.split(',');
  const dateCol = cols[0];
  const teamACol = cols[1];
  const teamBCol = cols[2];
  const pickedTeamCol = cols[3];
  const spreadCol = cols[6] || '';
  const moneylineCol = cols[7] || '';
  const alignmentCol = cols[8] || ''; // Not displayed but available
  
  const key = `${teamACol}|${teamBCol}`;
  const grade = gradesMap ? gradesMap.get(key) : null;
  
  // Get KenPom rankings
  const rankA = kenpomRankings.get(teamACol.toLowerCase()) || '—';
  const rankB = kenpomRankings.get(teamBCol.toLowerCase()) || '—';
  
  // Determine if row should be highlighted (picked team row)
  const isTeamAPicked = pickedTeamCol === teamACol;
  const isTeamBPicked = pickedTeamCol === teamBCol;
  const highlightClass = isTeamAPicked ? ' style="background-color: #90EE90; font-weight: bold;"' : 
                         isTeamBPicked ? ' style="background-color: #90EE90; font-weight: bold;"' : '';
  
  // Build display columns (matches SportsLine format)
  const displayCols = [
    dateCol,
    teamACol,           // Home team
    teamBCol,           // Away team
    spreadCol,          // Spread (Vegas line)
    moneylineCol,       // Moneyline (Vegas odds)
  ];
  
  // Add grade info if available
  if (grade) {
    displayCols.push(
      grade.a_score == null ? '' : String(grade.a_score),
      grade.b_score == null ? '' : String(grade.b_score),
      grade.margin == null ? '' : String(grade.margin),
      grade.won == null ? '' : (grade.won ? '✓' : '✗')
    );
  }

  return `<tr${highlightClass}>${displayCols.map((c) => {
    const val = escaped(c);
    return `<td>${val}</td>`;
  }).join('')}</tr>`;
}).join('\n');

// Build wins/losses summary box
let winsLossesHtml = '';
let gameScoresHtml = '';

// Aggregate all grades files for cumulative totals - use summary stats
let cumulativeWins = 0;
let cumulativeLosses = 0;
const allGameScores = [];
let mostRecentGameDate = '';

// Check if there's a reset marker (indicates starting fresh count)
const resultsDir = path.join(root, 'data', 'results');
const resetMarkerPath = path.join(resultsDir, '.html_count_reset');
let resetTimestamp = null;
if (fs.existsSync(resetMarkerPath)) {
  try {
    resetTimestamp = new Date(fs.readFileSync(resetMarkerPath, 'utf-8').trim());
  } catch (e) {
    // Ignore if we can't read the marker
  }
}

// Load all picks from CSV to validate graded games were projected
// CRITICAL RULE (NON-NEGOTIABLE):
// - Only count wins/losses for games the projector actually picked
// - Never count games that weren't in the original picks CSV
// - Never count games without final scores
// This ensures record only reflects performance on picked games
const pickedGames = new Set();
try {
  const raw = fs.readFileSync(csvPath, 'utf-8').trim();
  const [, ...pickRows] = raw.split(/\r?\n/);
  pickRows.forEach(line => {
    const cols = line.split(',');
    if (cols.length >= 3) {
      const team_a = cols[1];
      const team_b = cols[2];
      pickedGames.add(`${team_a}|${team_b}`);
    }
  });
} catch (err) {
  console.warn('Could not load picks CSV for validation:', err?.message);
}

try {
  // Find all grades_*.json files in data/results
  const gradesFiles = fs.readdirSync(resultsDir).filter(f => f.match(/^grades_\d{8}\.json$/)).sort().reverse();
  
  // Get the most recent grades file WITH completed games
  let mostRecentFile = null;
  let mostRecentCompletedFile = null;
  
  for (const file of gradesFiles) {
    if (!mostRecentFile) mostRecentFile = file;
    
    try {
      let gj = fs.readFileSync(path.join(resultsDir, file), 'utf-8');
      gj = gj.replace(/\bNaN\b/g, 'null');
      const parsed = JSON.parse(gj);
      const summary = parsed.summary || {};
      const rowsJson = Array.isArray(parsed.rows) ? parsed.rows : [];
      
      // Check if this file has any completed games (non-zero scores)
      const hasCompletedGames = rowsJson.some(row => 
        row.a_score != null && row.b_score != null && 
        (row.a_score > 0 || row.b_score > 0) &&
        !row.note
      );
      
      if (hasCompletedGames && !mostRecentCompletedFile) {
        mostRecentCompletedFile = file;
      }
    } catch (err) {
      continue;
    }
  }
  
  // Extract date from filename (grades_YYYYMMDD.json)
  if (mostRecentCompletedFile) {
    const dateMatch = mostRecentCompletedFile.match(/grades_(\d{4})(\d{2})(\d{2})\.json/);
    if (dateMatch) {
      const yyyy = dateMatch[1];
      const mm = dateMatch[2];
      const dd = dateMatch[3];
      mostRecentGameDate = `${yyyy}-${mm}-${dd}`;
    }
  }
  
  // Use summary stats from each grades file for accurate totals
  // If reset marker exists, only count files created AFTER the reset
  gradesFiles.forEach(file => {
    try {
      // Check file timestamp against reset marker
      if (resetTimestamp) {
        const fileStatPath = path.join(resultsDir, file);
        const fileStat = fs.statSync(fileStatPath);
        const fileModTime = new Date(fileStat.mtime);
        
        // Skip files modified BEFORE the reset timestamp
        if (fileModTime < resetTimestamp) {
          return; // Skip this file
        }
      }
      
      let gj = fs.readFileSync(path.join(resultsDir, file), 'utf-8');
      gj = gj.replace(/\bNaN\b/g, 'null');
      const parsed = JSON.parse(gj);
      const summary = parsed.summary || {};
      const rowsJson = Array.isArray(parsed.rows) ? parsed.rows : [];
      
      // Use summary wins/losses if available (more reliable than row-by-row counting)
      if (summary.wins !== undefined && summary.losses !== undefined) {
        cumulativeWins += (summary.wins || 0);
        cumulativeLosses += (summary.losses || 0);
      } else {
        // Fallback: count from rows
        // CRITICAL RULE: Only count if:
        // 1. Game was in projector's picks
        // 2. Both teams have actual scores (non-zero)
        // 3. Game is not marked as skipped
        rowsJson.forEach(row => {
          // Check if this game was in the original picks
          const gameKey = `${row.team_a}|${row.team_b}`;
          const wasProjected = pickedGames.has(gameKey);
          
          // CRITICAL: Only count PROJECTED games with ACTUAL SCORES
          if (
            wasProjected &&
            row.a_score != null && 
            row.b_score != null && 
            row.a_score > 0 && 
            row.b_score > 0 &&
            !row.note // Exclude skipped/incomplete games
          ) {
            const rowWon = row.won === true;
            const rowLost = row.won === false;
            
            if (rowWon) {
              cumulativeWins++;
            } else if (rowLost) {
              cumulativeLosses++;
            }
          }
        });
      }
      
      // Only collect game scores from the most recent COMPLETED file
      if (file === mostRecentCompletedFile) {
        rowsJson.forEach(row => {
          if (row.a_score != null && row.b_score != null && (row.a_score > 0 || row.b_score > 0) && !row.note) {
            allGameScores.push({
              team_a: row.team_a,
              team_b: row.team_b,
              a_score: row.a_score,
              b_score: row.b_score,
              margin: row.margin,
              covered: row.covered,
              won: row.won
            });
          }
        });
      }
    } catch (err) {
      console.warn(`Could not parse ${file}:`, err?.message || String(err));
    }
  });
} catch (err) {
  console.warn('Could not read grades files:', err?.message || String(err));
}

// Always show wins/losses box (even if 0-0 on fresh start)
winsLossesHtml = `
<div class="wins-losses-box">
  <h2>Record (Cumulative)</h2>
  <div class="record-display">
    <div class="record-item wins">
      <span class="record-label">Wins</span>
      <span class="record-value">${cumulativeWins}</span>
    </div>
    <div class="record-item losses">
      <span class="record-label">Losses</span>
      <span class="record-value">${cumulativeLosses}</span>
    </div>
  </div>
</div>
`;

// Removed Previous Day Game Scores section per user request

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Projector Picks</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    h1 { margin-bottom: 8px; }
    h2 { margin: 16px 0 12px 0; font-size: 18px; }
    .meta { margin-bottom: 16px; }
    .summary { margin: 12px 0; padding: 10px; background: #f7f9fb; border: 1px solid #e3e7ea; }
    .summary strong { margin-right: 6px; }
    
    .wins-losses-box {
      margin: 24px 0;
      padding: 20px;
      background: #f0f9ff;
      border: 2px solid #0284c7;
      border-radius: 8px;
    }
    
    .record-display {
      display: flex;
      gap: 20px;
      margin-top: 12px;
    }
    
    .record-item {
      padding: 12px 16px;
      border-radius: 6px;
      min-width: 120px;
    }
    
    .record-item.wins {
      background: #dcfce7;
      border: 1px solid #86efac;
    }
    
    .record-item.losses {
      background: #fee2e2;
      border: 1px solid #fca5a5;
    }
    
    .record-label {
      display: block;
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }
    
    .record-value {
      display: block;
      font-size: 28px;
      font-weight: bold;
      color: #222;
    }
    
    .game-scores-box {
      margin: 24px 0;
      padding: 20px;
      background: #fafaf9;
      border: 1px solid #e7e5e4;
      border-radius: 8px;
    }
    
    .scores-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 13px;
    }
    
    .scores-table th,
    .scores-table td {
      padding: 8px;
      border: 1px solid #e5e7eb;
      text-align: left;
    }
    
    .scores-table th {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }
    
    .scores-table tbody tr:nth-child(odd) {
      background: #ffffff;
    }
    
    .scores-table tbody tr:nth-child(even) {
      background: #f9fafb;
    }
    
    .result {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 12px;
    }
    
    .result.win {
      background: #dcfce7;
      color: #166534;
    }
    
    .result.loss {
      background: #fee2e2;
      color: #991b1b;
    }
    
    table { border-collapse: collapse; width: 100%; font-size: 14px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #f4f4f4; }
    tbody tr:nth-child(odd) { background: #fafafa; }
    .scroll { max-height: 70vh; overflow: auto; border: 1px solid #ddd; }
    a.download { display: inline-block; margin-bottom: 12px; }
  </style>
</head>
<body>
  <h1>Projector Picks</h1>
  <div class="meta">Updated: ${new Date().toISOString()}</div>
  <a class="download" href="./ts_projector_picks.csv?v=${Date.now()}" download>Download CSV</a>
  ${gradesSummary ? `
  <div class="summary">
    <div><strong>Date:</strong> ${escaped(gradesSummary.date)}</div>
    <div><strong>Picks:</strong> ${escaped(gradesSummary.total_picks)} | <strong>Wins:</strong> ${escaped(gradesSummary.wins)} | <strong>Covers:</strong> ${escaped(gradesSummary.covers)}</div>
    <div><strong>Total Stake:</strong> $${escaped(gradesSummary.total_stake)} | <strong>Profit:</strong> $${escaped(Math.round(gradesSummary.total_profit * 100) / 100)} | <strong>ROI:</strong> ${escaped(Math.round(gradesSummary.roi * 100) / 100)}%</div>
  </div>
  ` : ''}
  <div class="scroll">
    <table>
      <thead><tr>${extendedHeaders.map((h) => `<th>${escaped(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>
  
  ${winsLossesHtml}
  ${gameScoresHtml}
</body>
</html>`;

fs.writeFileSync(outPath, html, 'utf-8');
console.log(`Wrote ${outPath}`);
