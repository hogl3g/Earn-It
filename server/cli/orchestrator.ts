/**
 * ============================================================================
 * AUTOMATED ORCHESTRATOR
 * ============================================================================
 * 
 * Runs the complete daily cycle automatically:
 * 
 * 1. Scrape ESPN data (team stats, schedule, lines)
 * 2. Scrape KenPom data (rankings, efficiency)
 * 3. Merge data into unified metrics
 * 4. Generate today's picks (>80% confidence only)
 * 5. Grade yesterday's picks
 * 6. Update HTML with wins/losses
 * 7. Log everything
 * 
 * Can be run via:
 *   - `npx tsx server/cli/orchestrator.ts` (manual)
 *   - Cron job: `0 6 * * * cd /path/to/project && npx tsx server/cli/orchestrator.ts`
 *   - Task scheduler (Windows)
 * 
 * ============================================================================
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

interface Step {
  name: string;
  command: string;
  required: boolean;
  description: string;
}

const STEPS: Step[] = [
  {
    name: 'ESPN Scraper',
    command: 'npx tsx server/cli/scrape_espn.ts',
    required: true,
    description: 'Scrape ESPN team stats, schedule, and lines',
  },
  {
    name: 'KenPom Scraper',
    command: 'npx tsx server/cli/scrape_kenpom.ts',
    required: true,
    description: 'Scrape KenPom rankings and efficiency metrics',
  },
  {
    name: 'Daily Automation',
    command: 'npx tsx server/cli/daily_automation.ts',
    required: true,
    description: 'Generate today\'s picks from merged metrics',
  },
  {
    name: 'Auto-Grader',
    command: 'npx tsx server/cli/auto_grade.ts',
    required: false,
    description: 'Grade yesterday\'s picks (runs morning after)',
  },
  {
    name: 'HTML Generator',
    command: 'npx tsx server/cli/generate_picks_html.ts',
    required: true,
    description: 'Generate HTML with picks and wins/losses box',
  },
];

async function runStep(step: Step): Promise<boolean> {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`⚙️  ${step.name.toUpperCase()}`);
  console.log(`📝 ${step.description}`);
  console.log(`${'─'.repeat(80)}\n`);
  
  try {
    // Change to project root before running
    process.chdir(root);
    execSync(step.command, { stdio: 'inherit' });
    
    console.log(`\n✅ ${step.name} completed\n`);
    return true;
  } catch (err: any) {
    if (step.required) {
      console.error(`\n❌ ${step.name} FAILED (required step)`);
      return false;
    } else {
      console.warn(`\n⚠️  ${step.name} FAILED (optional, continuing)\n`);
      return true; // Don't stop pipeline for optional steps
    }
  }
}

async function logOrchestratorRun(): Promise<void> {
  const logPath = path.join(root, 'logs', 'orchestrator.log');
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] Daily cycle completed\n`;
  
  try {
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, message, 'utf-8');
  } catch (err) {
    console.warn('⚠️  Could not write log');
  }
}

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('🤖 AUTOMATED ORCHESTRATOR - COMPLETE DAILY CYCLE');
  console.log(`Start: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(80)}`);
  
  const results: Record<string, boolean> = {};
  
  // Run all steps
  for (const step of STEPS) {
    const success = await runStep(step);
    results[step.name] = success;
    
    // Stop if required step fails
    if (!success && step.required) {
      console.error(`\n${'='.repeat(80)}`);
      console.error('❌ ORCHESTRATOR FAILED - Required step failed');
      console.error(`${'='.repeat(80)}\n`);
      process.exit(1);
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 ORCHESTRATOR SUMMARY');
  console.log(`${'='.repeat(80)}\n`);
  
  for (const [name, success] of Object.entries(results)) {
    const status = success ? '✅' : '⚠️';
    console.log(`${status} ${name}`);
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`End: ${new Date().toISOString()}`);
  console.log('✅ DAILY CYCLE COMPLETE');
  console.log(`${'='.repeat(80)}\n`);
  
  // Log run
  await logOrchestratorRun();
}

main().catch(err => {
  console.error('\n❌ ORCHESTRATOR FATAL ERROR:', err);
  process.exit(1);
});
