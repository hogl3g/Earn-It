import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const proc = spawn('npx', [
  'tsx',
  join(__dirname, 'sports app 1.ts'),
  '--source', 'talisman',
  '--date', '2026-01-11'
], {
  cwd: join(__dirname, '..', '..'),
  stdio: 'inherit'
});

proc.on('exit', (code) => {
  process.exit(code);
});
