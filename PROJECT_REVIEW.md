# Comprehensive Projector Project Review
**Date:** January 17, 2026  
**Reviewer:** Code Analysis System

---

## EXECUTIVE SUMMARY
Your projector system is well-architected with good separation of concerns (picks generation → grading → HTML display → deployment). However, there are **critical data quality issues**, **API fragility**, **missing validations**, and **performance optimizations** that could significantly improve reliability and accuracy.

**Priority Tiers:**
- 🔴 **CRITICAL** (Fix immediately - breaks functionality)
- 🟠 **HIGH** (Implement soon - major impact)
- 🟡 **MEDIUM** (Plan next - nice to have)
- 🔵 **LOW** (Consider for future)

---

## 1. CRITICAL ISSUES

### 1.1 🔴 Team Name Matching is Brittle (Grade Accuracy)
**File:** `server/cli/grade_yesterday.ts`  
**Issue:** The `normalizeTeam()` function strips all special characters and uses simple fuzzy matching. This causes mismatches.

**Examples of failure cases:**
- "Texas A&M" → "texam" (loses the "A&M" part)
- "SMU Mustangs" → "smumustangs"
- "St. Mary's" vs "Saint Mary's" (different abbreviations)
- "UTEP" vs "UT El Paso" (acronym vs. full name)
- "UNCG" vs "UNC Greensboro"

**Impact:** Picks for teams with special names don't grade → cumulative record incomplete

**Fix:**
```typescript
function normalizeTeam(name: string): string {
  // Build a canonical lookup table
  const TEAM_ALIASES: Record<string, string> = {
    'texas a&m': 'texasam',
    'texas a & m': 'texasam',
    'uc irvine': 'ucirvine',
    'uc davis': 'ucdavis',
    'nc state': 'ncstate',
    'north carolina state': 'ncstate',
    'uncg': 'uncgreensboro',
    'unc greensboro': 'uncgreensboro',
    'smu': 'smumustangs',
    'st. mary\'s': 'stmarys',
    'saint mary\'s': 'stmarys',
    'st. bonaventure': 'stbonaventure',
    'saint bonaventure': 'stbonaventure',
  };
  
  const lower = name.toLowerCase();
  if (TEAM_ALIASES[lower]) return TEAM_ALIASES[lower];
  
  // Fallback normalization
  return lower
    .replace(/\bst\.?\b/g, 'st')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bstate\b/g, 'st')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
```

---

### 1.2 🔴 No Validation for Missing Games in Grades File
**File:** `server/cli/grade_yesterday.ts`  
**Issue:** If a pick isn't found in ESPN scores, it silently skips with no warning. Grading is incomplete but caller doesn't know.

**Example:**
```typescript
// If match fails, the pick is never processed
for (const pick of picks) {
  const score = findScore(pick, scores);
  if (!score) continue; // ← Silent skip, no error
  // ... grade the pick
}
```

**Impact:** Picks can disappear from records without notification

**Fix:**
```typescript
const missingGames: PickRow[] = [];

for (const pick of picks) {
  const score = findScore(pick, scores);
  if (!score) {
    missingGames.push(pick);
    continue;
  }
  // ... grade
}

if (missingGames.length > 0) {
  console.warn(`⚠️  ${missingGames.length} picks had no matching scores:`);
  missingGames.forEach(p => console.warn(`   - ${p.team_a} vs ${p.team_b}`));
}
```

---

### 1.3 🔴 Hardcoded Filter Threshold (50%) Could Block Good Picks
**File:** `server/cli/sports app 1.ts` Line 566  
**Issue:** The 50% cover probability minimum was lowered from 75% to get ANY picks on Jan 17, but this is too permissive.

```typescript
// Current: filters picks > 50% cover prob
const picked = ranked.filter(p => (p.coverProb ?? 0) > 0.50);
```

**Problem:**
- 50% = slightly better than coin flip
- Model loses edge below ~60%
- Worse picks = lower ROI

**Analysis:**
- Jan 17: All 20 picks are above 50%
- Expected: Only picks > 60% should be recommended (highest confidence)

**Fix:** Make threshold configurable via environment variable or command-line arg:
```typescript
const MIN_COVER_PROB = Number(process.env.MIN_COVER_PROB || "0.60");
const picked = ranked.filter(p => (p.coverProb ?? 0) > MIN_COVER_PROB);
```

---

### 1.4 🔴 No Error Handling for ESPN API Timeouts
**File:** `server/cli/grade_yesterday.ts` Lines 45-70  
**Issue:** `fetch()` has no timeout. If ESPN is slow, grading hangs indefinitely.

**Fix:**
```typescript
async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

const resp = await fetchWithTimeout(url);
```

---

## 2. HIGH-PRIORITY IMPROVEMENTS

### 2.1 🟠 Missing Backfill for Historical Data (Jan 12-15)
**Current State:** Only Jan 10-11 graded, Jan 16 just added manually  
**Issue:** Jan 12-15 never had picks or grades

**Impact:** 
- Cumulative record incomplete
- Can't assess model performance
- Workflow probably wasn't running those days

**Fix:** Run grading script for missing dates:
```powershell
# Backfill Jan 12-15
npx tsx "server/cli/grade_yesterday.ts" "2026-01-12"
npx tsx "server/cli/grade_yesterday.ts" "2026-01-13"
npx tsx "server/cli/grade_yesterday.ts" "2026-01-14"
npx tsx "server/cli/grade_yesterday.ts" "2026-01-15"
```

---

### 2.2 🟠 No Tracking of Model Performance Metrics
**Missing Data:**
- Hit rate by cover threshold (% of picks > X% cover prob that actually covered)
- ROI by date and overall
- Worst-performing picks (identify bad predictions)
- Confidence calibration (are 75% cover probs actually correct 75% of the time?)

**Suggestion:** Add a `metrics.ts` script that analyzes all grades files:
```typescript
// Calculate metrics for all grades
- Total picks: 19
- Wins: 9 (47.4%) ← Should be higher!
- Covers: ?
- Average cover prob of picked games: ?
- Expected vs actual cover rate
```

**Action:** Create `server/cli/analyze_performance.ts` to generate metrics

---

### 2.3 🟠 Workflow Not Running Automatically (Probably)
**File:** `.github/workflows/projector.yml`  
**Issue:** Set to 2 AM EST (7 AM UTC) but...
- No confirmation workflow is actually triggering
- No logs visible in GitHub Actions
- No way to debug failures

**Suggestion:**
1. Check GitHub Actions tab to confirm workflow runs at 2 AM
2. Add better logging to workflow YAML
3. Add Slack/email notification on failure

```yaml
- name: Send notification on failure
  if: failure()
  run: |
    echo "WORKFLOW FAILED at $(date)" | mail -s "Projector Workflow Failed" you@example.com
```

---

### 2.4 🟠 CSV Format Inconsistencies Can Break HTML Generator
**Files:** `enhanced_projector_picks.csv`, `grades_*.json`  
**Issue:** If CSV is empty (only header) or malformed, HTML generator silently fails

**Current check:**
```javascript
if (!raw) {
  console.error('CSV is empty');
  process.exit(1);
}
```

**Add stricter validation:**
```javascript
const lines = raw.split('\n').filter(l => l.trim());
if (lines.length < 2) { // header + at least 1 pick
  console.error('CSV must have at least 1 pick (header + 1 data row)');
  process.exit(1);
}

// Validate header
const expectedHeaders = ['date', 'team_a', 'team_b', 'market_spread', ...];
const actualHeaders = lines[0].split(',');
const missing = expectedHeaders.filter(h => !actualHeaders.includes(h));
if (missing.length > 0) {
  console.error(`Missing CSV columns: ${missing.join(', ')}`);
  process.exit(1);
}
```

---

## 3. MEDIUM-PRIORITY ENHANCEMENTS

### 3.1 🟡 Add Timezone Awareness to Date Handling
**Issue:** Dates are ISO strings (UTC) but games finish at different times by timezone

**Current:** Grade at 2 AM EST (7 AM UTC) - covers most West Coast games but not all

**Better approach:**
- Store pickup date AND grading reference time
- Check which games are actually completed by ESPN
- Retry up to 3x if some games still pending

```typescript
const MAX_RETRIES = 3;
for (let retry = 0; retry < MAX_RETRIES; retry++) {
  const scores = await fetchYesterdayScores();
  const completedCount = scores.length;
  if (completedCount >= expectedGameCount * 0.95) {
    break; // 95% of games done, proceed
  }
  if (retry < MAX_RETRIES - 1) {
    console.log(`Only ${completedCount}/${expectedGameCount} games complete. Retrying in 30s...`);
    await new Promise(r => setTimeout(r, 30000));
  }
}
```

---

### 3.2 🟡 Add Decay to Old Grades (Don't Weight Old Picks Equally)
**Issue:** Cumulative wins/losses counts 9-7, but older picks from Jan 10-11 are still weighted equally

**Better:** Recent picks matter more than old ones
```typescript
// Calculate time-weighted record
const today = new Date('2026-01-17');
const weights = gradesFiles.map(file => {
  const dateMatch = file.match(/grades_(\d{4})(\d{2})(\d{2})/);
  if (!dateMatch) return 0;
  const gameDate = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
  const daysAgo = (today - gameDate) / (1000 * 60 * 60 * 24);
  return Math.exp(-0.1 * daysAgo); // exponential decay
});
```

---

### 3.3 🟡 Add Pick Staleness Warning
**File:** `scripts/generate_picks_html.mjs`  
**Issue:** HTML shows picks from today, but what if they're old?

**Suggestion:**
```javascript
const pickAge = (now - new Date(picks[0].date)) / (1000 * 60 * 60);
if (pickAge > 24) {
  console.warn(`⚠️  Picks are ${pickAge.toFixed(1)} hours old`);
}
```

---

### 3.4 🟡 Validate Market Lines Match Expected Games
**File:** `server/cli/sports app 1.ts`  
**Issue:** If Talisman scraper returns 0 games, projector runs with empty slate

**Better:**
```typescript
if (marketLines.length === 0) {
  console.error('ERROR: No market lines found. Scraper may have failed.');
  console.error('Check:');
  console.error('  - Talisman website is accessible');
  console.error('  - Scraper selector hasn\'t changed');
  process.exit(1);
}

if (marketLines.length < 10) {
  console.warn(`⚠️  Only ${marketLines.length} games found (expected ~300 in full season)`);
  console.warn('This is normal for offseason but unusual during season');
}
```

---

## 4. CODE QUALITY & REFACTORING

### 4.1 🟡 Extract Team Name Normalization to Shared Utility
**Currently:** Duplicated in `grade_yesterday.ts`  
**Better:** Create `server/lib/team_normalization.ts`
```typescript
// One source of truth
export const TEAM_ALIASES = { /* comprehensive map */ };
export function normalizeTeamName(name: string): string { /* logic */ }
```

---

### 4.2 🟡 Add TypeScript Strict Mode Everywhere
**File:** `server/cli/sports app 1.ts`  
**Issue:** Many `any` types, loose typing

**Add to `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true
  }
}
```

---

### 4.3 🟡 Add Input Validation for Date Arguments
**Files:** `grade_yesterday.ts`, `sports app 1.ts`  
**Issue:** Accept date via `process.argv[2]` with no validation

**Better:**
```typescript
function parseDate(dateStr: string | undefined): Date {
  if (!dateStr) return new Date();
  
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) {
    throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD`);
  }
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  
  return date;
}
```

---

## 5. PERFORMANCE OPTIMIZATIONS

### 5.1 🟡 Cache ESPN API Results
**Issue:** Each grading run fetches ESPN scores. If called twice same day, duplicate API calls.

**Fix:**
```typescript
const cacheDir = path.join(root, '.cache');
const cacheFile = path.join(cacheDir, `espn_scores_${dateStr}.json`);

if (fs.existsSync(cacheFile)) {
  return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
}

const scores = await fetchFromESPN(...);
fs.mkdirSync(cacheDir, { recursive: true });
fs.writeFileSync(cacheFile, JSON.stringify(scores), 'utf8');
return scores;
```

---

### 5.2 🟡 Parallelize Game Predictions
**File:** `server/cli/sports app 1.ts`  
**Issue:** Processes games sequentially. With 300+ games, could be slow.

**Fix:**
```typescript
// Process in batches of 10
const BATCH_SIZE = 10;
const predictions: any[] = [];

for (let i = 0; i < marketLines.length; i += BATCH_SIZE) {
  const batch = marketLines.slice(i, i + BATCH_SIZE);
  const batchResults = await Promise.all(
    batch.map(game => predictGameAsync(game, ratings))
  );
  predictions.push(...batchResults);
}
```

---

## 6. MONITORING & OBSERVABILITY

### 6.1 🟡 Add Debug Logging Flags
**Suggestion:**
```bash
# Enable debug mode
DEBUG=projector:* npm run projector

# See what team names are being matched
DEBUG=projector:teams npm run projector
```

---

### 6.2 🟡 Add Metrics Export
**Suggestion:** Export `metrics.json` after each run:
```json
{
  "run_date": "2026-01-17",
  "games_analyzed": 20,
  "picks_generated": 20,
  "grade_date": "2026-01-16",
  "grades_found": 3,
  "grades_missing": 0,
  "cumulative_record": { "wins": 9, "losses": 10 },
  "model_performance": {
    "avg_cover_prob": 0.72,
    "actual_cover_rate": 0.42,
    "calibration_error": 0.30
  }
}
```

---

## 7. TESTING & VALIDATION

### 7.1 🟡 Add Unit Tests for Critical Functions
**Missing tests for:**
- `normalizeTeam()` - Does it handle all team name variants?
- `gradePicks()` - Does it correctly calculate wins/covers/ROI?
- `predictGame()` - Do HCA coefficients apply correctly?
- `calculateKelly()` - Is Kelly criterion implemented correctly?

**Example test:**
```typescript
describe('normalizeTeam', () => {
  it('handles Texas A&M variants', () => {
    expect(normalizeTeam('Texas A&M')).toBe(normalizeTeam('Texas A & M'));
    expect(normalizeTeam('Texas A&M')).toBe(normalizeTeam('TAMU'));
  });
  
  it('handles St. vs Saint', () => {
    expect(normalizeTeam("St. Mary's")).toBe(normalizeTeam("Saint Mary's"));
  });
});
```

---

## 8. DOCUMENTATION IMPROVEMENTS

### 8.1 🟡 Add Runbook for Common Issues
**Create:** `RUNBOOK.md`
```markdown
# Runbook: Common Issues & Fixes

## Issue: Picks aren't grading
- Check ESPN API is up: `curl https://site.api.espn.com/...`
- Check team names in picks CSV
- Run: `npx tsx server/cli/grade_yesterday.ts --debug`

## Issue: Workflow not running
- Check GitHub Actions tab
- Verify cron schedule is correct (2 AM EST = 7 AM UTC)

## Issue: No picks generated
- Check market lines are fetched: `--max 5` to see first 5
- Check filter threshold: `--min-cover-prob 0.50`
```

---

### 8.2 🟡 Document Algorithm Assumptions
**Create:** `ALGORITHM_ASSUMPTIONS.md`
```markdown
# Projector Algorithm Assumptions

## Hard-coded Values
- **HCA Net Rating:** +3.5 points
- **Average Possessions:** 70
- **Cover Variance:** 11 points (std dev)
- **Logistic Regression:** 0.06 coefficient
- **Min Cover Probability:** 50%

## Data Sources
- Team ratings: `cbb_betting_sim/data/processed/ratings.csv`
- Market lines: Talisman Red scraper
- Game scores: ESPN API

## Failure Modes
- If ratings CSV missing: Uses default (100 off/def)
- If ESPN API down: Grading fails silently
- If team names don't match: Pick skipped in grades
```

---

## 9. QUICK WINS (Easy Fixes, Big Impact)

| Issue | Fix | Time | Impact |
|-------|-----|------|--------|
| Team name mismatches | Add alias lookup table | 15 min | 🟢 Fixes grading gaps |
| No fetch timeout | Add 10s timeout | 5 min | 🟢 Prevents hangs |
| No backfill for Jan 12-15 | Run grade script 4x | 2 min | 🟢 Complete record |
| No validation warnings | Add console.warn() calls | 10 min | 🟢 Better visibility |
| Hardcoded threshold | Make env variable | 5 min | 🟢 Flexibility |
| No error handling | Add try-catch wrappers | 20 min | 🟢 Robustness |

---

## 10. IMPLEMENTATION ROADMAP

**Week 1 (IMMEDIATE):**
1. ✅ Add team name alias lookup table
2. ✅ Add fetch timeout
3. ✅ Backfill Jan 12-15 grades
4. ✅ Add validation & warnings

**Week 2 (HIGH PRIORITY):**
1. ⏳ Make filter threshold configurable
2. ⏳ Add missing game warning in grade_yesterday
3. ⏳ Create performance metrics script
4. ⏳ Verify workflow is running via GitHub Actions

**Week 3 (MEDIUM):**
1. 📋 Extract team normalization to shared lib
2. 📋 Add TypeScript strict mode
3. 📋 Add input validation for dates
4. 📋 Add debug logging

**Week 4+ (NICE TO HAVE):**
1. 💡 Cache ESPN results
2. 💡 Parallelize predictions
3. 💡 Add unit tests
4. 💡 Timezone awareness for grading

---

## SUMMARY SCORECARD

| Category | Status | Notes |
|----------|--------|-------|
| **Architecture** | 🟢 Solid | Good separation of concerns |
| **Data Quality** | 🔴 Weak | Team name mismatches, gaps in grading |
| **Error Handling** | 🟠 Fair | Silent failures, no timeouts |
| **Testing** | 🔴 None | No unit tests |
| **Documentation** | 🟡 Partial | ENHANCED_PROJECTOR.md good, but missing runbook |
| **Monitoring** | 🟡 Basic | Logs exist but no structured metrics |
| **Performance** | 🟢 Acceptable | Sequential processing is fine for now |
| **Reliability** | 🟠 Fragile | Multiple failure modes |

**Overall Grade: B-**  
Good foundation, but needs hardening for production reliability.

---

## NEXT STEPS

1. **Today:** Implement 3-4 quick wins from Section 9
2. **This week:** Fix all CRITICAL issues (Section 1)
3. **Next week:** Address HIGH-priority improvements (Section 2)
4. **Ongoing:** Add monitoring and metrics (Section 6)

Would you like me to implement any of these improvements?
