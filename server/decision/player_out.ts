import { simulate_game, simulate_without_player } from "../sim/simulate";
import { computeProjectedSpread } from "../metrics/power_ratings";
import { stakePercent } from "./stake";

export interface PlayerOutAnalysisOptions {
  neutral?: boolean;
  sims?: number;
  oddsDecimal?: number;
  stakeFraction?: number;
}

export interface PlayerOutAnalysis {
  baseline_mean: number;
  new_mean: number;
  expected_line_shift: number; // new_mean - baseline_mean (teamA - teamB)
  observed_market_shift?: number; // from market (same sign convention)
  market_underreaction: boolean;
  opponent_cover_prob?: number; // probability opponent covers given current market
  recommended_action?: string;
  recommended_side?: string;
  recommended_stake_units?: number;
}

export async function analyzePlayerOut(
  teamA: any,
  player_id: string,
  teamB: any,
  marketSpread: number,
  observedMarketShift: number | undefined,
  options: PlayerOutAnalysisOptions = {}
): Promise<PlayerOutAnalysis> {
  const { neutral = false, sims = 5000, oddsDecimal = 1.91, stakeFraction = 1 } = options;

  const baseline = simulate_game(teamA, teamB, neutral, sims);
  const without = simulate_without_player(teamA, player_id, teamB, neutral, sims);

  const expected_line_shift = without.mean - baseline.mean; // negative means teamA worsened

  const market_underreaction = typeof observedMarketShift === 'number'
    ? (Math.sign(observedMarketShift) === Math.sign(expected_line_shift) && Math.abs(observedMarketShift) < Math.abs(expected_line_shift))
    : false;

  // Opponent cover prob: proportion of margins <= marketSpread (teamA margin <= marketSpread means opponent covers)
  let opponent_cover_prob: number | undefined = undefined;
  if (Array.isArray(without.samples) && without.samples.length > 0) {
    const n = without.samples.length;
    const hits = without.samples.filter(m => m <= marketSpread).length;
    opponent_cover_prob = hits / n;
  }

  const analysis: PlayerOutAnalysis = {
    baseline_mean: baseline.mean,
    new_mean: without.mean,
    expected_line_shift,
    observed_market_shift: observedMarketShift,
    market_underreaction,
    opponent_cover_prob,
  };

  // Decision rule: if market underreacted and opponent_cover_prob >= 0.55, recommend betting opponent now
  if (market_underreaction && (opponent_cover_prob ?? 0) >= 0.55) {
    analysis.recommended_action = "Bet opponent before correction";
    analysis.recommended_side = "opponent";
    const stakeFrac = stakePercent(opponent_cover_prob ?? 0, oddsDecimal, stakeFraction);
    // Use a default bankroll of 100 units unless caller supplies stake sizing externally
    analysis.recommended_stake_units = Math.round(stakeFrac * 100 * 100) / 100;
  }

  return analysis;
}

export default { analyzePlayerOut };
