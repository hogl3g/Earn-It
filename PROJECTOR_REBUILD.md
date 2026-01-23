# PROJECTOR REBUILD - STATS-ONLY SYSTEM

## Date: January 22, 2026

**BREAKING CHANGE:** Entire projector system rebuilt from scratch to be purely stats-based.

## What Changed

### OLD SYSTEM (Broken)
```
Market Spread (-17.15) → Calculate Model Spread (+2.5) → Compare for Edge (36%)
→ Use edge to fabricate coverProb (88.8%) → Market-dependent
```

**Problem:** System was backward. Market spread used to calculate everything.

### NEW SYSTEM (Fixed)
```
Team Stats/Ratings → Calculate Rating Delta → Convert to Win Probability (0-100%)
→ Pick team if >= 80% confidence → Moneyline = sanity check only
```

**Solution:** Pure team stats drive picks. Market is reference only.

## Key Specifications (LOCKED)

### Confidence Tiers
| Tier | Range | Win Rate | Loss Tolerance | Picks |
|------|-------|----------|----------------|-------|
| 100% STRICT | ≥1.00 | 100% | 0 losses (ZERO TOLERANCE) | Only best picks |
| 80% RELAXED | 0.80-0.99 | 80% | ±5% acceptable (75-85%) | Fallback picks |
| SKIP | <0.80 | N/A | N/A | Never pick |

### Formula: Stats → Probability

```
1. Get team strength ratings (0.0-1.0 scale)
2. Calculate delta: team_a_rating - team_b_rating + HCA
3. Convert to win probability: P(win) = 1 / (1 + e^(-k*delta))
   - k ≈ 3.0 (scaling factor)
   - HCA = 2.5 points (~0.025 rating points)
4. Pick team with higher win probability
5. Confidence = max(P(A), P(B))
```

### Output Format
```csv
date,team_a,team_b,picked_team,confidence,tier
2026-01-23,USC Upstate,Gardner Webb,USC Upstate,0.7234,RELAXED
```

**Removed Columns:**
- market_spread (reference only, not used)
- model_spread (replaced by probability)
- coverProb (replaced by confidence)
- impliedProb (market, not used)
- edge (market, not used)
- ev_per_1 (market, not used)
- kelly, stake_dollars (betting logic, removed)

### Moneyline Sanity Check
- Model probability vs implied probability divergence > 15% → WARNING
- Not used for pick generation, only validation
- If warning triggered: investigate model calibration

## Implementation Files

### New Files
- **`server/cli/projector_clean.ts`** - Stats-based pick generation engine
- **`server/cli/reset_record.ts`** - Reset wins/losses utility

### Updated Files
- **`scripts/generate_picks_html.mjs`** - Updated table format and headers
- **`shared/betting_constants.ts`** - Locked thresholds (unchanged but relevant)
- **`data/results/grades_*.json`** - All reset to 0-0 (clean slate)

## HTML Output

**Table Columns:**
```
Date | Team A (Home) | Team B (Away) | Picked Team | Confidence | Tier | A Score | B Score | Margin | Result
```

**Record Box:**
- Shows cumulative wins/losses across all graded games
- Reset to 0-0 today
- Will be rebuilt fresh starting tomorrow

## Running the New System

### Generate Picks
```bash
npx tsx server/cli/projector_clean.ts [YYYY-MM-DD]
# Default: today's date
# Reads: data/raw/schedule_YYYYMMDD.csv
# Writes: data/results/ts_projector_picks.csv, public/ts_projector_picks.csv
```

### Generate HTML
```bash
node scripts/generate_picks_html.mjs
# Reads: ts_projector_picks.csv + grades_*.json
# Writes: public/index.html
```

### Reset Record (Start Fresh)
```bash
npx tsx server/cli/reset_record.ts
# Resets all grades_*.json summary stats to 0-0
```

## What Gets Graded Tomorrow

The new CSV will have only these columns:
- **date:** Game date (YYYY-MM-DD)
- **team_a:** Home team
- **team_b:** Away team
- **picked_team:** Which team to bet (winner by stats)
- **confidence:** Win probability 0.7234 = 72.34%
- **tier:** STRICT or RELAXED

**Grading process will add:**
- a_score, b_score: Final scores
- margin: Point differential
- won: true/false (did picked_team win?)

## Validation Rules

✅ **LOCKED AND NON-NEGOTIABLE:**
- 100% STRICT = 100% win rate, 0 losses acceptable
- 80% RELAXED = 80% win rate, ±5% acceptable (75-85%)
- Never pick <80% confidence
- Confidence % = Expected win %
- Pure stats only (no market edge)

❌ **REMOVED (No longer used):**
- Edge calculations
- Market spread comparisons
- Kelly criterion betting
- EV per dollar
- Stake sizing

## Next Steps

1. ✅ Rebuild complete
2. ✅ Win/loss record reset to 0-0
3. ⏳ Generate picks tomorrow with `projector_clean.ts`
4. ⏳ Grade results starting tomorrow
5. ⏳ Monitor if picks actually achieve 100%/80% win rates per tier

## Troubleshooting

**Q: No picks generated?**
- A: Check if schedule CSV exists: `data/raw/schedule_YYYYMMDD.csv`
- Check if team metrics loaded: `data/raw/d1_teams_enhanced.csv`

**Q: Picks have weird confidence values?**
- A: Team ratings might be missing or extreme. Check team names match exactly.

**Q: Still seeing old market-based columns?**
- A: Clear browser cache, regenerate HTML: `node scripts/generate_picks_html.mjs`

## Architecture

```
Team Metrics (CSV) 
    ↓
Load ratings (strength, offensive)
    ↓
For each game:
  - Get team_a rating, team_b rating
  - Calculate rating delta
  - Apply HCA if home/away
  - Convert to win probability
  - Pick higher probability team
  - Check moneyline (warning only)
    ↓
Filter: Only picks >= 80% confidence
    ↓
Output CSV: date, team_a, team_b, picked_team, confidence, tier
    ↓
Generate HTML with table + record box
    ↓
Grade results + record wins/losses
    ↓
Monitor calibration: Are 100% picks actually 100% winners?
```

## Commit History

- `54b8b79` - Lock: 100% STRICT = 100% win rate with ZERO losses acceptable
- `09ffcef` - Clarify win rate expectations: 100% strict = 100% win rate, 80% relaxed = 80% win rate
- `bef309c` - Lock core requirement: ALL PICKS MUST BE WINNERS - non-negotiable
- `959b1a8` - Disable edge requirement - picks now based on confidence thresholds and team stats only
- `64b554f` - **REBUILD: Pure stats-based projector - no market calculations** ← NEW

## Questions?

All calculations are documented in [server/cli/projector_clean.ts](server/cli/projector_clean.ts).

Core constants are locked in [shared/betting_constants.ts](shared/betting_constants.ts).
