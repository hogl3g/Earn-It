# Alternative Score/Schedule Sources

## Current Status
- **ESPN API**: Working, but date misalignment with Talisman Red (off by ~1 day)
- **Talisman Red**: Predictions source, dates don't match ESPN schedule

## Future Integration Options

### 1. USA Today Sports Data
- **URL**: https://sportsdata.usatoday.com/basketball/ncaab/scores?date=YYYY-MM-DD&season=YYYY
- **Format**: HTML with embedded JSON
- **Benefits**: Clean date format, reliable schedule
- **Integration**: Requires HTML parsing or reverse-engineering their API

### 2. Fox Sports
- **URL**: https://www.foxsports.com/college-basketball/scores
- **Format**: React app with embedded `window.__NUXT__` JSON
- **Benefits**: Rich data, includes odds
- **Integration**: Parse JSON from script tags

### 3. Recommendation
For now, continue with ESPN API. The team name matching in the grader handles date misalignments.

To add USA Today:
1. Parse `window.__INITIAL_STATE__` from their HTML
2. Extract games array with status, scores, teams
3. Use as fallback when ESPN returns empty results

## Date Handling Notes
- **Talisman dates**: Posted day before game (18-Jan = games on 19-Jan per ESPN)
- **ESPN dates**: Actual game day (UTC/Eastern time)
- **Grader**: Matches by team names, date-agnostic
- **Solution**: Keep current approach, grader works regardless of date offset
