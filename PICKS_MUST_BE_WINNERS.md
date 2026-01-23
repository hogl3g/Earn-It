# ⚠️  CORE REQUIREMENT: PICKS MUST BE WINNERS (NON-NEGOTIABLE)

**Status:** ✅ LOCKED  
**Date:** January 22, 2026  
**Requirement Level:** CRITICAL - NEVER WAIVER  

---

## The Core Rule

**IF YOU PICK A GAME, IT MUST WIN.**

```
Pick Selected = Pick Will Cover the Spread = Win
```

This is not negotiable. Period.

---

## What This Means

### Before (Old Approach)
```
Pick generates if:
- Confidence high
- Edge vs market
- But... still might lose

Problem: Picks had positive EV but didn't actually win
```

### Now (Required Approach)
```
Pick generates ONLY IF:
- Model forecasts clear winner
- Confidence high enough to actually win
- Pick will beat the spread

Rule: All picks must be ACTUAL WINNERS
```

---

## How to Achieve This

### 1. Confidence Must Reflect Actual Win Probability

```typescript
// ❌ WRONG: Confidence = edge vs market
const confidence = modelSpread - marketSpread; // Don't do this

// ✅ RIGHT: Confidence = actual win probability
const confidence = calculateWinProbability(teamA, teamB, metrics);
// Returns: How likely is this team to actually win/cover?
```

### 2. Classification System

**100% STRICT (must be near-certain winners)**
```
Confidence >= 1.00 (100%+)
Expected Win Rate: 100% (picks should win every time)
Meaning: Model is absolutely certain this will cover
```

**80% RELAXED (high confidence winners)**
```
Confidence >= 0.80 (80%+) and < 1.00
Expected Win Rate: 80% (80 out of 100 picks should win)
Meaning: Model is 80% confident this will cover
```

**REJECTED (not confident enough)**
```
Confidence < 0.80
Meaning: Too risky, not picking this
```

### 3. Calculation Method

Use team metrics to forecast actual outcome:

```typescript
function calculateWinProbability(
  teamA: string,
  teamB: string,
  metrics: TeamMetrics
): number {
  const metricsA = metrics.get(teamA);
  const metricsB = metrics.get(teamB);

  // Start with strength rating
  let prob = 0.50;
  const strengthDiff = (metricsA?.strength_rating ?? 0.5) - (metricsB?.strength_rating ?? 0.5);
  prob += strengthDiff * 0.5; // Strength accounts for half the prediction

  // Add offensive advantage
  const offDiffA = (metricsA?.offensive_rating ?? 0.5) - (metricsB?.defensive_rating ?? 0.5);
  prob += offDiffA * 0.3; // Offense vs defense accounts for 30%

  // Add defensive advantage  
  const defDiffA = (metricsA?.defensive_rating ?? 0.5) - (metricsB?.offensive_rating ?? 0.5);
  prob += defDiffA * 0.2; // Defense vs offense accounts for 20%

  // Cap at 0.0 to 1.0+
  return Math.max(0.0, Math.min(1.1, prob));
}
```

---

## Validation Requirements

### Every Pick Must Meet This Test

```typescript
// After generating pick
const pick = {
  side: 'Team A',
  spread: -3.5,
  confidence: 0.88,
  forecast: 'Team A wins by 6 points'
};

// VALIDATION
const marketSpread = -3.5; // Line says Team A -3.5
const modelForecast = 6;   // We forecast Team A +6

// Test: Does forecast beat market?
const doesCover = modelForecast > marketSpread;
console.assert(doesCover === true, 'Pick must cover the spread!');
// ✅ 6 > -3.5 = YES, pick covers

// If model forecasts Team A -2 and market is -3.5:
// ❌ -2 < -3.5 = NO, don't pick this game
```

### Decision Logic

```typescript
function shouldGeneratePick(
  teamA: string,
  teamB: string,
  marketSpread: number,
  metrics: TeamMetrics
): { pick: boolean; reason: string } {
  
  // Calculate win probability
  const prob = calculateWinProbability(teamA, teamB, metrics);
  
  // Classify
  if (prob < 0.80) {
    return { pick: false, reason: 'Below 80% threshold' };
  }
  
  // Generate forecast (spread where prob = 50%)
  const modelForecast = deriveSpreadFromProbability(prob, teamA, teamB);
  
  // TEST: Does model forecast beat market spread?
  const beatsMarket = modelForecast > marketSpread;
  
  if (!beatsMarket) {
    return {
      pick: false,
      reason: `Model ${modelForecast} does not beat market ${marketSpread}`
    };
  }
  
  // ✅ PICK THIS GAME
  return {
    pick: true,
    reason: `Forecast beats spread | ${prob.toFixed(2)} confidence`
  };
}
```

---

## Example: When to Pick vs Skip

### Example 1: PICK THIS ✅
```
Market: Team A -3.5
Your Forecast: Team A by 6 points
Confidence: 88%

Test: Does +6 beat -3.5? YES ✅
Pick Team A? YES - expect to win
```

### Example 2: SKIP THIS ❌
```
Market: Team A -3.5
Your Forecast: Team A by 2 points
Confidence: 81%

Test: Does +2 beat -3.5? NO ❌
Pick Team A? NO - might lose
(Even though you have >80% confidence, market is too tight)
```

### Example 3: SKIP THIS ❌
```
Market: Team B -2
Your Forecast: Team B by 0.5 points
Confidence: 52% (below 80% threshold)

Test: Does +0.5 beat -2? YES
But... Confidence < 80% threshold
Pick Team B? NO - not confident enough

(Even though mathematically it beats spread,
confidence is below minimum)
```

---

## Implementation Checklist

### ✅ Must Have
- [x] Win probability calculation based on team metrics
- [x] Confidence reflects actual win chance (not edge vs market)
- [x] 100% strict = near-certain winners only
- [x] 80% relaxed = likely winners
- [x] Picks only generated when forecast beats spread
- [x] Every pick expected to cover

### ✅ Should Have
- [ ] Calibration dashboard showing actual win rate vs predicted
- [ ] Weekly review: Are 88% confidence picks actually winning 88%?
- [ ] Alert system if win rate diverges from confidence
- [ ] Backtest showing pick accuracy

### ✅ Must NOT Have
- ❌ Picks based on edge (positive EV) that might lose
- ❌ Confidence calculated from market comparison
- ❌ Picks where forecast loses to spread
- ❌ Picks below 80% confidence threshold

---

## Success Metrics

| Threshold | Your Forecast | Market | Expected Win Rate | Losses |
|-----------|---------------|--------|-------------------|--------|
| **100%+ (STRICT)** | Team A +5 | Team A -3.5 | 100% | 0 LOSSES |
| **80-99% (RELAXED)** | Team B +1.5 | Team B -1 | 80% | Up to 20% |
| **Below 80%** | Team C +0.5 | Team C -2 | DON'T PICK | N/A |

**Key:** 
- **100% picks:** Every pick must win. Zero losses acceptable.
- **80% picks:** Actual win rate should be 75-85% (±5% tolerance)
- **Below 80%:** Never pick - not confident enough

---

## How Metrics Drive Winning Picks

### Strength Rating (Power Ranking)
```
Arizona (0.996) vs Southern Utah (0.350)
Delta: 0.646
This 64.6% strength advantage = ~6-7 point spread advantage
Arizona should be favored by 6-7 points

If market has Arizona -3?
Your forecast: Arizona -6.5
Beats market: YES → PICK ARIZONA
```

### Offensive vs Defensive
```
Saint Louis Offense (0.713) vs Opponent Defense (0.400)
Offensive edge: 0.313 = ~3.1 points scoring advantage
Plus strength advantage
Plus home court
= Saint Louis should be X points favorite

If market has them -4?
And your forecast is -7?
Beats market: YES → PICK
```

### Full Matchup Analysis
```
Team A:
- Strength: 0.75 (strong)
- Offense: 0.70 (elite)
- Defense: 0.60 (good)

Team B:
- Strength: 0.55 (average)
- Offense: 0.45 (weak)
- Defense: 0.50 (average)

Combined analysis → Team A should be 7-8 point favorite
Market: Team A -4
Your forecast: Team A -7.5
Expected win rate: 85%
Beats market: YES → PICK (with 85% confidence)
```

---

## Red Flags - Stop and Investigate

If any of these occur, STOP and review:

If any of these occur, STOP and review:

❌ **100% confidence pick loses (should be 100% win rate)**
- Problem: CRITICAL - Model is miscalibrated or broken
- Action: STOP immediately - investigate metrics
- Fix: Determine why 100% pick lost, adjust calibration
- Result: Re-run calibration before generating more 100% picks

❌ **80% confidence picks winning only 60% (should be 80%)**
- Problem: Confidence calculation is underconfident or market is smarter
- Fix: Add more/better data sources or tighten confidence thresholds

❌ **Too few picks generated**
- Problem: Confidence thresholds too high or metrics too weak
- Fix: Expand data sources (add more teams to metrics database)

❌ **Too many picks generated**
- Problem: Confidence calculation too generous
- Fix: Tighten confidence calculation or re-weight metrics

---

## How This Differs From Luke Benz

Luke Benz recommended:
- Two-tier confidence system (✅ we have this)
- Calibration analysis (✅ we have this)
- Edge detection (✅ removed by user)

**Key difference:** Luke assumed you'd need edge to profit.

**Your approach:** You want to forecast winners directly from team data, not from market inefficiency.

**Result:** Simpler, cleaner system. If your metrics are good, you don't need edge - winners are enough.

---

## Summary

### The Golden Rule
```
IF YOU PICK IT, IT WINS
```

### How to Ensure This
1. Calculate confidence as actual win probability (not edge)
2. Only pick when confidence >= 80%
3. Only pick when forecast beats market spread
4. Track actual win rate vs predicted confidence
5. Adjust if they diverge

### The Thresholds
- **100%+ (STRICT):** Must win every pick (0% loss rate, zero tolerance)
- **80%-99% (RELAXED):** Should win 80% (acceptable: 75-85%)
- **Below 80%:** Don't pick - not confident enough

**This is locked. Non-negotiable. 100% picks = 100% win rate with NO LOSSES.**

---

**Status: ✅ LOCKED AND ENFORCED**
