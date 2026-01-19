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

// Try to locate graded results JSON for the date present in picks
let gradesSummary = null;
let gradesMap = null;
let extendedHeaders = [...headers];

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
    extendedHeaders = [...headers, 'coverProb', 'a_score', 'b_score', 'margin', 'covered', 'won', 'profit'];
  }
} catch (err) {
  console.warn('Could not parse graded results JSON:', err?.message || String(err));
}

const tableRows = rows.map((line) => {
  const cols = line.split(',');
  const key = `${cols[1]}|${cols[2]}`;
  const grade = gradesMap ? gradesMap.get(key) : null;
  const extra = grade ? [
    grade.coverProb == null ? '' : String(Math.round(grade.coverProb * 100)) + '%',
    grade.a_score == null ? '' : String(grade.a_score),
    grade.b_score == null ? '' : String(grade.b_score),
    grade.margin == null ? '' : String(grade.margin),
    grade.covered == null ? '' : (grade.covered ? 'Y' : 'N'),
    grade.won == null ? '' : (grade.won ? 'W' : 'L'),
    grade.profit == null ? '' : String(Math.round(grade.profit * 100) / 100)
  ] : [];

  const displayCols = [...cols, ...extra];

  return `<tr>${displayCols.map((c, idx) => {
    const val = escaped(c);
    // Add asterisk to team_a (index 1) - the projected pick from original columns
    return `<td>${idx === 1 ? val + ' *' : val}</td>`;
  }).join('')}</tr>`;
}).join('\n');

// Build wins/losses summary box
let winsLossesHtml = '';
let gameScoresHtml = '';

// Aggregate all grades files for cumulative totals
let cumulativeWins = 0;
let cumulativeLosses = 0;
const allGameScores = [];
let mostRecentGameDate = '';

try {
  // Find all grades_*.json files in data/results
  const resultsDir = path.join(root, 'data', 'results');
  const gradesFiles = fs.readdirSync(resultsDir).filter(f => f.match(/^grades_\d{8}\.json$/)).sort().reverse();
  
  // Get the most recent grades file WITH completed games (non-zero scores)
  let mostRecentFile = null;
  let mostRecentCompletedFile = null;
  
  for (const file of gradesFiles) {
    if (!mostRecentFile) mostRecentFile = file;
    
    try {
      let gj = fs.readFileSync(path.join(resultsDir, file), 'utf-8');
      gj = gj.replace(/\bNaN\b/g, 'null');
      const parsed = JSON.parse(gj);
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
  
  gradesFiles.forEach(file => {
    try {
      let gj = fs.readFileSync(path.join(resultsDir, file), 'utf-8');
      gj = gj.replace(/\bNaN\b/g, 'null');
      const parsed = JSON.parse(gj);
      const rowsJson = Array.isArray(parsed.rows) ? parsed.rows : [];
      
      rowsJson.forEach(row => {
        // Only count games that have actual scores (not "score not found")
        if (row.a_score != null && row.b_score != null && (row.a_score > 0 || row.b_score > 0) && !row.note) {
          if (row.won === true) {
            cumulativeWins++;
          } else if (row.won === false) {
            cumulativeLosses++;
          }
        }
        
        // Only collect game scores from the most recent COMPLETED file
        if (file === mostRecentCompletedFile && row.a_score != null && row.b_score != null && (row.a_score > 0 || row.b_score > 0) && !row.note) {
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
    } catch (err) {
      console.warn(`Could not parse ${file}:`, err?.message || String(err));
    }
  });
} catch (err) {
  console.warn('Could not read grades files:', err?.message || String(err));
}

if (cumulativeWins > 0 || cumulativeLosses > 0) {
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
}

if (allGameScores.length > 0) {
  gameScoresHtml = `
  <div class="game-scores-box">
    <h2>Previous Day Game Scores${mostRecentGameDate ? ` (${mostRecentGameDate})` : ''}</h2>
    <table class="scores-table">
      <thead>
        <tr>
          <th>Away Team</th>
          <th>Home Team</th>
          <th>Away Score</th>
          <th>Home Score</th>
          <th>Margin</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        ${allGameScores.map(game => `
          <tr>
            <td>${escaped(game.team_a)}</td>
            <td>${escaped(game.team_b)}</td>
            <td>${game.a_score}</td>
            <td>${game.b_score}</td>
            <td>${game.margin}</td>
            <td><span class="result ${game.won ? 'win' : 'loss'}">${game.won ? 'W' : 'L'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  `;
}

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
