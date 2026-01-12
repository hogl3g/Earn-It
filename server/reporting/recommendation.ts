import type { MatchupReport } from "../sim/report";
import { qualifiesByRules } from "../decision/edge_engine";

function clamp01(x: number) {
  if (!isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function computeConfidenceScore(report: MatchupReport) {
  // Edge Weight: normalize absolute spread edge (or fallback to edge) to 0..1 using 5 points as 100%
  const rawEdge = Math.abs((report.spread_edge ?? report.edge ?? 0));
  const edgeWeight = clamp01(rawEdge / 5);

  // Simulation Confidence: use cover probability if available (0..1), otherwise derive from win prob distance from 0.5
  const simCover = typeof report.simulated_cover_prob === "number" ? report.simulated_cover_prob : undefined;
  const simWin = typeof report.simulated_win_prob?.teamA === "string" ? parseFloat(report.simulated_win_prob.teamA) / 100 : undefined;
  const simConfidence = simCover ?? (typeof simWin === "number" ? Math.abs(simWin - 0.5) * 2 : 0.5);
  const simConfNorm = clamp01(simConfidence);

  // Market Alignment: higher when model and market are close; normalized 0..1 where 1 means exact alignment
  const spreadEdge = typeof report.spread_edge === "number" ? Math.abs(report.spread_edge) : undefined;
  const marketAlignment = spreadEdge === undefined ? 0.5 : clamp01(1 - (spreadEdge / 10));

  // Injury Certainty: placeholder (1 = no uncertainty). If later data exists, plug it here.
  const injuryCertainty = 1;

  // Confidence Score composition
  const score = (edgeWeight * 0.4) + (simConfNorm * 0.3) + (marketAlignment * 0.2) + (injuryCertainty * 0.1);
  return clamp01(score);
}

export function generateRecommendation(report: MatchupReport) {
  const ruleResult = qualifiesByRules({
    projectedSpread: report.model_spread,
    marketSpread: report.market_spread,
    simulatedMeanTotal: report.simulated_mean_total,
    marketTotal: report.market_total,
  });

  const coverProb = report.simulated_cover_prob ?? undefined;
  const coverQual = typeof coverProb === "number" ? coverProb >= 0.80 : false;

  const qualifies = ruleResult.qualifies || coverQual;

  const reasons = [...(ruleResult.reasons || [])];
  if (coverQual) reasons.push(`Cover Probability >= 80% (${Math.round((coverProb ?? 0) * 100)}%)`);

  const confidenceScore = computeConfidenceScore(report);

  function mapConfidenceToUnits(conf: number): number | undefined {
    // conf is 0..1
    const p = Math.round(conf * 100);
    if (p >= 90) return 1.5;
    if (p >= 85) return 1.25;
    if (p >= 80) return 1.0;
    if (p >= 75) return 0.75;
    return undefined;
  }
  const units = mapConfidenceToUnits(confidenceScore);

  return {
    recommended: qualifies,
    reasons,
    side: report.model_spread > (report.market_spread ?? -999) ? report.matchup.split(" vs ")[0] : report.matchup.split(" vs ")[1],
    edge: report.edge,
    spread_edge: report.spread_edge,
    cover_prob: typeof coverProb === "number" ? Number((coverProb * 100).toFixed(1)) + "%" : undefined,
    confidence_score: Number((confidenceScore * 100).toFixed(0)) + "%",
    units,
  };
}

export default { generateRecommendation, computeConfidenceScore };
