# Projector Analysis Tools

Post-Luke Benz analysis improvements and new diagnostic tools for the Earn-It betting projector.

## Tools Overview

### 1. Performance Dashboard (`server/cli/dashboard.ts`)

Comprehensive performance summary with key metrics:
```bash
npx tsx server/cli/dashboard.ts
```

**Shows:**
- Overall statistics (win rate, ROI, profit/loss)
- Risk metrics (Sharpe ratio, daily volatility)
- Daily breakdown of performance
- Status indicator (Profitable/Marginal/Losing)

**Example Output:**
```
╔════════════════════════════════════════════════════════════════╗
║           📊 PROJECTOR PERFORMANCE DASHBOARD               ║
╚════════════════════════════════════════════════════════════════╝

OVERALL PERFORMANCE
Total Picks        : 110
Record             : 46-64 (41.8%)
Total Profit       : +$4134.10
ROI                : 24.7%
Avg Profit/Pick    : +$37.58

RISK METRICS
Daily Avg ROI      : +$826.82
Daily Std Dev      : +$1352.98
Sharpe Ratio       : 9.70
Status             : ❌ LOSING
```

### 2. Calibration Analysis (`server/cli/analyze_calibration.ts`)

Validates probability estimates against actual outcomes to detect overconfidence.

```bash
npx tsx server/cli/analyze_calibration.ts
```

**Purpose:**
- Measures if 100% strict and 80% relaxed picks actually hit at their predicted rates
- Identifies systematic biases in probability estimates
- Provides calibration curve analysis

**Requires:** `calibration_dataset.csv` (run create_calibration_dataset first)

**Example Output:**
```
CALIBRATION ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average Calibration Error: 8.2%
✓ GOOD: Probabilities are well-calibrated

DAILY METRICS
2026-01-11 | 11/20 (55.0%) | ROI: +$1181 | Avg CP: 72% | Avg EV: 0.250
```

### 3. Calibration Dataset Generator (`server/cli/create_calibration_dataset.ts`)

Creates a unified CSV dataset combining grade files with probability estimates.

```bash
npx tsx server/cli/create_calibration_dataset.ts
```

**Generates:** `data/results/calibration_dataset.csv`

**Contains:**
- Game outcomes (scores, margins, results)
- Model predictions (spread, cover probability)
- Actual performance (covered, won, profit)

### 4. Team Name Normalization (`shared/team_names.ts`)

Canonical team name mapping to prevent silent matching failures.

**Import:**
```typescript
import { normalizeTeamName } from '../shared/team_names.js';

const canonical = normalizeTeamName('Ball St.'); // → 'Ball State'
const canonical2 = normalizeTeamName('Saint Francis'); // → 'Saint Francis'
```

**Handles:**
- Common abbreviations ("St." → "State", "Saint" variations)
- School-specific names ("Miami (FL)", "Miami (OH)")
- Acronyms ("USC", "TCU", "UAB")

**Prevents errors like:**
- "Ball St." failing to match "Ball State"
- "St. Francis" not matching "Saint Francis"
- Silent grading failures due to name mismatches

## Workflow

### Daily Operations

1. **Generate Picks:**
   ```bash
   npm run projector
   ```

2. **Grade Results:**
   ```bash
   npx tsx server/cli/grade_picks.ts
   ```

3. **View Dashboard:**
   ```bash
   npx tsx server/cli/dashboard.ts
   ```

4. **Check Calibration (weekly):**
   ```bash
   npx tsx server/cli/create_calibration_dataset.ts
   npx tsx server/cli/analyze_calibration.ts
   ```

### Analysis Cycle

```
Pick Generation → Grade Results → Create Calibration Dataset → Analyze Calibration
                         ↓                                              ↓
                  View Dashboard                            Check for Overconfidence
```

## Key Metrics Explained

### Hit Rate
**Required:** 52.4% to break even at -110 odds  
**Good:** 55%+  
**Excellent:** 58%+

### ROI (Return on Investment)
```
ROI = Total Profit / Total Stake
```
**Good:** 5%+  
**Excellent:** 10%+

### Sharpe Ratio
Measures risk-adjusted returns (higher is better).
```
Sharpe = (Average Return / Std Dev) × √252
```
**Good:** 1.0+  
**Excellent:** 2.0+

### Calibration Error
Measures difference between predicted and actual hit rates.
```
Error = |Actual Hit Rate - Predicted Probability|
```
**Good:** < 5%  
**Acceptable:** < 10%  
**Poor:** > 10% (indicates overconfidence)

## Data Files

### Input Files
- `data/results/grades_YYYYMMDD.json` - Graded game results
- `data/results/ts_projector_picks.csv` - Current picks
- `data/results/backtest_report.csv` - Historical backtest results

### Generated Files
- `data/results/calibration_dataset.csv` - Combined historical data
- `data/results/ts_backtest_report.csv` - TypeScript backtest summary

## Troubleshooting

### No matches in calibration analysis
**Cause:** Date format mismatch or team name mismatch  
**Fix:** 
1. Ensure grade files are in `YYYYMMDD` format
2. Use `normalizeTeamName()` for all team name comparisons
3. Check that picks and grades are from the same dates

### "NaN%" in calibration metrics
**Cause:** Missing cover probability data in picks  
**Fix:** Ensure `coverProb` field exists in picks CSV

### Low hit rate but positive ROI
**Explanation:** Kelly criterion stake sizing can produce profit with < 50% hit rate if edge exists on high-probability plays

## Implementation Notes

### Luke Benz Recommendations Status

✅ **Implemented:**
1. Calibration analysis framework
2. Team name normalization (reduces silent failures)
3. Performance dashboard with risk metrics
4. Comprehensive data validation

⏳ **Future Improvements:**
1. API timeout protection (ESPN data fetching)
2. Dynamic HCA calculation based on venue history
3. Confidence interval bands on predictions
4. Historical strength of schedule adjustments
5. Live line movement tracking
6. Monte Carlo simulation for bankroll management

### Design Decisions

**Why separate calibration dataset?**
- Allows historical analysis without modifying current picks
- Enables backtesting calibration across different time periods
- Provides clean separation of data sources

**Why normalize team names?**
- Different data sources use different conventions
- Silent failures in grading are hard to debug
- Canonical mapping ensures consistency

**Why dashboard + calibration?**
- Dashboard: High-level performance tracking
- Calibration: Deep-dive into model accuracy
- Complementary views of model health

## Next Steps

1. **Accumulate Data:** Run system for 50+ graded games to enable statistical significance
2. **Monitor Calibration:** Check weekly for drift in probability estimates
3. **Adjust Confidence:** If calibration error > 10%, recalibrate probability model
4. **Track CLV:** Compare closing line value to identify sharp betting angles

## References

- Luke Benz CBB Betting Simulator Analysis (January 2025)
- Kelly Criterion: https://en.wikipedia.org/wiki/Kelly_criterion
- Brier Score: https://en.wikipedia.org/wiki/Brier_score
- Calibration Curves: https://scikit-learn.org/stable/modules/calibration.html
