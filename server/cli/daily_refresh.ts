import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface PipelineLog {
  timestamp: string;
  steps: Array<{
    name: string;
    status: 'success' | 'error' | 'warning';
    message: string;
    duration_ms: number;
  }>;
  summary: {
    total_duration_ms: number;
    picks_count?: number;
    grades_count?: number;
    calibration_params?: { a: number; b: number };
    error?: string;
  };
}

async function runStep(name: string, command: string): Promise<{ success: boolean; message: string; duration: number }> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(command, { cwd: process.cwd() });
    const duration = Date.now() - start;
    return { success: true, message: stdout.trim(), duration };
  } catch (err: any) {
    const duration = Date.now() - start;
    return { success: false, message: err.message || String(err), duration };
  }
}

async function main() {
  const metaPath = decodeURIComponent(new URL(import.meta.url).pathname);
  const filePath = path.normalize(metaPath.replace(/^\//, ''));
  const workspace = path.resolve(path.dirname(filePath), '../..');
  const logsDir = path.join(workspace, 'data', 'results', 'clean', 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  const log: PipelineLog = {
    timestamp: new Date().toISOString(),
    steps: [],
    summary: { total_duration_ms: 0 }
  };

  const startTime = Date.now();

  // Step 0: Auto-grade picks
  console.log('Step 0/5: Auto-grading picks...');
  let result = await runStep('auto_grade_picks', 'npx tsx server/cli/auto_grade_picks.ts');
  log.steps.push({ name: 'auto_grade_picks', status: result.success ? 'success' : 'warning', message: result.message, duration_ms: result.duration });
  if (!result.success) {
    console.warn('⚠️  Auto-grading warning:', result.message);
  } else {
    console.log('✓ Auto-grading complete');
    const gradeMatch = result.message.match(/New grades added: (\d+)/);
    if (gradeMatch) log.summary.grades_count = parseInt(gradeMatch[1]);
  }

  // Step 1: Auto-fix data issues
  console.log('Step 1/5: Auto-fixing data issues...');
  result = await runStep('auto_fix_data_issues', 'npx tsx server/cli/auto_fix_data_issues.ts');
  log.steps.push({ name: 'auto_fix_data_issues', status: result.success ? 'success' : 'error', message: result.message, duration_ms: result.duration });
  if (!result.success) {
    console.error('❌ Auto-fix failed:', result.message);
    log.summary.error = result.message;
  } else {
    console.log('✓ Auto-fix complete');
  }

  // Step 2: Validate datasets
  console.log('Step 2/5: Validating datasets...');
  result = await runStep('validate_data', 'npx tsx server/cli/validate_data.ts');
  log.steps.push({ name: 'validate_data', status: result.success ? 'success' : 'error', message: result.message, duration_ms: result.duration });
  if (!result.success) {
    console.error('❌ Validation failed:', result.message);
    log.summary.error = result.message;
  } else {
    console.log('✓ Validation complete');
  }

  // Step 3: Recalibrate probabilities
  console.log('Step 3/5: Recalibrating probabilities...');
  result = await runStep('recalibrate_probabilities', 'npx tsx server/cli/recalibrate_probabilities.ts');
  log.steps.push({ name: 'recalibrate_probabilities', status: result.success ? 'success' : 'warning', message: result.message, duration_ms: result.duration });
  if (!result.success) {
    console.warn('⚠️  Recalibration warning:', result.message);
  } else {
    console.log('✓ Recalibration complete');
    // Try to parse calibration params from output
    const paramMatch = result.message.match(/Params: a=([\d.\-]+), b=([\d.\-]+)/);
    if (paramMatch) {
      log.summary.calibration_params = { a: parseFloat(paramMatch[1]), b: parseFloat(paramMatch[2]) };
    }
  }

  // Step 4: Export enhanced picks
  console.log('Step 4/6: Exporting enhanced picks...');
  result = await runStep('export_enhanced_picks', 'npx tsx server/cli/export_enhanced_picks.ts');
  log.steps.push({ name: 'export_enhanced_picks', status: result.success ? 'success' : 'error', message: result.message, duration_ms: result.duration });
  if (!result.success) {
    console.error('❌ Enhanced picks export failed:', result.message);
    log.summary.error = result.message;
  } else {
    console.log('✓ Enhanced picks export complete');
    const pickMatch = result.message.match(/Total Picks: (\d+)/);
    if (pickMatch) log.summary.picks_count = parseInt(pickMatch[1]);
  }

  // Step 5: Generate public HTML (wins/losses + scores)
  console.log('Step 5/6: Generating projector HTML...');
  result = await runStep('generate_picks_html', 'node scripts/generate_picks_html.mjs');
  log.steps.push({ name: 'generate_picks_html', status: result.success ? 'success' : 'warning', message: result.message, duration_ms: result.duration });
  if (!result.success) {
    console.warn('⚠️  HTML generation warning:', result.message);
  } else {
    console.log('✓ HTML generated');
  }

  log.summary.total_duration_ms = Date.now() - startTime;

  // Write log
  const logFile = path.join(logsDir, `pipeline_${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));

  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                   DAILY REFRESH COMPLETE                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`✓ Timestamp: ${log.timestamp}`);
  console.log(`✓ Duration: ${(log.summary.total_duration_ms / 1000).toFixed(1)}s`);
  console.log(`✓ Steps: ${log.steps.filter(s => s.status === 'success').length}/${log.steps.length} succeeded`);
  if (log.summary.grades_count !== undefined && log.summary.grades_count > 0) {
    console.log(`✓ Grades added: ${log.summary.grades_count}`);
  }
  if (log.summary.calibration_params) {
    console.log(`✓ Calibration: a=${log.summary.calibration_params.a.toFixed(4)}, b=${log.summary.calibration_params.b.toFixed(4)}`);
  }
  if (log.summary.picks_count) {
    console.log(`✓ Picks exported: ${log.summary.picks_count}`);
  }
  console.log(`✓ Log saved: ${logFile}\n`);

  if (log.summary.error) {
    console.error('⚠️  Pipeline encountered errors. Review logs.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
