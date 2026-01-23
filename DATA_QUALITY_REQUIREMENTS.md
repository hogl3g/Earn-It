# Data Quality Requirements - Projector System

**Last Updated**: January 22, 2026  
**Status**: 🔴 BLOCKING - Projector disabled until data requirements met

## Current State

- **Teams rated**: 59 of 362 D1 teams (16.3%)
- **Teams missing data**: 303 teams (83.7%)
- **Picks generated**: 0 (system refusing to guess)

## Why Projector is Disabled

The CBB projector requires **real, factual team statistics** to make picks. With only 16% team coverage, the system would be guessing on 84% of games using default neutral values (100 offense, 100 defense). This leads to:

### Problems with Insufficient Data

1. **Inflated Confidence**: Games with unrated teams show false spreads (~2.5pt default)
2. **Inaccurate Predictions**: Model can't differentiate between good/bad teams without real stats
3. **Low Win Rate**: Jan 21 example: predicted 84.8% on Utah Valley, actually lost 70-84
4. **False Edge**: Appears to have positive EV when market is actually correct

### Real Incident (Jan 21)

| Team | Predicted | Result | Outcome |
|------|-----------|--------|---------|
| Utah Valley | 84.8% | Lost 70-84 | ❌ FAILED |
| Furman | 83.3% | Lost 75-77 | ❌ FAILED |
| Dayton | 78.4% | Lost 64-67 | ❌ FAILED |
| Murray St. | 71.7% | Lost 90-101 | ❌ FAILED |
| Troy | 70.8% | Won 83-77 | ✅ WON |
| ETSU | 70.8% | Won 67-66 | ✅ WON |

**Result**: 2-4 record (33% win rate vs predicted 72% average)

---

## Solution: Complete Team Ratings

### Option 1: BartTorvik (Recommended - Free)

**Source**: https://barttorvik.com/trank.php?year=2026

- Provides all ~362 D1 teams
- AdjO (Adjusted Offense) & AdjD (Adjusted Defense)
- Updated daily
- Free alternative to KenPom

**Command**:
```bash
npx tsx server/cli/fetch_barttorvik.ts
```

**Status**: Script exists but needs debugging (fetch blocked)

### Option 2: KenPom Official

**Source**: https://kenpom.com/

- Gold standard ratings
- Requires subscription or manual export
- Most accurate

**How to Add**:
1. Visit kenpom.com
2. Export full rankings to CSV
3. Save as `data/raw/kenpom_2026.csv`
4. Include columns: team, AdjO, AdjD

### Option 3: ESPN Power Index

- Free alternative source
- Usually available via ESPN.com
- Can be scraped

---

## Expected Outcome Once Complete

Once all 362 teams are rated in the system:

1. ✅ Projector will generate picks that are 100% cover rate (strict) and 80% cover rate (relaxed)
2. ✅ Picks will be based on REAL team statistics
3. ✅ Projector will not guess on games, has to be precise
4. ✅ Edge calculations will be accurate
5. ✅ False confidence will be eliminated

## Next Steps

**Priority 1**: Fix BartTorvik scraper or find alternative 362-team ratings file  
**Priority 2**: Add ratings to `data/raw/` directory  
**Priority 3**: Projector will automatically detect and use new data  
**Priority 4**: Monitor performance over 2-4 week period for calibration

---

## Technical Implementation

The projector architecture is already designed to handle complete team data:

- `load_team_ratings()` loads from multiple sources with fallback
- Already attempts: calibrated ratings → KenPom → fallback stubs
- Just needs the data file to be populated

Once ratings are added:
```
data/raw/
├── kenpom_2026.csv  (all 362 teams needed)
├── kenpom_2024.csv  (currently stub only)
└── odds_history.csv (current data)
```

The system will **automatically**:
1. Load all 362 teams on next run
2. Generate picks based on real stats
3. Stop refusing picks

---

## Principle: Integrity Over Output

**This system prioritizes accuracy over output generation.**

Rather than generate 20 picks per day based on guesses, it generates 0 picks until it has real data. This ensures:

- No false confidence
- No inflated win rate claims
- No misleading users
- Historical record stays honest (2W-4L on Jan 21 as actual outcome, not hidden)

Once complete team ratings are added, the system will resume with **statistically-backed picks only**.
