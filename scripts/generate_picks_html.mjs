import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const csvPath = path.join(root, 'data', 'results', 'ts_projector_picks.csv');
const publicDir = path.join(root, 'public');
const outPath = path.join(publicDir, 'index.html');

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

// Copy CSV for download
fs.writeFileSync(path.join(publicDir, 'ts_projector_picks.csv'), raw, 'utf-8');

const escaped = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const tableRows = rows.map((line) => {
  const cols = line.split(',');
  return `<tr>${cols.map((c) => `<td>${escaped(c)}</td>`).join('')}</tr>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Projector Picks</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    h1 { margin-bottom: 8px; }
    .meta { margin-bottom: 16px; }
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
  <a class="download" href="./ts_projector_picks.csv" download>Download CSV</a>
  <div class="scroll">
    <table>
      <thead><tr>${headers.map((h) => `<th>${escaped(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>
</body>
</html>`;

fs.writeFileSync(outPath, html, 'utf-8');
console.log(`Wrote ${outPath}`);
