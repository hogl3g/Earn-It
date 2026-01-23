import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

export interface TeamMetrics {
  team_name: string;
  adjO?: number;
  adjD?: number;
  conference?: string;
  win_rate?: number;
  strength_rating?: number;
  schedule_strength?: number;
  momentum_score?: number;
  offensive_ppg?: number;
  offensive_rating?: number;
  fg_efficiency?: number;
  three_point_rating?: number;
  rebounding_rating?: number;
  passing_rating?: number;
  ball_security?: number;
}

/**
 * Load all team metrics from the enhanced team database
 * Includes strength ratings, offensive efficiency, schedule difficulty
 */
export function loadTeamMetrics(): Map<string, TeamMetrics> {
  const metricsPath = path.join(
    process.cwd(),
    'data/raw/d1_teams_enhanced.csv'
  );

  try {
    const content = fs.readFileSync(metricsPath, 'utf-8');
    const teams = parse(content, {
      columns: true,
      skip_empty_lines: true,
    }) as any[];

    const metricsMap = new Map<string, TeamMetrics>();

    teams.forEach((row) => {
      const normalizedName = row.team_name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim();

      metricsMap.set(normalizedName, {
        team_name: row.team_name,
        adjO: row.adjO ? parseFloat(row.adjO) : undefined,
        adjD: row.adjD ? parseFloat(row.adjD) : undefined,
        conference: row.conference || undefined,
        win_rate: row.win_rate ? parseFloat(row.win_rate) : undefined,
        strength_rating: row.strength_rating ? parseFloat(row.strength_rating) : undefined,
        schedule_strength: row.schedule_strength ? parseFloat(row.schedule_strength) : undefined,
        momentum_score: row.momentum_score ? parseFloat(row.momentum_score) : undefined,
        offensive_ppg: row.offensive_ppg ? parseFloat(row.offensive_ppg) : undefined,
        offensive_rating: row.offensive_rating ? parseFloat(row.offensive_rating) : undefined,
        fg_efficiency: row.fg_efficiency ? parseFloat(row.fg_efficiency) : undefined,
        three_point_rating: row.three_point_rating ? parseFloat(row.three_point_rating) : undefined,
        rebounding_rating: row.rebounding_rating ? parseFloat(row.rebounding_rating) : undefined,
        passing_rating: row.passing_rating ? parseFloat(row.passing_rating) : undefined,
        ball_security: row.ball_security ? parseFloat(row.ball_security) : undefined,
      });
    });

    return metricsMap;
  } catch (error) {
    console.error('Failed to load team metrics:', error);
    return new Map();
  }
}

/**
 * Calculate spread adjustment based on strength rating differential
 * Higher strength ratings get positive deltas (they're favored)
 */
export function calculateStrengthAdjustment(
  teamA: string,
  teamB: string,
  baseSpread: number,
  metrics: Map<string, TeamMetrics>
): number {
  const normalizeTeamName = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  const metricA = metrics.get(normalizeTeamName(teamA));
  const metricB = metrics.get(normalizeTeamName(teamB));

  if (!metricA?.strength_rating || !metricB?.strength_rating) {
    return baseSpread;
  }

  const strengthDiff = metricA.strength_rating - metricB.strength_rating;
  const adjustment = strengthDiff * 10;

  return baseSpread + adjustment;
}

/**
 * Calculate confidence adjustment based on combined metrics
 * Considers strength, momentum, and offensive efficiency
 */
export function calculateConfidenceAdjustment(metrics: TeamMetrics): number {
  let confidence = 1.0;

  if (metrics.strength_rating) {
    confidence += (metrics.strength_rating - 0.5) * 0.2;
  }

  if (metrics.momentum_score) {
    confidence += metrics.momentum_score * 0.1;
  }

  if (metrics.offensive_rating) {
    confidence += (metrics.offensive_rating - 0.4) * 0.1;
  }

  return Math.max(0.8, Math.min(1.2, confidence));
}

/**
 * Get schedule context based on schedule_strength metric
 */
export function getScheduleContext(metrics: TeamMetrics): string {
  if (!metrics.schedule_strength) {
    return 'Unknown';
  }

  if (metrics.schedule_strength > 0.75) {
    return 'Very Tough Schedule';
  } else if (metrics.schedule_strength > 0.65) {
    return 'Tough Schedule';
  } else if (metrics.schedule_strength > 0.55) {
    return 'Medium Schedule';
  } else if (metrics.schedule_strength > 0.45) {
    return 'Favorable Schedule';
  } else {
    return 'Very Favorable Schedule';
  }
}

/**
 * Get offensive profile of a team
 */
export function getOffensiveProfile(metrics: TeamMetrics): string {
  if (!metrics.offensive_rating) {
    return 'No Data';
  }

  if (metrics.offensive_rating > 0.65) {
    return `Elite Offense (${metrics.offensive_ppg?.toFixed(1)} PPG, ${(metrics.fg_efficiency! * 100).toFixed(1)}% FG)`;
  } else if (metrics.offensive_rating > 0.55) {
    return `Strong Offense (${metrics.offensive_ppg?.toFixed(1)} PPG, ${(metrics.fg_efficiency! * 100).toFixed(1)}% FG)`;
  } else if (metrics.offensive_rating > 0.45) {
    return `Average Offense (${metrics.offensive_ppg?.toFixed(1)} PPG, ${(metrics.fg_efficiency! * 100).toFixed(1)}% FG)`;
  } else {
    return `Weak Offense (${metrics.offensive_ppg?.toFixed(1)} PPG, ${(metrics.fg_efficiency! * 100).toFixed(1)}% FG)`;
  }
}

/**
 * Compare two teams on all available metrics
 */
export function compareTeams(
  teamA: string,
  teamB: string,
  metrics: Map<string, TeamMetrics>
): {
  teamA: TeamMetrics | undefined;
  teamB: TeamMetrics | undefined;
  strengthDifference: number;
  offensiveEdge: string;
  scheduleComparison: string;
} {
  const normalizeTeamName = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  const metricA = metrics.get(normalizeTeamName(teamA));
  const metricB = metrics.get(normalizeTeamName(teamB));

  const strengthDiff = (metricA?.strength_rating || 0.5) - (metricB?.strength_rating || 0.5);
  const offenseA = metricA?.offensive_rating || 0;
  const offenseB = metricB?.offensive_rating || 0;

  let offensiveEdge = 'Even';
  if (offenseA > offenseB + 0.1) {
    offensiveEdge = `${teamA} (+${(offenseA - offenseB).toFixed(3)})`;
  } else if (offenseB > offenseA + 0.1) {
    offensiveEdge = `${teamB} (+${(offenseB - offenseA).toFixed(3)})`;
  }

  const scheduleA = getScheduleContext(metricA || {});
  const scheduleB = getScheduleContext(metricB || {});
  const scheduleComparison = `${teamA}: ${scheduleA} | ${teamB}: ${scheduleB}`;

  return {
    teamA: metricA,
    teamB: metricB,
    strengthDifference: strengthDiff,
    offensiveEdge,
    scheduleComparison,
  };
}
