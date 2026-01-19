import fs from 'fs';
import path from 'path';

interface CalibrationData {
  a: number;
  b: number;
  sampleSize: number;
  status?: 'ok' | 'insufficient-variance' | 'small-sample';
  bucketMetrics?: Array<{ bucket: string; n: number; predAvg: number; hitRate: number }>;
}

interface GradeSummary {
  date: string;
  total_picks: number;
}

function interpretCalibrationStatus(calib: CalibrationData): string {
  if (calib.status === 'insufficient-variance') return '❌ DEGENERATE (no outcome variance)';
  if (calib.status === 'small-sample') return '⚠️  UNRELIABLE (n<15)';
  if (calib.a === 1 && calib.b === 0) return '❌ IDENTITY (unchanged)';
  if (Math.abs(calib.b) > 2) return '⚠️  EXTREME (steep slope)';
  if (calib.sampleSize < 5) return '❌ INSUFFICIENT (n<5)';
  if (calib.sampleSize < 15) return '⚠️  SMALL (5≤n<15)';
  if (calib.sampleSize < 30) return '✓ MODERATE (15≤n<30)';
  return '✓ ROBUST (n≥30)';
}

function interpretFitQuality(calib: CalibrationData): { label: string; recommendation: string } {
  if (!calib.bucketMetrics || calib.bucketMetrics.length === 0) {
    return { label: 'UNKNOWN', recommendation: 'Insufficient bucket data to assess fit.' };
  }

  const buckets = calib.bucketMetrics;
  const calibErrors = buckets.map(b => Math.abs(b.predAvg - b.hitRate));
  const avgError = calibErrors.reduce((s, e) => s + e, 0) / calibErrors.length;
  const maxError = Math.max(...calibErrors);

  if (avgError < 0.05) return { label: '⭐ EXCELLENT', recommendation: 'Calibration is accurate; use full-Kelly sizing.' };
  if (avgError < 0.10) return { label: '✓ GOOD', recommendation: 'Calibration is reasonably accurate; use half-Kelly.' };
  if (avgError < 0.15) return { label: '⚠️  FAIR', recommendation: 'Calibration has moderate error; use quarter-Kelly or reduce stakes.' };
  return { label: '❌ POOR', recommendation: 'Calibration has high error; accumulate more data before relying on it.' };
}

function main() {
  const metaPath = decodeURIComponent(new URL(import.meta.url).pathname);
  const filePath = path.normalize(metaPath.replace(/^\//, ''));
  const workspace = path.resolve(path.dirname(filePath), '../..');
  const calibPath = path.join(workspace, 'data', 'results', 'clean', 'prob_calibration.json');

  if (!fs.existsSync(calibPath)) {
    console.log('\n📊 CALIBRATION STATUS DASHBOARD\n');
    console.log('❌ No calibration file found:', calibPath);
    console.log('   → Run: npx tsx server/cli/daily_refresh.ts');
    return;
  }

  const calib: CalibrationData = JSON.parse(fs.readFileSync(calibPath, 'utf8'));
  const statusMsg = interpretCalibrationStatus(calib);
  const fitQuality = interpretFitQuality(calib);

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║          📊 CALIBRATION STATUS DASHBOARD                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`Status:          ${statusMsg}`);
  console.log(`Sample Size:     ${calib.sampleSize} games`);
  console.log(`Params:          f(p) = ${calib.a.toFixed(4)} + ${calib.b.toFixed(4)}·p`);

  console.log(`\nFit Quality:     ${fitQuality.label}`);
  console.log(`Recommendation:  ${fitQuality.recommendation}`);

  if (calib.bucketMetrics && calib.bucketMetrics.length > 0) {
    console.log('\nBucket Analysis:');
    console.log('────────────────────────────────────────────────────────────');
    console.log('Confidence   | Sample Size | Predicted | Actual   | Error');
    console.log('────────────────────────────────────────────────────────────');
    for (const b of calib.bucketMetrics) {
      const error = Math.abs(b.predAvg - b.hitRate);
      const predPct = (b.predAvg * 100).toFixed(1);
      const actualPct = (b.hitRate * 100).toFixed(1);
      const errorPct = (error * 100).toFixed(1);
      console.log(`${b.bucket.padEnd(12)} | ${String(b.n).padStart(11)} | ${predPct.padStart(8)}% | ${actualPct.padStart(7)}% | ${errorPct.padStart(5)}%`);
    }
  }

  console.log('\n\nInterpretation:');
  console.log('────────────────────────────────────────────────────────────');
  if (calib.sampleSize < 15) {
    console.log('⚠️  Insufficient sample size for reliable calibration.');
    console.log('   Target: Accumulate 50+ graded games across overlapping dates.');
    console.log('   Current coverage is too small to trust recalibrated probabilities.');
  } else if (calib.a === 1 && calib.b === 0) {
    console.log('⚠️  Calibration is degenerate (identity mapping).');
    console.log('   This occurs when all outcomes are the same (all wins or all losses).');
    console.log('   Verify: Are the grades loaded and do they have enough variance?');
  } else {
    console.log('✓ Calibration fit is being tracked.');
    const direction = calib.b > 0 ? 'increases' : 'decreases';
    console.log(`   Fitted curve ${direction} with predicted probability.`);
    if (Math.abs(calib.b - 1) > 0.2) {
      console.log(`   Note: Slope differs from 1.0 (perfect calibration).`);
      if (calib.b < 1) {
        console.log(`   Interpretation: Model is overconfident (predicted > actual).`);
      } else {
        console.log(`   Interpretation: Model is underconfident (predicted < actual).`);
      }
    }
  }

  console.log('\nNext Steps:');
  console.log('────────────────────────────────────────────────────────────');
  if (calib.sampleSize < 30) {
    console.log('1. Accumulate more graded games (target: 50+ samples)');
    console.log('2. Re-run: npx tsx server/cli/daily_refresh.ts');
    console.log('3. Check: npx tsx server/cli/calibration_status.ts');
  } else {
    console.log('1. Monitor calibration error weekly');
    console.log('2. If error > 10%, review model edge detection logic');
    console.log('3. If error < 5%, increase bet sizing confidence');
  }

  console.log('\n');
}

main();
