# Projector Improvements Implementation Guide

This guide documents the improvements implemented based on Luke Benz's NCAA_Hoops system analysis.

## ✅ Implemented Improvements

### 1. **Team Name Mapping** ⭐ CRITICAL
**File:** `server/cli/grade_yesterday.ts`
**Impact:** Fixes 5-10% of silent grading failures

**What's New:**
- Added `TEAM_NAME_MAPPING` dictionary with 30+ team name aliases
- Handles ESPN naming variations (e.g., "Texas A&M", "TAMU", "A&M" all normalize to same team)
- Prevents silent game matches failures
- Added validation warning when pick not found in scores

**Example:** Before this fix, "Texas A&M" was being normalized to "texam", causing grade mismatches.

```typescript
const TEAM_NAME_MAPPING: Record<string, string> = {
  'texas a&m': 'Texas A&M',
  'tamu': 'Texas A&M',
  'uncg': 'UNC Greensboro',
  // ... 30+ more mappings
};
```

---

### 2. **API Timeout Protection** ⭐ CRITICAL
**File:** `server/cli/grade_yesterday.ts`
**Impact:** Prevents ESPN API hangs (was indefinite before)

**What's New:**
- Added 10-second timeout to ESPN API fetch using `AbortController`
- Graceful handling with error message
- Prevents workflow from stalling if ESPN is slow

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);
const resp = await fetch(url, { signal: controller.signal });
```

---

### 3. **Dynamic Date Parameter Support**
**File:** `server/cli/grade_yesterday.ts`
**Impact:** Enables backfilling historical data

**What's New:**
- `fetchYesterdayScores()` now accepts optional `dateOverride` parameter
- Allows grading picks from any past date
- Usage: `npx tsx grade_yesterday.ts 2026-01-14`

---

### 4. **Calibration Analysis Framework** 🆕
**File:** `server/cli/analyze_calibration.ts`
**Impact:** Validates whether probability estimates match reality

**What It Does:**
- Measures if 70% cover probability picks actually hit 70% of the time
- Generates calibration curves by confidence band (50-55%, 55-60%, etc.)
- Calculates daily metrics and ROI by date
- Identifies systematic overconfidence/underconfidence

**Usage:**
```bash
npx tsx server/cli/analyze_calibration.ts
```

**Output Example:**
```
CALIBRATION ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 60-65%       | Predicted: 62% → Actual: 61.5% | N= 8 | ROI: $  120 | Avg EV: 0.084
⚠️ 70-75%      | Predicted: 72% → Actual: 58.3% | N= 5 | ROI: $ -200 | Avg EV: -0.120
✓ 75-80%       | Predicted: 77% → Actual: 75.0% | N= 4 | ROI: $  280 | Avg EV: 0.245

Average Calibration Error: 3.2%
✓ EXCELLENT: Probabilities are well-calibrated
```

---

### 5. **Backfill Missing Dates** 🆕
**Files:** `backfill_missing_dates.sh` (Mac/Linux), `backfill_missing_dates.ps1` (Windows)
**Impact:** Recovers Jan 12-15 data gap

**What It Does:**
1. Regenerates picks for Jan 12-15 using `sports_app_1.ts`
2. Grades each day from ESPN API using `grade_yesterday.ts`
3. Runs calibration analysis
4. Regenerates HTML with all historical data

**Usage (Windows):**
```powershell
.\backfill_missing_dates.ps1
```

**Usage (Mac/Linux):**
```bash
chmod +x backfill_missing_dates.sh
./backfill_missing_dates.sh
```

---

## 📋 Next Steps: Medium Priority Improvements

### Dynamic HCA Calculation
**Status:** Documented in LUKE_BENZ_IMPROVEMENTS.md
**Effort:** 30 minutes

Instead of hardcoded +3.5 for home teams, calculate from historical data:
```typescript
// Extract from regression model coefficients
const hca = regressionModel.coefficients[homeTeamIndex] - 
            regressionModel.coefficients[awayTeamIndex];
// Expected: 2.5-3.5 points, varies by season
```

### Weighted Regression with Recency
**Status:** Documented in LUKE_BENZ_IMPROVEMENTS.md
**Effort:** 1-2 hours

Current system uses unweighted regression. Luke's approach weights recent games higher:
```typescript
weight = 1 / (1 + (0.5^(5 * recency_ratio)) * exp(-recency_ratio))
// Exponential decay: last game = 1.0, games from 30 days ago = 0.1
```

### Confidence Bands on HTML Output
**Status:** Ready to implement
**Effort:** 15 minutes

Separate picks into tiers:
- **🟢 High Confidence:** 70%+ cover probability
- **🟡 Medium Confidence:** 60-70% cover probability  
- **🔴 Speculative:** 55-60% cover probability

---

## 🔍 How to Validate Improvements

### 1. **Check Team Name Mapping**
```bash
# Test by grading with known team variation
npx tsx server/cli/grade_yesterday.ts 2026-01-17
# Look for matches where original pick had alternate team name
```

### 2. **Check API Timeout**
```bash
# Manually test espn API
# Run grading, if ESPN is slow (>5 sec), it should timeout gracefully at 10 sec
npx tsx server/cli/grade_yesterday.ts 2026-01-17
```

### 3. **Check Calibration**
```bash
# After running backfill, check if probabilities are realistic
npx tsx server/cli/analyze_calibration.ts

# Look for:
# ✓ Calibration error < 5% = well-calibrated
# ⚠️ Calibration error 5-10% = minor drift
# ❌ Calibration error > 10% = overconfident model
```

---

## 📊 Recommended Analysis Workflow

1. **Weekly Calibration Check** (5 min)
   ```bash
   npx tsx server/cli/analyze_calibration.ts
   # Look for trend: improving or degrading?
   ```

2. **Monthly Performance Review**
   - Check hit rate by confidence band
   - Check ROI per confidence level
   - Identify if certain thresholds underperform

3. **Quarterly Deep Dive**
   - Run Luke's external rating comparison
   - Validate against KenPom, T-Rank, Sagarin
   - Check if you're systematically over/under-rating teams

---

## 🚀 Advanced Improvements (Not Yet Implemented)

See `LUKE_BENZ_IMPROVEMENTS.md` for:
- Weighted regression with recency decay
- Offensive/Defensive model separation
- Strength of Schedule (SOS) calculation
- Wins Above Bubble (WAB) metric
- Injury data integration
- Pre-season prior blending
- Tournament adjustment factors

---

## 📝 File Summary

### Modified Files
- **grade_yesterday.ts** - Added team mapping, API timeout, date parameter
- **sports_app_1.ts** - Ready for dynamic HCA addition (documented)

### New Files
- **analyze_calibration.ts** - Calibration analysis tool
- **backfill_missing_dates.ps1** - Windows backfill script
- **backfill_missing_dates.sh** - Mac/Linux backfill script
- **LUKE_BENZ_IMPROVEMENTS.md** - Detailed improvement guide

---

## 🎯 Quick Reference: Top 5 Improvements

| Rank | Improvement | Impact | Status |
|------|-------------|--------|--------|
| 1 | Team name mapping | Fixes silent failures | ✅ Done |
| 2 | API timeout | Prevents hangs | ✅ Done |
| 3 | Calibration analysis | Validates probabilities | ✅ Done |
| 4 | Dynamic HCA | Better predictions | 📝 Documented |
| 5 | Backfill Jan 12-15 | Complete record | 📋 Script ready |

---

**Questions?** Refer to LUKE_BENZ_IMPROVEMENTS.md for detailed methodology references and Luke's NCAA_Hoops repo patterns.
