/**
 * Example: Integrating Team Metrics into Projector Picks
 *
 * Shows how to apply strength ratings and offensive efficiency
 * to adjust spreads and confidence for betting picks.
 *
 * Run this to see metric application in action:
 * npx tsx server/cli/metrics_integration_example.ts
 */

import { loadTeamMetrics, compareTeams, calculateStrengthAdjustment, calculateConfidenceAdjustment, getOffensiveProfile } from '../lib/team_metrics_integration';

interface Pick {
  matchup: string;
  teamA: string;
  teamB: string;
  modelSpread: number;
  modelConfidence: number;
}

function applyMetricsToPickExample() {
  console.log('🎯 TEAM METRICS INTEGRATION EXAMPLE\n');
  console.log('='.repeat(80));

  // Load all team metrics
  const metrics = loadTeamMetrics();
  console.log(`\n✅ Loaded metrics for ${metrics.size} teams\n`);

  // Example picks to enhance
  const picks: Pick[] = [
    {
      matchup: 'Gonzaga vs Arizona',
      teamA: 'Gonzaga',
      teamB: 'Arizona',
      modelSpread: 3.5,
      modelConfidence: 0.72,
    },
    {
      matchup: 'Saint Louis vs Virginia',
      teamA: 'Saint Louis',
      teamB: 'Virginia',
      modelSpread: -2.0,
      modelConfidence: 0.68,
    },
    {
      matchup: 'Michigan vs Tennessee',
      teamA: 'Michigan',
      teamB: 'Tennessee',
      modelSpread: 5.0,
      modelConfidence: 0.75,
    },
  ];

  console.log('📊 PICK ANALYSIS WITH METRICS:\n');
  console.log('='.repeat(80));

  picks.forEach((pick, index) => {
    console.log(`\n${index + 1}. ${pick.matchup.toUpperCase()}\n`);

    // Get full comparison
    const comparison = compareTeams(pick.teamA, pick.teamB, metrics);

    // Display team profiles
    if (comparison.teamA) {
      console.log(`  ${pick.teamA}:`);
      console.log(`    • Strength: ${(comparison.teamA.strength_rating || 0).toFixed(3)}`);
      console.log(`    • ${getOffensiveProfile(comparison.teamA)}`);
      console.log(`    • Schedule: ${comparison.teamA.schedule_strength ? ((comparison.teamA.schedule_strength * 100).toFixed(0) + '%') : 'N/A'}`);
      console.log(`    • Momentum: ${comparison.teamA.momentum_score ? ((comparison.teamA.momentum_score * 100).toFixed(0) + '%') : 'N/A'}\n`);
    }

    if (comparison.teamB) {
      console.log(`  ${pick.teamB}:`);
      console.log(`    • Strength: ${(comparison.teamB.strength_rating || 0).toFixed(3)}`);
      console.log(`    • ${getOffensiveProfile(comparison.teamB)}`);
      console.log(`    • Schedule: ${comparison.teamB.schedule_strength ? ((comparison.teamB.schedule_strength * 100).toFixed(0) + '%') : 'N/A'}`);
      console.log(`    • Momentum: ${comparison.teamB.momentum_score ? ((comparison.teamB.momentum_score * 100).toFixed(0) + '%') : 'N/A'}\n`);
    }

    // Calculate metric adjustments
    const strengthAdj = calculateStrengthAdjustment(
      pick.teamA,
      pick.teamB,
      pick.modelSpread,
      metrics
    );

    const confidenceAdjA = comparison.teamA ? calculateConfidenceAdjustment(comparison.teamA) : 1.0;
    const confidenceAdjB = comparison.teamB ? calculateConfidenceAdjustment(comparison.teamB) : 1.0;

    // Apply adjustments
    const adjustedSpread = pick.modelSpread + (strengthAdj - pick.modelSpread) * 0.5; // 50% weight to metrics
    const adjustedConfidence = pick.modelConfidence * (confidenceAdjA / confidenceAdjB);

    // Display results
    console.log(`  📈 ADJUSTMENTS:`);
    console.log(`    Original Spread:     ${pick.modelSpread > 0 ? '+' : ''}${pick.modelSpread.toFixed(1)}`);
    console.log(`    Strength Delta:      ${comparison.strengthDifference > 0 ? '+' : ''}${comparison.strengthDifference.toFixed(3)}`);
    console.log(`    Adjusted Spread:     ${adjustedSpread > 0 ? '+' : ''}${adjustedSpread.toFixed(1)}`);
    console.log(`    Original Confidence: ${(pick.modelConfidence * 100).toFixed(1)}%`);
    console.log(`    Adjusted Confidence: ${(adjustedConfidence * 100).toFixed(1)}%`);
    console.log(`    Offensive Edge:      ${comparison.offensiveEdge}`);
    console.log(`\n  🎲 FINAL PICK:`);
    console.log(`    ${pick.teamA} ${adjustedSpread > 0 ? '+' : ''}${Math.abs(adjustedSpread).toFixed(1)} @ ${(adjustedConfidence * 100).toFixed(0)}%\n`);
  });

  // Summary statistics
  console.log('='.repeat(80));
  console.log('\n📊 METRIC COVERAGE SUMMARY:\n');

  const withStrength = Array.from(metrics.values()).filter((t) => t.strength_rating).length;
  const withOffensive = Array.from(metrics.values()).filter((t) => t.offensive_rating).length;
  const withBoth = Array.from(metrics.values()).filter((t) => t.strength_rating && t.offensive_rating).length;

  console.log(`Total teams in database:       ${metrics.size}`);
  console.log(`Teams with strength metrics:  ${withStrength} (${((withStrength / metrics.size) * 100).toFixed(1)}%)`);
  console.log(`Teams with offensive metrics: ${withOffensive} (${((withOffensive / metrics.size) * 100).toFixed(1)}%)`);
  console.log(`Teams with both metrics:      ${withBoth} (${((withBoth / metrics.size) * 100).toFixed(1)}%)`);

  console.log('\n✅ Integration example complete!\n');

  // Implementation notes
  console.log('💡 IMPLEMENTATION TIPS:\n');
  console.log('1. In sports app 1.ts pick generation loop:');
  console.log('   const metrics = loadTeamMetrics();\n');
  console.log('2. For each matchup:');
  console.log('   const comparison = compareTeams(teamA, teamB, metrics);\n');
  console.log('3. Apply adjustments with weights:');
  console.log('   const strengthAdj = calculateStrengthAdjustment(teamA, teamB, spread, metrics);');
  console.log('   adjustedSpread = spread + (strengthAdj - spread) * 0.5;  // 50% weight\n');
  console.log('4. Adjust confidence:');
  console.log('   const confAdj = calculateConfidenceAdjustment(metrics.get(teamA));');
  console.log('   adjustedConfidence = baseConfidence * confAdj;\n');
  console.log('5. Log the improvements:');
  console.log('   Dashboard will track if metrics improve hit rate by 1-3%\n');
}

applyMetricsToPickExample();
