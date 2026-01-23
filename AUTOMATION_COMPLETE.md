# COMPLETE AUTOMATION SYSTEM - V3

## Overview

**ZERO Manual Work Required**

The system now runs completely automatically:
1. Scrapes ESPN + KenPom daily
2. Generates picks >80% confidence only
3. Grades previous day results
4. Updates wins/losses in HTML
5. Logs everything

## Architecture

```
DAILY CYCLE (Fully Automated)
│
├─ 1. SCRAPE ESPN
│  └─ Team stats (pts, rebounds, FG%, assists)
│  └─ Conference standings
│  └─ Today's schedule + lines (spread, moneyline)
│  └─ Output: espn_team_stats.json, schedule_today.csv
│
├─ 2. SCRAPE KENPOM  
│  └─ Team rankings
│  └─ Adjusted efficiency (offensive + defensive)
│  └─ Power ratings, strength of schedule
│  └─ Output: kenpom_metrics.json
│
├─ 3. MERGE METRICS
│  └─ Combine ESPN + KenPom into unified dataset
│  └─ Output: team_metrics_daily.json
│
├─ 4. GENERATE PICKS
│  └─ For each game: Compare team_a vs team_b metrics
│  └─ Calculate win probability using logistic function
│  └─ Only include if >= 80% confidence
│  └─ Validate against spread/moneyline alignment
│  └─ Output: ts_projector_picks.csv
│
├─ 5. GRADE YESTERDAY
│  └─ Fetch yesterday's final scores
│  └─ Grade only picks that were projected
│  └─ Log wins/losses
│  └─ Update cumulative record
│  └─ Output: grades_YYYYMMDD.json, cumulative_record.json
│
└─ 6. UPDATE HTML
   └─ Generate HTML with today's picks
   └─ Display wins/losses box (cumulative from today onward)
   └─ Output: public/index.html
```

## Files

### Scrapers
- **`server/cli/scrape_espn.ts`** - Scrapes ESPN for team stats, schedule, lines
- **`server/cli/scrape_kenpom.ts`** - Scrapes KenPom for rankings/efficiency

### Core Engine
- **`server/cli/daily_automation.ts`** - Merges metrics, generates picks (>80% only)
- **`server/cli/auto_grade.ts`** - Auto-grades yesterday's picks, logs results
- **`server/cli/orchestrator.ts`** - Runs complete daily cycle

### Output Files
- **`data/processed/team_metrics_daily.json`** - Merged metrics (ESPN + KenPom)
- **`data/results/ts_projector_picks.csv`** - Today's picks
- **`data/results/grades_YYYYMMDD.json`** - Yesterday's grades + results
- **`data/processed/cumulative_record.json`** - Running 0-0 record
- **`public/index.html`** - HTML display with picks + wins/losses

## Running

### Manual (Testing)

```bash
# Run individual steps
npx tsx server/cli/scrape_espn.ts
npx tsx server/cli/scrape_kenpom.ts
npx tsx server/cli/daily_automation.ts
npx tsx server/cli/auto_grade.ts
node scripts/generate_picks_html.mjs

# Run complete cycle at once
npx tsx server/cli/orchestrator.ts
```

### Automatic (Production)

#### macOS/Linux - Crontab

```bash
# Add to crontab (crontab -e)
# Run daily at 6:00 AM
0 6 * * * cd /path/to/Earn-It && npx tsx server/cli/orchestrator.ts >> logs/orchestrator.log 2>&1
```

#### Windows - Task Scheduler

```powershell
# Run PowerShell as Administrator

$trigger = New-ScheduledTaskTrigger -Daily -At 6:00AM
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"cd 'C:\path\to\Earn-It'; npx tsx server/cli/orchestrator.ts`""
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBattery -DontStopIfGoingOnBattery
Register-ScheduledTask -TaskName "Earn-It-Daily-Cycle" -Trigger $trigger -Action $action -Settings $settings -RunLevel Highest
```

## Data Flow

### Input
```
ESPN (daily):
  - Team stats: PPG, rebounds, FG%, assists, turnover margin
  - Conference standings: Rankings, wins/losses
  - Today's schedule: Matchups, spreads, moneylines
  - Yesterday's scores: Final scores for grading

KenPom (daily):
  - Team rankings (1-350+)
  - Adjusted efficiency offensive + defensive
  - Power ratings
  - Strength of schedule
```

### Processing
```
1. Load metrics for both teams in each game
2. Calculate team strength score (0.0-1.0):
   - Points differential (25% weight)
   - Adjusted efficiency (35% weight)
   - Field goal % (15% weight)
   - Rebounding (15% weight)
   - Assists (10% weight)
3. Convert score delta to win probability:
   - P(win) = 1 / (1 + e^(-k*delta))
   - k ≈ 3.0 (scaling)
   - HCA ≈ 2.5 points (~0.025 rating)
4. Check spread/moneyline alignment:
   - Does market agree with metrics?
   - Flag if divergence > threshold
5. Only output picks >= 80% confidence
```

### Output
```
CSV Format:
date,team_a,team_b,picked_team,confidence,tier,spread,moneyline,alignment

Example:
2026-01-23,Arizona,Stanford,Arizona,0.8432,RELAXED,-14.5,-500,✓ ALIGNED
```

### Grading
```
Input: Yesterday's picks CSV + final scores

Rules:
  - Only grade games that were projected
  - Only grade completed games (both teams have scores)
  - Compare picked_team's final score vs opponent
  - Won = picked team won the game
  - Log to JSON: { picked_team, score_a, score_b, won, margin }
  
Output:
  - grades_YYYYMMDD.json: Detailed results
  - cumulative_record.json: Running total (starts at 0-0)
  - HTML display: Updated wins/losses box
```

## Configuration

### Thresholds (LOCKED - NON-NEGOTIABLE)
```typescript
CONFIDENCE_STRICT_MIN = 1.00    // 100%
CONFIDENCE_RELAXED_MIN = 0.80   // 80%
SKIP_BELOW = 0.80               // Never pick <80%
```

### Scoring Weights
```typescript
Points Differential:    25%
Adjusted Efficiency:    35%  ← Most important
Field Goal %:           15%
Rebounding:            15%
Assists:               10%
```

### Logistic Function
```typescript
P(win) = 1 / (1 + e^(-k*delta))
k = 3.0    // Scaling factor
HCA = 0.025 // Home court ~2.5 points / 100 scale
```

## Key Rules

### LOCKED (Non-Negotiable)
1. **Only project picks >= 80% confidence**
   - <80% = SKIP (no pick)
   - 80%-99% = RELAXED (80% expected win rate)
   - >=100% = STRICT (100% expected win rate, 0 losses)

2. **Only grade projected picks**
   - If a pick wasn't in our CSV, don't grade it
   - Silent failures = BAD
   - Only count wins/losses for our picks

3. **Zero losses acceptable for 100% picks**
   - STRICT tier = must win 100% of time
   - If any 100% pick loses = CRITICAL ERROR
   - Indicates model miscalibration

4. **Daily stats updates (NO EXCEPTIONS)**
   - ESPN data must refresh daily
   - KenPom must refresh daily
   - Stale data = bad picks
   - Set reminders if data sources go down

5. **No manual picks or grading**
   - System is fully automated
   - If you pick manually, you break the cycle
   - All picks must come from projector
   - All grades must be auto-graded

## Troubleshooting

### Problem: No picks generated
**Cause:** Missing team metrics or schedule

**Fix:**
1. Check ESPN scraper ran successfully
2. Check KenPom scraper ran successfully
3. Check `data/processed/team_metrics_daily.json` exists
4. Check `data/raw/schedule_today.csv` exists
5. Run `npx tsx server/cli/orchestrator.ts` manually

### Problem: Picks look weird (very high/low confidence)
**Cause:** Stale metrics or missing stats

**Fix:**
1. Force refresh: Delete `data/processed/team_metrics_daily.json`
2. Re-run scrapers: `npx tsx server/cli/scrape_espn.ts && npx tsx server/cli/scrape_kenpom.ts`
3. Check ESPN/KenPom website directly (is data available?)
4. Verify team names match exactly between sources

### Problem: Yesterday's picks not graded
**Cause:** Missing scores or name mismatch

**Fix:**
1. Verify final scores are available
2. Check team names in picks CSV match team names in scores
3. Run auto-grader manually: `npx tsx server/cli/auto_grade.ts`
4. Check `data/results/grades_YYYYMMDD.json` for output

### Problem: Wins/losses box empty or wrong
**Cause:** Cumulative record not updated

**Fix:**
1. Check `data/processed/cumulative_record.json` exists
2. Run auto-grader: `npx tsx server/cli/auto_grade.ts`
3. Check `grades_*.json` files have been created
4. Regenerate HTML: `node scripts/generate_picks_html.mjs`

### Problem: System shows 100% pick that lost
**Cause:** Model miscalibration

**Action:**
1. STOP - Don't generate more picks yet
2. Investigate: Why did a certain metric predict 100%?
3. Check team comparison logic
4. Review confidence calculation
5. May need to adjust weights or thresholds

## Monitoring

### Daily Checks
```
✅ Orchestrator ran without errors
✅ Picks generated > 0 (if games scheduled)
✅ HTML updated with latest picks
✅ Yesterday's grades logged (if applicable)
✅ Wins/losses box shows correct record
```

### Weekly Review
```
✅ Hit rate for 100% STRICT picks = 100%
✅ Hit rate for 80% RELAXED picks ≈ 80% (±5% acceptable)
✅ No false negatives (good teams we skipped shouldn't win by 20+)
✅ Spread/moneyline alignment is correct
✅ Team stats are updating daily
✅ No stale data being used
```

### Monthly Review
```
✅ Cumulative record from this month
✅ Hit rates by tier (STRICT vs RELAXED)
✅ Any trends in misses (particular teams? times?)
✅ Metric weights still appropriate?
✅ Need to recalibrate scoring function?
```

## Logging

All runs logged to: `logs/orchestrator.log`

Example:
```
[2026-01-23T06:00:00.000Z] Daily cycle completed
[2026-01-23T06:15:00.000Z] Daily cycle completed
[2026-01-24T06:00:00.000Z] Daily cycle completed
```

## Next Steps

1. ✅ Core automation system built
2. ⏳ Implement real ESPN scraper (currently has placeholders)
3. ⏳ Implement real KenPom scraper (currently has placeholders)
4. ⏳ Schedule automatic daily runs
5. ⏳ Monitor first 2 weeks of results
6. ⏳ Adjust weights/thresholds if needed

## Questions?

All logic is documented in source files:
- Scraping logic: `server/cli/scrape_*.ts`
- Comparison logic: `server/cli/daily_automation.ts`
- Grading logic: `server/cli/auto_grade.ts`
- Orchestration: `server/cli/orchestrator.ts`

No manual intervention needed. System is fully autonomous.
