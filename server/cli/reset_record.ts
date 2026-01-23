/**
 * Reset wins/losses record to 0-0
 * Clears all grades_*.json files' summary stats
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

async function main() {
  const resultsDir = path.join(root, 'data', 'results');
  
  // Find all grades_*.json files
  const files = await fs.readdir(resultsDir);
  const gradesFiles = files.filter(f => f.match(/^grades_\d{8}\.json$/));
  
  console.log(`\nResetting ${gradesFiles.length} grades files...\n`);
  
  for (const file of gradesFiles) {
    try {
      const filePath = path.join(resultsDir, file);
      let content = await fs.readFile(filePath, 'utf-8');
      
      // Replace NaN tokens
      content = content.replace(/\bNaN\b/g, 'null');
      
      let parsed = JSON.parse(content);
      
      // Reset summary
      parsed.summary = {
        wins: 0,
        losses: 0,
        total_picks: 0,
        total_profit: 0,
        hit_rate: 0,
        avg_confidence: 0,
      };
      
      // Write back
      await fs.writeFile(filePath, JSON.stringify(parsed, null, 2), 'utf-8');
      console.log(`✅ ${file} - reset to 0-0`);
    } catch (err) {
      console.error(`❌ ${file} - failed:`, err);
    }
  }
  
  console.log('\n✅ Record reset complete. Starting fresh tomorrow!\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
