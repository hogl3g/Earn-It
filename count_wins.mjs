import fs from 'fs';
import path from 'path';

const resultsDir = path.join(process.cwd(), 'data', 'results');
const files = fs.readdirSync(resultsDir).filter(f => f.match(/^grades_\d{8}\.json$/)).sort();

let totalW = 0, totalL = 0;

files.forEach(file => {
  let gj = fs.readFileSync(path.join(resultsDir, file), 'utf-8').replace(/\bNaN\b/g, 'null');
  const parsed = JSON.parse(gj);
  const rows = parsed.rows || [];
  
  console.log(`\n${file}:`);
  let fileW = 0, fileL = 0;
  
  rows.forEach(r => {
    if (r.a_score != null && r.b_score != null && (r.a_score > 0 || r.b_score > 0) && !r.note) {
      if (r.won === true) {
        fileW++;
        totalW++;
      } else if (r.won === false) {
        fileL++;
        totalL++;
      }
    }
  });
  
  console.log(`  ${fileW}W-${fileL}L (${rows.length} total picks)`);
});

console.log(`\n=== TOTALS ===`);
console.log(`Wins: ${totalW}`);
console.log(`Losses: ${totalL}`);
console.log(`Total: ${totalW + totalL}`);
console.log(`Win Rate: ${((totalW / (totalW + totalL)) * 100).toFixed(1)}%`);
