# Quick Reference Guide

All analysis tools at a glance.

## Dashboard Commands

### Real-Time Performance
```bash
npx tsx server/cli/dashboard.ts
```
**Shows:** Win rate, ROI, Sharpe ratio, daily breakdown  
**Best for:** Daily monitoring

### Calibration Validation
```bash
npx tsx server/cli/create_calibration_dataset.ts
npx tsx server/cli/analyze_calibration.ts
```
**Shows:** Are 100% strict and 80% relaxed picks hitting at predicted rates?  
**Best for:** Weekly analysis

### Closing Line Value
```bash
npx tsx server/cli/clv_analysis.ts
```
**Shows:** Are you getting better odds than sharp money?  
**Best for:** Identifying sharp angle selection

### Model Health
```bash
npx tsx server/cli/health_check.ts
```
**Shows:** Alerts on drift, overconfidence, variance  
**Best for:** Catching problems early

### Enhanced Picks
```bash
npx tsx server/cli/export_enhanced_picks.ts
```
**Shows:** Confidence intervals + Kelly sizing  
**Best for:** Bankroll management

---

## Key Metrics Explained

| Metric | Target | Red Flag |
|--------|--------|----------|
| Hit Rate | 52.4%+ | < 45% |
| ROI | 5%+ | Negative |
| Sharpe Ratio | 1.0+ | < 0.5 |
| CLV | Positive | Negative |
| Calibration Error | < 5% | > 10% |
| Variance | < 20% | > 50% |

---

## Daily Checklist

- [ ] Generate picks: `npm run projector`
- [ ] Grade results: `npx tsx server/cli/grade_picks.ts`
- [ ] View dashboard: `npx tsx server/cli/dashboard.ts`
- [ ] Check health: `npx tsx server/cli/health_check.ts` (if issues)

---

## Weekly Checklist

- [ ] Run all analysis tools
- [ ] Review calibration vs recent picks
- [ ] Check CLV trend
- [ ] Export enhanced picks for review
- [ ] Update documentation

---

## Emergency: Model Not Performing

1. Check health alerts: `npx tsx server/cli/health_check.ts`
2. Validate calibration: `npx tsx server/cli/analyze_calibration.ts`
3. Review recent picks: `npx tsx server/cli/export_enhanced_picks.ts`
4. Check data quality: Validate scores/spreads in `data/results/`
5. Run dashboard: `npx tsx server/cli/dashboard.ts`

---

## File Locations

**Tools:**
- All CLI tools: `server/cli/`
- Utilities: `shared/`

**Data:**
- Picks: `data/results/*picks*.csv`
- Grades: `data/results/grades_*.json`
- Reports: `data/results/*report*.csv`

**Docs:**
- Full guide: `ANALYSIS_TOOLS_README.md`
- Implementation: `NEXT_STEPS_IMPLEMENTATION.md`
- This guide: `QUICK_REFERENCE.md`

---

## Common Issues

**"No picks found"**
→ Run projector first: `npm run projector`

**"NaN%" in calibration**
→ Missing coverProb data. Check picks CSV columns.

**"No grade data"**
→ Run grader: `npx tsx server/cli/grade_picks.ts`

**High variance warnings**
→ Small sample size. Get 50+ games before adjusting model.

---

## Performance Targets

**Current:** 33.3% hit rate, +$1,341 profit, 29.9% ROI
**Target:** 55%+ hit rate, +5-10% ROI
**Status:** Model profitable but overconfident

---

Need more details? See [ANALYSIS_TOOLS_README.md](ANALYSIS_TOOLS_README.md)
