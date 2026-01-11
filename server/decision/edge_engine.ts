import { computeEdge } from "../market/edge";

export function evaluateEdge(simulatedMean: number, marketLine: number) {
  const edge = computeEdge(simulatedMean, marketLine);
  const qualifies = edge > 1.0; // legacy simple qualification
  return { edge, qualifies };
}

export function evaluateSpreadEdge(projectedSpread: number | undefined, marketSpread: number | undefined) {
  if (typeof projectedSpread !== "number" || typeof marketSpread !== "number") return { spread_edge: undefined, qualifies: false };
  const spread_edge = projectedSpread - marketSpread;
  const qualifies = spread_edge >= 2.0;
  return { spread_edge, qualifies };
}

export function evaluateTotalEdge(simulatedMeanTotal: number | undefined, marketTotal: number | undefined) {
  if (typeof simulatedMeanTotal !== "number" || typeof marketTotal !== "number") return { total_edge: undefined, qualifies: false };
  const total_edge = simulatedMeanTotal - marketTotal;
  const qualifies = total_edge >= 3.5;
  return { total_edge, qualifies };
}

export function qualifiesByRules(params: {
  projectedSpread?: number;
  marketSpread?: number;
  simulatedMeanTotal?: number;
  marketTotal?: number;
}, thresholds = { spread: 2.0, total: 3.5 }) {
  const { projectedSpread, marketSpread, simulatedMeanTotal, marketTotal } = params;
  const spreadEdge = typeof projectedSpread === 'number' && typeof marketSpread === 'number' ? projectedSpread - marketSpread : undefined;
  const totalEdge = typeof simulatedMeanTotal === 'number' && typeof marketTotal === 'number' ? simulatedMeanTotal - marketTotal : undefined;

  const spreadQual = typeof spreadEdge === 'number' ? spreadEdge >= thresholds.spread : false;
  const totalQual = typeof totalEdge === 'number' ? totalEdge >= thresholds.total : false;

  const qualifies = spreadQual || totalQual;
  const reasons: string[] = [];
  if (spreadQual) reasons.push(`Spread Edge >= ${thresholds.spread}`);
  if (totalQual) reasons.push(`Total Edge >= ${thresholds.total}`);

  return { qualifies, reasons, spreadEdge, totalEdge };
}

export function evaluateCoverProbability(samples: number[] | undefined, marketSpread: number | undefined) {
  if (!Array.isArray(samples) || typeof marketSpread !== 'number') return { cover_prob: undefined, qualifies: false };
  const n = samples.length;
  if (n === 0) return { cover_prob: 0, qualifies: false };
  const hits = samples.filter(m => m > marketSpread).length;
  const cover_prob = hits / n;
  const qualifies = cover_prob >= 0.55;
  return { cover_prob, qualifies };
}

export default { evaluateEdge, evaluateSpreadEdge, evaluateTotalEdge, qualifiesByRules };
