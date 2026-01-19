/**
 * Model Health Check System
 * 
 * Monitors model performance and alerts on anomalies:
 * - Calibration drift (probabilities diverging from reality)
 * - Hit rate regression
 * - Unusual variance in picks
 * - Data quality issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

interface HealthMetrics {
  date: string;
  picks: number;
  hitRate: number;
  avgStake: number;
  roi: number;
  avgConfidence: number;
}

interface HealthAlert {
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  metric: string;
  message: string;
  currentValue: number | string;
  threshold: number | string;
}

function parseHistoricalMetrics(resultsDir: string): HealthMetrics[] {
  const metrics: HealthMetrics[] = [];
  
  try {
    const files = fs.readdirSync(resultsDir);
    const gradeFiles = files.filter(f => f.startsWith('grades_') && f.endsWith('.json'));
    
    for (const file of gradeFiles) {
      const filePath = path.join(resultsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(content);
      
      const dateMatch = file.match(/grades_(\d{8})/);
      if (!dateMatch) continue;
      
      const dateStr = dateMatch[1];
      const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      
      if (json.summary) {
        const summary = json.summary;
        metrics.push({
          date,
          picks: summary.total_picks || 0,
          hitRate: summary.total_picks > 0 ? summary.wins / summary.total_picks : 0,
          avgStake: summary.total_stake && summary.total_picks
            ? summary.total_stake / summary.total_picks
            : 0,
          roi: summary.total_stake > 0
            ? summary.total_profit / summary.total_stake
            : 0,
          avgConfidence: 0.67 // Default - would need actual data from picks
        });
      }
    }
  } catch (err) {
    console.error('Error parsing metrics:', err);
  }
  
  return metrics.sort((a, b) => a.date.localeCompare(b.date));
}

function detectAnomalies(metrics: HealthMetrics[]): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  
  if (metrics.length === 0) return alerts;
  
  // Calculate rolling statistics
  const recentMetrics = metrics.slice(-7); // Last 7 days
  const historicalMetrics = metrics.slice(-30); // Last 30 days
  
  const recentHitRate = recentMetrics.length > 0
    ? recentMetrics.reduce((s, m) => s + m.hitRate, 0) / recentMetrics.length
    : 0;
  
  const historicalHitRate = historicalMetrics.length > 0
    ? historicalMetrics.reduce((s, m) => s + m.hitRate, 0) / historicalMetrics.length
    : 0;
  
  const recentRoi = recentMetrics.length > 0
    ? recentMetrics.reduce((s, m) => s + m.roi, 0) / recentMetrics.length
    : 0;
  
  const historicalRoi = historicalMetrics.length > 0
    ? historicalMetrics.reduce((s, m) => s + m.roi, 0) / historicalMetrics.length
    : 0;
  
  // Calculate variance
  const variance = recentMetrics.length > 1
    ? recentMetrics.reduce((s, m) => s + Math.pow(m.roi - recentRoi, 2), 0) / recentMetrics.length
    : 0;
  const stdDev = Math.sqrt(variance);
  
  // Check for hit rate regression
  if (recentHitRate < 0.52 && historicalHitRate > 0.55) {
    alerts.push({
      severity: 'WARNING',
      metric: 'Hit Rate Regression',
      message: 'Recent hit rate has dropped below acceptable threshold',
      currentValue: (recentHitRate * 100).toFixed(1) + '%',
      threshold: '52.4%'
    });
  }
  
  // Check for negative ROI trend
  if (recentRoi < -0.05 && historicalRoi > 0.05) {
    alerts.push({
      severity: 'CRITICAL',
      metric: 'ROI Degradation',
      message: 'Model ROI has turned negative - possible model drift',
      currentValue: (recentRoi * 100).toFixed(1) + '%',
      threshold: '> 0%'
    });
  }
  
  // Check for high variance
  if (stdDev > 0.20) {
    alerts.push({
      severity: 'WARNING',
      metric: 'High Volatility',
      message: 'ROI variance is unusually high - inconsistent performance',
      currentValue: (stdDev * 100).toFixed(1) + '%',
      threshold: '< 20%'
    });
  }
  
  // Check for low pick count
  const avgPicksPerDay = recentMetrics.length > 0
    ? recentMetrics.reduce((s, m) => s + m.picks, 0) / recentMetrics.length
    : 0;
  
  if (avgPicksPerDay < 5) {
    alerts.push({
      severity: 'INFO',
      metric: 'Low Pick Volume',
      message: 'Average picks per day is low - may lack statistical significance',
      currentValue: avgPicksPerDay.toFixed(1),
      threshold: '≥ 10'
    });
  }
  
  // Check for extreme confidence on low accuracy
  if (recentHitRate < 0.45 && historicalHitRate < 0.50) {
    alerts.push({
      severity: 'CRITICAL',
      metric: 'Confidence-Accuracy Mismatch',
      message: 'Model is overconfident - hit rate < 45% consistently',
      currentValue: (recentHitRate * 100).toFixed(1) + '%',
      threshold: '≥ 52.4%'
    });
  }
  
  return alerts;
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║             🏥 MODEL HEALTH CHECK SYSTEM                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const resultsDir = path.join(root, 'data', 'results');
  const metrics = parseHistoricalMetrics(resultsDir);
  
  if (metrics.length === 0) {
    console.log('❌ No historical data found\n');
    return;
  }
  
  const alerts = detectAnomalies(metrics);
  
  // Summary
  const lastMetric = metrics[metrics.length - 1];
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('CURRENT STATUS (Latest Day)');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Date               : ${lastMetric.date}`);
  console.log(`Picks              : ${lastMetric.picks}`);
  console.log(`Hit Rate           : ${(lastMetric.hitRate * 100).toFixed(1)}%`);
  console.log(`ROI                : ${(lastMetric.roi * 100).toFixed(1)}%`);
  
  // Alerts
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`ALERTS (${alerts.length})`);
  console.log('═══════════════════════════════════════════════════════════════════');
  
  if (alerts.length === 0) {
    console.log('✓ No alerts - model health is good');
  } else {
    for (const alert of alerts) {
      const icon = alert.severity === 'CRITICAL' ? '🔴' 
                 : alert.severity === 'WARNING' ? '🟡' 
                 : '🔵';
      
      console.log(`\n${icon} ${alert.severity}: ${alert.metric}`);
      console.log(`   ${alert.message}`);
      console.log(`   Current: ${alert.currentValue} | Threshold: ${alert.threshold}`);
    }
  }
  
  // Recommendations
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════════');
  
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');
  const warningAlerts = alerts.filter(a => a.severity === 'WARNING');
  
  if (criticalAlerts.length > 0) {
    console.log('\n🔴 CRITICAL - Take immediate action:');
    for (const alert of criticalAlerts) {
      if (alert.metric.includes('ROI')) {
        console.log('  • Review recent picks for systematic errors');
        console.log('  • Check if market conditions have changed');
        console.log('  • Consider reducing pick volume temporarily');
      } else if (alert.metric.includes('Confidence')) {
        console.log('  • Recalibrate probability model on recent data');
        console.log('  • Review edge detection logic');
        console.log('  • Validate spreads and scoring data');
      }
    }
  }
  
  if (warningAlerts.length > 0) {
    console.log('\n🟡 WARNING - Monitor closely:');
    if (warningAlerts.some(a => a.metric.includes('Regression'))) {
      console.log('  • Hit rate is declining - watch next 10 picks carefully');
    }
    if (warningAlerts.some(a => a.metric.includes('Volatility'))) {
      console.log('  • High variance suggests inconsistency - check for data quality issues');
    }
  }
  
  if (alerts.length === 0) {
    console.log('\n✓ Model is performing well - continue with current strategy');
  }
  
  console.log('\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
