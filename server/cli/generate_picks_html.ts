/**
 * ============================================================================
 * GENERATE PICKS HTML PAGE
 * ============================================================================
 * 
 * Generates an HTML page displaying:
 * - Today's picks with confidence levels
 * - Cumulative record (wins/losses)
 * - Market alignment
 * 
 * Published to: public/picks.html
 * 
 * ============================================================================
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

interface Pick {
  date: string;
  team_a: string;
  team_b: string;
  picked_team: string;
  confidence: number;
  confidence_pct: string;
  spread: number;
  moneyline: string;
  moneyline_check: string;
}

/**
 * Load picks from CSV
 */
async function loadPicks(): Promise<Pick[]> {
  const picksPath = path.join(root, 'data', 'results', 'ts_projector_picks.csv');
  
  if (!existsSync(picksPath)) {
    return [];
  }
  
  const content = readFileSync(picksPath, 'utf-8');
  const lines = content.trim().split(/\r?\n/);
  
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',');
  const picks: Pick[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const pick: Record<string, any> = {};
    
    headers.forEach((h, idx) => {
      pick[h] = parts[idx] || '';
    });
    
    picks.push({
      date: pick.date,
      team_a: pick.team_a,
      team_b: pick.team_b,
      picked_team: pick.picked_team,
      confidence: parseFloat(pick.confidence) || 0,
      confidence_pct: pick.confidence_pct || '0%',
      spread: parseFloat(pick.spread) || 0,
      moneyline: pick.moneyline || 'N/A',
      moneyline_check: pick.alignment || 'N/A',
    });
  }
  
  return picks;
}

/**
 * Load cumulative record
 */
async function loadRecord(): Promise<{ wins: number; losses: number }> {
  const recordPath = path.join(root, 'data', 'processed', 'cumulative_record.json');
  
  try {
    const content = readFileSync(recordPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { wins: 0, losses: 0 };
  }
}

/**
 * Generate HTML
 */
function generateHTML(picks: Pick[], record: { wins: number; losses: number }): string {
  const today = new Date().toISOString().split('T')[0];
  const winRate = record.wins + record.losses > 0 
    ? ((record.wins / (record.wins + record.losses)) * 100).toFixed(1)
    : '0.0';
  
  const picksHTML = picks.length === 0 
    ? '<p style="color: #999; text-align: center; padding: 20px;">No picks today</p>'
    : picks.map(pick => `
    <div class="pick-card">
      <div class="pick-header">
        <span class="pick-team">${pick.picked_team}</span>
        <span class="pick-confidence ${pick.confidence >= 0.70 ? 'high' : 'medium'}">
          ${Math.round(pick.confidence * 100)}%
        </span>
      </div>
      <div class="pick-details">
        <div class="matchup">${pick.team_a} vs ${pick.team_b}</div>
        <div class="spread">Spread: ${pick.spread > 0 ? '+' : ''}${pick.spread.toFixed(1)}</div>
        <div class="alignment ${pick.moneyline_check.includes('ALIGNED') ? 'good' : 'warning'}">
          ${pick.moneyline_check}
        </div>
      </div>
    </div>
  `).join('');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Basketball Picks - Projector</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            padding: 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        
        .header {
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .header h1 {
            font-size: 32px;
            margin-bottom: 10px;
            color: #667eea;
        }
        
        .header p {
            color: #666;
            font-size: 14px;
        }
        
        .record {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-top: 20px;
        }
        
        .record-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        
        .record-item .label {
            font-size: 12px;
            color: #999;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        
        .record-item .value {
            font-size: 28px;
            font-weight: bold;
            color: #333;
        }
        
        .record-item.wins .value { color: #4CAF50; }
        .record-item.losses .value { color: #f44336; }
        .record-item.rate .value { color: #667eea; }
        
        .picks-section {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .picks-section h2 {
            font-size: 20px;
            margin-bottom: 20px;
            color: #333;
        }
        
        .picks-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 15px;
        }
        
        .pick-card {
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            background: #fafafa;
            transition: all 0.3s ease;
        }
        
        .pick-card:hover {
            border-color: #667eea;
            background: white;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
        }
        
        .pick-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .pick-team {
            font-weight: 600;
            font-size: 14px;
            color: #333;
        }
        
        .pick-confidence {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            background: #e0e0e0;
            color: #333;
        }
        
        .pick-confidence.high {
            background: #4CAF50;
            color: white;
        }
        
        .pick-confidence.medium {
            background: #FFC107;
            color: #333;
        }
        
        .pick-details {
            font-size: 12px;
            color: #666;
        }
        
        .pick-details > div {
            margin: 6px 0;
        }
        
        .matchup {
            font-weight: 500;
            color: #333;
        }
        
        .spread {
            color: #999;
        }
        
        .alignment {
            padding: 4px 8px;
            border-radius: 4px;
            background: #fff3cd;
            color: #856404;
        }
        
        .alignment.good {
            background: #d4edda;
            color: #155724;
        }
        
        .alignment.warning {
            background: #fff3cd;
            color: #856404;
        }
        
        .timestamp {
            text-align: center;
            color: #999;
            font-size: 12px;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
        
        @media (max-width: 600px) {
            .header {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 24px;
            }
            
            .record {
                grid-template-columns: 1fr;
            }
            
            .picks-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏀 Basketball Picks</h1>
            <p>AI-powered college basketball predictions - Updated daily at 10 AM</p>
            
            <div class="record">
                <div class="record-item wins">
                    <div class="label">Wins</div>
                    <div class="value">${record.wins}</div>
                </div>
                <div class="record-item losses">
                    <div class="label">Losses</div>
                    <div class="value">${record.losses}</div>
                </div>
                <div class="record-item rate">
                    <div class="label">Win Rate</div>
                    <div class="value">${winRate}%</div>
                </div>
            </div>
        </div>
        
        <div class="picks-section">
            <h2>${today === picks[0]?.date ? 'Today\'s Picks' : 'Latest Picks'} (${picks.length})</h2>
            <div class="picks-grid">
                ${picksHTML}
            </div>
            
            <div class="timestamp">
                Last updated: ${new Date().toLocaleString()}
            </div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Main
 */
async function main() {
  console.log('📄 Generating picks HTML page...\n');
  
  try {
    const picks = await loadPicks();
    const record = await loadRecord();
    
    const html = generateHTML(picks, record);
    
    const outputPath = path.join(root, 'public', 'picks.html');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, html, 'utf-8');
    
    console.log(`✅ Published picks to public/picks.html`);
    console.log(`   Picks: ${picks.length}`);
    console.log(`   Record: ${record.wins}-${record.losses}\n`);
  } catch (error) {
    console.error('❌ Error generating HTML:', error);
    process.exit(1);
  }
}

main();
