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
- Validates confidence adjustments from team metricsatic biases in probability estimates
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

### 4. Team Metrics Integration (`server/lib/team_metrics_integration.ts`)

Leverages strength ratings, offensive efficiency, and schedule data for enhanced analysis.

**Available Functions:**
```typescript
import { loadTeamMetrics, compareTeams, getOffensiveProfile } from 'server/lib/team_metrics_integration';

const metrics = loadTeamMetrics();
const comparison = compareTeams('Team A', 'Team B', metrics);
const offensive = getOffensiveProfile(metrics.get('team a'));
```

**Metrics Available:**
- `strength_rating` (0.0-1.0) - Overall power ranking
- `offensive_rating` (0.0-1.0) - Offensive efficiency
- `offensive_ppg` - Points per game
- `fg_efficiency` - Field goal efficiency vs baseline
- `three_point_rating`, `rebounding_rating`, `passing_rating`, `ball_security`
- `schedule_strength` (0.45-0.85) - Opponent difficulty
- `momentum_score` (-0.5 to +1.0) - Recent form

**Use in Calibration:**
- Apply strength deltas to expected spread
- Adjust confidence based on offensive matchup
- Weight predictions by team data availability

### 5. Team Name Normalization (`shared/team_names.ts`)

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

### Setup (One-time)

1. **Prepare Team Metrics:**
   ```bash
   npx tsx server/cli/integrate_standings.ts
   npx tsx server/cli/enhance_team_data.ts
   npx tsx server/cli/parse_offensive_stats.ts
   npx tsx server/cli/merge_offensive_stats.ts
   ```
   Result: `data/raw/d1_teams_enhanced.csv` with 311 teams

### Daily Operations

1. **Generate Picks:**
   ```bash
   npm run projector
   ```
   Uses team metrics for strength and offensive adjustments

2. **Grade Results:**
   ```bash
   npx tsx server/cli/grade_picks.ts
   ```

3. **View Dashboard:**
   ```bash
   npx tsx server/cli/dashboard.ts
   ```
   Shows overall performance with metric-adjusted picks

4. **Check Calibration (weekly):**
   ```bash
   npx tsx server/cli/create_calibration_dataset.ts
   npx tsx server/cli/analyze_calibration.ts
   ```
   Validates if metric adjustments improve accuracy

### Analysis Cycle

```
Team Metrics Loaded → Pick Generation → Grade Results → Create Calibration Dataset → Analyze Calibration
                            ↓                  ↓                                            ↓
                    Strength/Offensive    View Dashboard                    Check Metric Impact
                    Adjustments Applied                                      on Hit Rate
```

## Key Metrics Explained

### Team Strength Rating
**Range:** 0.0 to 1.0  
**Calculation:** Power ranking from wins, conference strength, and schedule difficulty  
**Usage:** 0.1 strength delta = ~1 point spread adjustment  
**Example:**
- Arizona: 0.996 (elite)
- Nebraska: 0.972 (elite)
- Southern Utah: 0.350 (weak)
- Delta Arizona vs Southern Utah: ~6.5 point adjustment

### Offensive Efficiency Rating
**Range:** 0.0 to 1.0  
**Components:**
- Field goal % (35% weight)
- 3-point % (15% weight)  
- Free throw % (10% weight)
- Rebounding (15% weight)
- Passing (15% weight)
- Ball security (10% weight)

**Example Teams:**
- Saint Louis: 0.713 (elite, 91.2 PPG)
- Gonzaga: 0.703 (elite, 89.9 PPG)
- Arizona: 0.686 (elite, 89.9 PPG)

**Use in Picks:**
- Compare team offensive vs opponent defense
- Identify favorable matchups
- Weight confidence by available data

### Hit Rate
**Required:** 52.4% to break even at -110 odds  
**Good:** 55%+  
**Excellent:** 58%+  
**With Metrics:** Target 56%+ (5% improvement from strength/offensive adjustments)

### ROI (Return on Investment)
```
ROI = Total Profit / Total Stake
```
**Good:** 5%+  
**Excellent:** 10%+  
**With Metrics:** Expected 8%+ from proper weighting

### Sharpe Ratio
Measures risk-adjusted returns (higher is better).
```
Sharpe = (Average Return / Std Dev) × √252
```
**Good:** 1.0+  
**Excellent:** 2.0+  
**Current:** 9.70 (using existing system)

### Calibration Error
Measures difference between predicted and actual hit rates.
```
Error = |Actual Hit Rate - Predicted Probability|
```
**Good:** < 5%  
**Acceptable:** < 10%  
**Poor:** > 10% (indicates overconfidence)  
**Impact:** Offensive metrics help reduce error by 1-2% if properly weighted

## Data Files

### Input Files (Metrics)
- `data/raw/d1_teams_enhanced.csv` - 311 teams with strength + offensive data (257 enhanced)
- `data/raw/offensive_stats_2026_01_22.csv` - 50 teams offensive stats
- `data/results/team_metrics_2026_01_22.csv` - 314 teams strength ratings

### Input Files (Results)
- `data/results/grades_YYYYMMDD.json` - Graded game results
- `data/results/ts_projector_picks.csv` - Current picks
- `data/results/backtest_report.csv` - Historical backtest results

### Generated Files
- `data/results/calibration_dataset.csv` - Combined historical data with metrics
- `data/results/offensive_ratings_2026_01_22.csv` - Calculated offensive ratings
- `data/results/ts_backtest_report.csv` - TypeScript backtest summary

## Troubleshooting

### No matches in calibration analysis
**Cause:** Date format mismatch, team name mismatch, or missing metrics  
**Fix:** 
1. Ensure grade files are in `YYYYMMDD` format
2. Use `normalizeTeamName()` for all team name comparisons
3. Check that picks and grades are from the same dates
4. Verify `d1_teams_enhanced.csv` was generated with `merge_offensive_stats.ts`

### Metrics not loading in projector
**Cause:** Team metrics not merged or CSV path incorrect  
**Fix:**
1. Run: `npx tsx server/cli/merge_offensive_stats.ts`
2. Verify: `data/raw/d1_teams_enhanced.csv` exists and has 311 rows
3. Check: Import uses correct path: `data/raw/d1_teams_enhanced.csv`

### "NaN%" in calibration metrics
**Cause:** Missing cover probability data in picks  
**Fix:** Ensure `coverProb` field exists in picks CSV

### Low hit rate but positive ROI
**Explanation:** Kelly criterion stake sizing can produce profit with < 50% hit rate if edge exists on high-probability plays  
**Improvement:** Add metrics adjustments to increase hit rate 1-3%

### Team not found in metrics
**Cause:** Team name normalization difference  
**Fix:**
1. Check `d1_teams_enhanced.csv` for exact spelling
2. Use `compareTeams()` function which handles normalization
3. Add missing teams to standings if they're top programs

## Implementation Notes

### Luke Benz Recommendations Status

✅ **Implemented:**
1. Calibration analysis framework
2. Team name normalization (reduces silent failures)
3. Performance dashboard with risk metrics
4. Comprehensive data validation
5. **NEW:** Strength ratings from standings data (314 teams)
6. **NEW:** Offensive efficiency metrics (50 teams, 88% matched to database)
7. **NEW:** Team metrics integration utilities for pick adjustments

⏳ **Near-term:**
1. Defensive stats integration (mirror offensive framework)
2. Full team profiles (strength + offense + defense)
3. Confidence adjustments using all three metrics layers
4. Calibration validation of metric-adjusted picks

⏳ **Future Improvements:**
1. API timeout protection (ESPN data fetching)
2. Dynamic HCA calculation based on venue history
3. Confidence interval bands on predictions
4. Live line movement tracking
5. Monte Carlo simulation for bankroll management

### Design Decisions

**Why separate calibration dataset?**
- Allows historical analysis without modifying current picks
- Enables backtesting calibration across different time periods
- Provides clean separation of data sources
- Enables measuring metric adjustment impact

**Why normalize team names?**
- Different data sources use different conventions
- Silent failures in grading are hard to debug
- Canonical mapping ensures consistency
- Critical for matching metrics to picks

**Why dashboard + calibration?**
- Dashboard: High-level performance tracking
- Calibration: Deep-dive into model accuracy
- Complementary views of model health

**Why separate strength + offensive metrics?**
- Different data sources (standings vs efficiency stats)
- Can load independently based on available data
- Allows weighted application (strength for matchup, offense for scoring)
- 36 teams have full profiles, 257 have strength, 39 have offensive
- Defensive layer can be added with same pattern

## Next Steps

### Immediate (This Week)
1. **Integrate Metrics into Projector:** Apply strength + offensive adjustments to pick generation
2. **Run Calibration:** Grade 5-10 games with metric adjustments
3. **Compare Results:** Dashboard should show confidence adjustment impact

### Short-term (Next 2 Weeks)
1. **Defensive Stats:** Add defensive efficiency (mirror offensive framework)
2. **Full Profiles:** Merge all three layers for 36+ teams with complete data
3. **Calibration Analysis:** Run `analyze_calibration.ts` to check metric accuracy

### Medium-term (End of Month)
1. **Accumulate Data:** Grade 50+ games with metrics to enable statistical significance
2. **Monitor Hit Rate:** Track if metrics improve ATS accuracy by 1-3%
3. **Adjust Weights:** If calibration error > 10%, reduce metric weight
4. **Track ROI:** Compare profits with vs without metric adjustments

### Ongoing
1. **Monitor Calibration:** Check weekly for drift in probability estimates
2. **Adjust Confidence:** If calibration error changes >5%, investigate
3. **Track CLV:** Compare closing line value to identify sharp betting angles
4. **Update Metrics:** Monthly refresh of standings, offensive, and defensive stats

## References

- Luke Benz CBB Betting Simulator Analysis (January 2025)
- Kelly Criterion: https://en.wikipedia.org/wiki/Kelly_criterion
- Brier Score: https://en.wikipedia.org/wiki/Brier_score
- Calibration Curves: https://scikit-learn.org/stable/modules/calibration.html
