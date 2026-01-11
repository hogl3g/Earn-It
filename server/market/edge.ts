export function computeEdge(simulatedMean: number, marketLine: number): number {
  return simulatedMean - marketLine;
}

export function computeEdgeFromSamples(samples: number[], marketLine: number) {
  const n = samples.length;
  const mean = n === 0 ? 0 : samples.reduce((s, v) => s + v, 0) / n;
  const edge = computeEdge(mean, marketLine);
  return { mean, edge };
}

export function computeSpreadEdge(projectedSpread: number, marketSpread: number): number {
  return projectedSpread - marketSpread;
}


