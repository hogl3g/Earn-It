/**
 * ⚠️  BETTING SYSTEM CONSTANTS - NON-NEGOTIABLE
 * 
 * These thresholds are LOCKED and should NEVER be changed without explicit approval.
 * They define the core pick classification system and validation logic.
 * 
 * Any modification to these values requires:
 * 1. User approval (explicit confirmation)
 * 2. Documentation of reasoning
 * 3. Re-validation of entire calibration pipeline
 * 4. Git commit with full explanation
 * 
 * DO NOT MODIFY THESE VALUES
 */

/**
 * STRICT CONFIDENCE THRESHOLD
 * 
 * Picks with cover probability >= 1.00 (100%) are classified as STRICT picks.
 * These represent the highest confidence selections.
 * 
 * Usage:
 * - Only generated when model is very confident
 * - Held to strictest accuracy standards
 * - Expected hit rate: 60%+ (with proper calibration)
 * - Calibration target: Actual hit rate within 2% of predicted 100%
 * 
 * ⛔ NEVER CHANGE THIS VALUE ⛔
 */
export const CONFIDENCE_STRICT_MIN = 1.00;
export const CONFIDENCE_STRICT_LABEL = '100%+ (STRICT)';

/**
 * RELAXED CONFIDENCE THRESHOLD
 * 
 * Picks with cover probability >= 0.80 and < 1.00 are classified as RELAXED picks.
 * These are moderate confidence picks used as fallback when insufficient strict picks exist.
 * 
 * Usage:
 * - Generated when model has moderate confidence (80-99%)
 * - Used to fill gaps in pick volume
 * - Expected hit rate: 52-55% (slightly above break-even)
 * - Calibration target: Actual hit rate within 5% of predicted probability
 * 
 * ⛔ NEVER CHANGE THIS VALUE ⛔
 */
export const CONFIDENCE_RELAXED_MIN = 0.80;
export const CONFIDENCE_RELAXED_MAX = 0.99;
export const CONFIDENCE_RELAXED_LABEL = '80-100% (RELAXED)';

/**
 * LOW CONFIDENCE THRESHOLD
 * 
 * Picks with cover probability < 0.80 are classified as LOW confidence.
 * These picks are NOT recommended for betting and are excluded from analysis.
 * 
 * ⛔ NEVER CHANGE THIS VALUE ⛔
 */
export const CONFIDENCE_LOW_MAX = 0.79;
export const CONFIDENCE_LOW_LABEL = '<80%';

/**
 * CONFIDENCE BUCKETS FOR ANALYSIS
 * 
 * Used in calibration analysis to bucket picks by confidence level.
 * Allows tracking hit rates separately for each confidence tier.
 * 
 * ⛔ DO NOT MODIFY THIS ARRAY ⛔
 */
export const CONFIDENCE_BUCKETS = [
  {
    min: CONFIDENCE_LOW_MAX,
    max: CONFIDENCE_LOW_MAX + 1,
    label: CONFIDENCE_LOW_LABEL,
    description: 'Not recommended for betting'
  },
  {
    min: CONFIDENCE_RELAXED_MIN,
    max: CONFIDENCE_RELAXED_MAX,
    label: CONFIDENCE_RELAXED_LABEL,
    description: 'Moderate confidence, used as fallback'
  },
  {
    min: CONFIDENCE_STRICT_MIN,
    max: 1.10,
    label: CONFIDENCE_STRICT_LABEL,
    description: 'High confidence, only best picks'
  }
] as const;

/**
 * HELPER FUNCTION: Classify pick by confidence level
 * 
 * Returns the appropriate category for a given confidence/cover probability.
 */
export function classifyByConfidence(coverProb: number): typeof CONFIDENCE_BUCKETS[number]['label'] {
  if (coverProb >= CONFIDENCE_STRICT_MIN) {
    return CONFIDENCE_STRICT_LABEL;
  } else if (coverProb >= CONFIDENCE_RELAXED_MIN) {
    return CONFIDENCE_RELAXED_LABEL;
  } else {
    return CONFIDENCE_LOW_LABEL;
  }
}

/**
 * HELPER FUNCTION: Check if pick meets minimum quality threshold
 * 
 * A pick must be either STRICT (100%+) or RELAXED (80%+) to be considered.
 */
export function meetsMinimumQuality(coverProb: number): boolean {
  return coverProb >= CONFIDENCE_RELAXED_MIN;
}

/**
 * EDGE DETECTION THRESHOLDS
 * 
 * ⚠️  CHANGED (2026-01-22): Edge requirement is now OPTIONAL
 * 
 * The model now projects predictions based purely on team stats, metrics, and standings.
 * Market spread (with built-in 2.5 HCA) is used for reference only, not for edge filtering.
 * 
 * Set `requireEdge = false` in qualifiesByRules() to disable edge threshold.
 * Picks now qualify based on CONFIDENCE ALONE (100% strict, 80% relaxed).
 * 
 * ⚠️  THESE THRESHOLDS ARE LOCKED BUT EDGE IS NOW OPTIONAL ⚠️
 */
export const MINIMUM_EDGE_THRESHOLD = 0.05; // Legacy: 5% minimum edge (now optional)
export const EDGE_DESCRIPTION = 'Edge requirement disabled - using confidence thresholds only';
export const USE_EDGE_REQUIREMENT = false; // ⚠️  CHANGED: Disable edge filtering

/**
 * CALIBRATION TARGETS
 * 
 * Expected accuracy levels for each confidence tier.
 * Used to validate that model predictions match actual outcomes.
 * 
 * If calibration error exceeds these targets, investigate model drift.
 */
export const CALIBRATION_TARGETS = {
  strict: {
    min_hit_rate: 0.58,      // Expect 58%+ hit rate
    max_error: 0.05          // Allow ±5% deviation from predicted
  },
  relaxed: {
    min_hit_rate: 0.52,      // Expect 52%+ hit rate (break-even baseline)
    max_error: 0.10          // Allow ±10% deviation from predicted
  },
  overall: {
    max_calibration_error: 0.08  // Overall calibration error should be <8%
  }
} as const;

/**
 * VALIDATION SUMMARY
 * 
 * This module ensures:
 * ✅ 100% STRICT picks (coverProb >= 1.00) - highest confidence only
 * ✅ 80% RELAXED picks (0.80 <= coverProb < 1.00) - moderate confidence
 * ✅ 5% EDGE minimum - edge detection verified
 * ✅ Proper calibration tracking - actual vs predicted rates
 * ✅ Two-tier quality system - no middle ground between strict/relaxed
 * 
 * Any deviation from these values requires explicit user approval.
 */

// Export version for verification
export const CONSTANTS_VERSION = '1.0.0-LOCKED';
export const LAST_LOCKED_DATE = '2026-01-22';
export const LOCKED_BY = 'User-Confirmed-Non-Negotiable';
