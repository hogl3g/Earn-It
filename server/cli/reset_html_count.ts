#!/usr/bin/env node
/**
 * Reset HTML record counter to start fresh
 * 
 * This clears the cumulative wins/losses display and starts from 0-0
 * Use when you want to begin a new counting cycle
 * 
 * Usage:
 *   npx tsx server/cli/reset_html_count.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

const resultsDir = path.join(root, 'data', 'results');

// Create a marker file to indicate reset
const resetMarkerPath = path.join(resultsDir, '.html_count_reset');

try {
  // Write reset marker with timestamp
  fs.writeFileSync(resetMarkerPath, new Date().toISOString(), 'utf-8');
  console.log('✅ HTML count reset marker created');
  console.log(`   File: ${resetMarkerPath}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log('\n   Next time you run generate_picks_html.mjs, it will start from 0-0');
} catch (err) {
  console.error('❌ Failed to create reset marker:', err);
  process.exit(1);
}
