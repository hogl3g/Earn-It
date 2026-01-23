import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

interface TeamMetrics {
  team_name: string;
  conference: string;
  win_rate: number;
  strength_rating: number;
  schedule_strength: number;
  momentum_score: number;
}

/**
 * Load enhanced team metrics for use in projector calculations
 * Usage in sports app 1.ts:
 *
 * const metrics = loadTeamMetrics();
 * const teamMetric = metrics.get('Arizona');
 * if (teamMetric) {
 *   // Apply strength-based confidence boost
 *   const confidenceBoost = (teamMetric.strength_rating - 0.5) * 0.2;
 *   confidence += confidenceBoost;
 * }
 */
export async function loadTeamMetrics(): Promise<Map<string, TeamMetrics>> {
  try {
    const metricsPath = path.join(
      process.cwd(),
      'data/results/team_metrics_2026_01_22.csv'
    );

    if (!fs.existsSync(metricsPath)) {
      console.warn('⚠️  Team metrics not found. Run: npx tsx server/cli/integrate_standings.ts');
      return new Map();
    }

    const content = fs.readFileSync(metricsPath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
    }) as any[];

    const metricsMap = new Map<string, TeamMetrics>();

    records.forEach((record) => {
      // Try multiple name formats for matching
      const fullName = record.team_name.toLowerCase();
      const shortName = record.team_name.split(' ')[0].toLowerCase();

      const metric: TeamMetrics = {
        team_name: record.team_name,
        conference: record.conference,
        win_rate: parseFloat(record.win_rate || 0),
        strength_rating: parseFloat(record.strength_rating || 0),
        schedule_strength: parseFloat(record.schedule_strength || 0),
        momentum_score: parseFloat(record.momentum_score || 0),
      };

      metricsMap.set(fullName, metric);
      metricsMap.set(shortName, metric);
    });

    console.log(`✅ Loaded ${records.length} team metrics`);
    return metricsMap;
  } catch (error) {
    console.error('❌ Error loading team metrics:', error);
    return new Map();
  }
}

/**
 * Calculate spread adjustment based on team strength differential
 *
 * @param teamAMetric - Team A metrics
 * @param teamBMetric - Team B metrics
 * @returns Suggested spread adjustment (positive favors Team A)
 *
 * Example: Arizona (0.996) vs Southern Utah (0.350)
 * Delta: 0.646 → ~6-7 point adjustment
 */
export function calculateStrengthAdjustment(
  teamAMetric: TeamMetrics | undefined,
  teamBMetric: TeamMetrics | undefined
): number {
  if (!teamAMetric || !teamBMetric) return 0;

  const strengthDelta = teamAMetric.strength_rating - teamBMetric.strength_rating;
  return strengthDelta * 10; // Scale to points
}

/**
 * Calculate confidence boost based on team strength and momentum
 *
 * @param metric - Team metrics
 * @returns Confidence adjustment (-0.2 to +0.2)
 *
 * Strong team on winning streak: ~+0.2
 * Weak team on losing streak: ~-0.2
 */
export function calculateConfidenceAdjustment(metric: TeamMetrics | undefined): number {
  if (!metric) return 0;

  const strengthBoost = (metric.strength_rating - 0.5) * 0.2;
  const momentumBoost = metric.momentum_score * 0.1;

  return Math.min(0.2, Math.max(-0.2, strengthBoost + momentumBoost));
}

/**
 * Get schedule context for a team
 *
 * @param metric - Team metrics
 * @returns Schedule difficulty category
 */
export function getScheduleContext(
  metric: TeamMetrics | undefined
): 'Elite' | 'Strong' | 'Moderate' | 'Weak' {
  if (!metric) return 'Moderate';

  if (metric.schedule_strength >= 0.75) return 'Elite';
  if (metric.schedule_strength >= 0.65) return 'Strong';
  if (metric.schedule_strength >= 0.55) return 'Moderate';
  return 'Weak';
}

/**
 * Integration example for sports app 1.ts
 *
 * In the pick generation loop:
 *
 * const metrics = await loadTeamMetrics();
 * const teamAMetrics = metrics.get(teamA.toLowerCase());
 * const teamBMetrics = metrics.get(teamB.toLowerCase());
 *
 * // Apply adjustments
 * const strengthAdj = calculateStrengthAdjustment(teamAMetrics, teamBMetrics);
 * const confidenceAdj = calculateConfidenceAdjustment(teamAMetrics);
 *
 * // Update spread and confidence
 * adjustedSpread = modelSpread + (strengthAdj * 0.5); // 50% weight to metrics
 * adjustedConfidence = baseConfidence + confidenceAdj;
 */
