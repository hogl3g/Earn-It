export function kellyFraction(pWin: number, oddsDecimal: number) {
  // Kelly fraction for binary bet with decimal payout: f* = (bp - q) / b
  // where b = odds - 1, p = pWin, q = 1 - p
  const b = Math.max(0, oddsDecimal - 1);
  const p = pWin;
  const q = 1 - p;
  if (b <= 0) return 0;
  const f = (b * p - q) / b;
  return Math.max(0, f);
}

export function fractionalStake(baseBankroll: number, fraction: number) {
  return Math.max(0, baseBankroll * fraction);
}

export default { kellyFraction, fractionalStake };

/**
 * Stake percentage based on fractional Kelly-style formula provided by user:
 * Stake% = Fraction × ((p × odds – (1 – p)) / odds)
 * - p: probability of win (0-1)
 * - oddsDecimal: decimal odds (e.g., 2.5)
 * - fraction: fraction of recommended stake to apply (0-1)
 * Returns a decimal fraction of bankroll to stake (not percentage).
 */
export function stakePercent(p: number, oddsDecimal: number, fraction = 1): number {
  if (!isFinite(p) || !isFinite(oddsDecimal) || oddsDecimal <= 0) return 0;
  const numerator = p * oddsDecimal - (1 - p);
  const result = fraction * (numerator / oddsDecimal);
  return Math.max(0, result);
}

export { kellyFraction, fractionalStake };

/**
 * Kelly as provided: (p × odds – (1 – p)) / odds
 * Note: This matches the user's requested formula (may differ from classical Kelly).
 */
export function kellyUser(p: number, oddsDecimal: number): number {
  if (!isFinite(p) || !isFinite(oddsDecimal) || oddsDecimal <= 0) return 0;
  const k = (p * oddsDecimal - (1 - p)) / oddsDecimal;
  return Math.max(0, k);
}

/**
 * Stake = Bankroll × Kelly × Fraction
 * - bankroll: available bankroll in units
 * - p: win probability (0..1)
 * - oddsDecimal: decimal odds
 * - fraction: fraction of Kelly to apply (0..1)
 */
export function stakeFromKelly(bankroll: number, p: number, oddsDecimal: number, fraction = 1): number {
  const k = kellyUser(p, oddsDecimal);
  const adj = Math.max(0, Math.min(1, fraction));
  return Math.max(0, bankroll * k * adj);
}

export { kellyFraction, fractionalStake };

export default { kellyFraction, fractionalStake, stakePercent, kellyUser, stakeFromKelly };
