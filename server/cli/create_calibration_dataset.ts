/**
 * Create Calibration Dataset
 * 
 * Combines grade files with projector probability estimates to create
 * a comprehensive calibration dataset for validation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

interface CalibrationRecord {
  date: string;
  team_a: string;
  team_b: string;
  a_score: number;
  b_score: number;
  margin: number;
  model_spread: number;
  market_spread: number;
  cover_prob: number;
  actual_covered: boolean;
  actual_margin: number;
  hit: boolean;
  profit: number;
}

function parseGradeFiles(resultsDir: string): CalibrationRecord[] {
  const records: CalibrationRecord[] = [];
  const processedDates = new Set<string>();
  
  try {
    const files = fs.readdirSync(resultsDir);
    const gradeFiles = files.filter(f => 
      (f.startsWith('grades_') && f.endsWith('.csv')) || 
      (f.startsWith('grades_') && f.endsWith('.json'))
    );
    
    // Process JSON files first (they're authoritative)
    for (const file of gradeFiles.filter(f => f.endsWith('.json'))) {
      const filePath = path.join(resultsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(content);
      const dateMatch = file.match(/grades_(\d{8})/);
      if (!dateMatch) continue;
      
      const dateStr = dateMatch[1];
      const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      processedDates.add(dateStr);
      
      if (Array.isArray(json.rows)) {
        for (const row of json.rows) {
          records.push({
            date,
            team_a: row.team_a,
            team_b: row.team_b,
            a_score: row.a_score,
            b_score: row.b_score,
            margin: row.margin,
            model_spread: 2.5, // Default - would need to be improved
            market_spread: row.market_spread || 0,
            cover_prob: 0.5, // Would need actual probability from picks
            actual_covered: row.covered || false,
            actual_margin: row.a_score - row.b_score,
            hit: (row.profit ?? 0) > 0,
            profit: row.profit ?? 0
          });
        }
      }
    }
    
    // Process CSV files only if no JSON for that date
    for (const file of gradeFiles.filter(f => f.endsWith('.csv'))) {
      const dateMatch = file.match(/grades_(\d{8})/);
      if (!dateMatch) continue;
      
      const dateStr = dateMatch[1];
      if (processedDates.has(dateStr)) continue; // Skip if JSON already processed
      
      const filePath = path.join(resultsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split(/\r?\n/);
      if (lines.length < 2) continue;
      
      const header = lines[0].split(',').map(h => h.trim());
      const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      processedDates.add(dateStr);
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const obj: Record<string, any> = {};
        
        header.forEach((key, idx) => {
          const val = values[idx];
          if (val === '' || val === undefined) return;
          obj[key] = isNaN(Number(val)) ? val : Number(val);
        });
        
        const a_score = obj.a_score;
        const b_score = obj.b_score;
        
        if (a_score === undefined || b_score === undefined) continue;
        
        records.push({
          date,
          team_a: obj.team_a,
          team_b: obj.team_b,
          a_score,
          b_score,
          margin: a_score - b_score,
          model_spread: obj.model_spread || 2.5,
          market_spread: obj.market_spread || 0,
          cover_prob: 0.5, // Would need actual probability
          actual_covered: obj.covered === true || obj.covered === 'True',
          actual_margin: a_score - b_score,
          hit: (obj.profit ?? 0) > 0,
          profit: obj.profit ?? 0
        });
      }
    }
  } catch (err) {
    console.error('Error parsing grade files:', err);
  }
  
  return records;
}

async function main() {
  console.log('📋 Creating Calibration Dataset\n');
  
  const resultsDir = path.join(root, 'data', 'results');
  const records = parseGradeFiles(resultsDir);
  
  if (records.length === 0) {
    console.log('❌ No graded games found');
    return;
  }
  
  // Create CSV output
  const headers = [
    'date',
    'team_a',
    'team_b',
    'a_score',
    'b_score',
    'margin',
    'model_spread',
    'market_spread',
    'cover_prob',
    'actual_covered',
    'actual_margin',
    'hit',
    'profit'
  ];
  
  const csvLines = [headers.join(',')];
  
  for (const record of records) {
    csvLines.push([
      record.date,
      record.team_a,
      record.team_b,
      record.a_score,
      record.b_score,
      record.margin,
      record.model_spread,
      record.market_spread,
      record.cover_prob,
      record.actual_covered,
      record.actual_margin,
      record.hit,
      record.profit
    ].join(','));
  }
  
  const outputPath = path.join(resultsDir, 'calibration_dataset.csv');
  fs.writeFileSync(outputPath, csvLines.join('\n'));
  
  console.log(`✓ Created calibration dataset: ${outputPath}`);
  console.log(`  Records: ${records.length}`);
  console.log(`  Date range: ${records[0].date} to ${records[records.length - 1].date}`);
  
  // Summary statistics
  const hits = records.filter(r => r.hit).length;
  const totalProfit = records.reduce((s, r) => s + r.profit, 0);
  const hitRate = hits / records.length;
  
  console.log(`\n  Hits: ${hits}/${records.length} (${(hitRate * 100).toFixed(1)}%)`);
  console.log(`  Total Profit: $${totalProfit.toFixed(2)}`);
  console.log(`  Avg Profit/Pick: $${(totalProfit / records.length).toFixed(2)}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
