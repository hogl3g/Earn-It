# Offensive Stats Integration Guide

## Overview

Offensive efficiency data has been integrated into the team metrics system. 50 D1 teams now have comprehensive offensive profiling including:

- **PPG**: Points per game average
- **FG Efficiency**: Field goal percentage vs baseline (45% = 0.0)
- **3P Rating**: Three-point shooting efficiency rating (0.0-1.0)
- **Rebounding**: Offensive rebounding rating
- **Passing**: Assist rate rating
- **Ball Security**: Turnover prevention rating
- **Overall Rating**: Weighted composite (0.0-1.0)

## Top Offensive Teams

| Rank | Team | Rating | PPG | FG% | 3P% | Assists |
|------|------|--------|-----|-----|-----|---------|
| 1 | Saint Louis | 0.713 | 91.2 | 58.5% | 37.8% | High |
| 2 | Gonzaga | 0.703 | 89.9 | 60.0% | 40.0% | Very High |
| 3 | Arizona | 0.686 | 89.9 | 57.0% | 36.9% | Very High |
| 4 | Michigan | 0.660 | 92.7 | 58.0% | 38.0% | High |
| 5 | Virginia | 0.595 | 84.0 | 73.7% | 35.0% | Moderate |

## Integration with Projector

### Loading Metrics

```typescript
import { loadTeamMetrics, compareTeams } from 'server/lib/team_metrics_integration';

const metrics = loadTeamMetrics();
const comparison = compareTeams('Gonzaga', 'Arizona', metrics);

console.log(comparison.offensiveEdge);  // Shows offensive matchup advantage
```

### Matchup Analysis

The system now provides:

1. **Strength Differential** - Team power ratings (standings-based)
2. **Offensive Edge** - Head-to-head offensive efficiency comparison
3. **Schedule Context** - Opponent strength context for both teams
4. **Full Profiles** - When both teams have complete data

### Example: Gonzaga vs Arizona

```
Gonzaga Metrics:
  - Strength Rating: 0.944 (top program)
  - Offensive Rating: 0.703 (elite)
  - PPG: 89.9
  - FG%: +0.60 (60% shooting)
  
Arizona Metrics:
  - Strength Rating: 0.996 (#1 strength)
  - Offensive Rating: 0.686 (elite)
  - PPG: 89.9
  - FG%: +0.57 (57% shooting)

Analysis:
  - Arizona has slight strength edge (+0.052)
  - Gonzaga has slight offensive edge (+0.017)
  - Both elite offensive teams
  - Close matchup with slight Arizona edge
```

## Data Pipeline

### Step 1: Parse Offensive Stats
```bash
npx tsx server/cli/parse_offensive_stats.ts
```
Output: `data/results/offensive_ratings_2026_01_22.csv`

### Step 2: Merge into Team Database
```bash
npx tsx server/cli/merge_offensive_stats.ts
```
Output: Updated `data/raw/d1_teams_enhanced.csv`

## Usage in Projector

### Option 1: Quick Strength Adjustment
```typescript
const metrics = loadTeamMetrics();
const adjustment = calculateStrengthAdjustment('Gonzaga', 'Arizona', baseSpread, metrics);
const adjustedSpread = baseSpread + adjustment;
```

### Option 2: Full Comparison
```typescript
const comparison = compareTeams('Gonzaga', 'Arizona', metrics);

// Apply adjustments to confidence
let confidence = baseConfidence;
if (comparison.strengthDifference > 0.1) {
  confidence *= 1.1;  // Arizona advantage
}

// Use offensive edge in analysis
if (comparison.offensiveEdge.includes('Gonzaga')) {
  confidence *= 1.05;  // Gonzaga has better offense
}
```

## Integration Utilities

### `loadTeamMetrics()`
Returns Map of all teams with complete metrics.

**Available Fields:**
- `team_name`: Team name
- `strength_rating`: Overall power (0.0-1.0)
- `offensive_ppg`: Points per game
- `offensive_rating`: Offensive efficiency (0.0-1.0)
- `fg_efficiency`: Field goal efficiency vs baseline
- `three_point_rating`: 3P shooting ability
- `rebounding_rating`: Offensive rebounding
- `passing_rating`: Assist/ball movement
- `ball_security`: Turnover prevention
- `schedule_strength`: Opponent difficulty
- `momentum_score`: Recent form

### `calculateStrengthAdjustment(teamA, teamB, baseSpread, metrics)`
Calculate spread delta based on strength ratings.

**Example:**
```
Arizona (0.996) vs Southern Utah (0.350)
Delta: 0.646 → ~6.5 point adjustment
```

### `calculateConfidenceAdjustment(metrics)`
Calculate confidence multiplier (0.8-1.2) based on:
- Strength rating
- Recent momentum
- Offensive efficiency

### `compareTeams(teamA, teamB, metrics)`
Full matchup analysis with:
- Strength differential
- Offensive edge
- Schedule comparison

### `getOffensiveProfile(metrics)`
Returns human-readable offensive summary:
- "Elite Offense (89.9 PPG, 58.0% FG)"
- "Strong Offense (87.9 PPG, 56.0% FG)"
- etc.

## Data Coverage

**Current State:**
- Total teams in database: 311
- Teams with strength metrics: 257 (82.6%)
- Teams with offensive metrics: 39
- Teams with both metrics: 36

**Next Steps:**
- Defensive stats integration (expected)
- Teams with full profiles (strength + offense + defense) will be available
- Confidence adjustments will use all three layers

## Performance Metrics

### Top Offensive Components

**Best FG Efficiency:** Saint Louis (58.5%)
**Best 3P Rating:** Saint Louis (0.840 rating)
**Best Rebounding:** Florida Gators (Full 1.0 rating)
**Best Passing:** Arizona Wildcats (Full 1.0 rating - 18+ APG)
**Best Ball Security:** UAB Blazers (0.983 - minimal turnovers)

## File Locations

- Raw offensive stats: `data/raw/offensive_stats_2026_01_22.csv`
- Parsed ratings: `data/results/offensive_ratings_2026_01_22.csv`
- Enhanced team DB: `data/raw/d1_teams_enhanced.csv`
- Integration utilities: `server/lib/team_metrics_integration.ts`

## Next Integration

Defensive stats parsing expected to follow same pattern:
1. Parse defensive efficiency (50 top teams)
2. Calculate defensive ratings (0.0-1.0)
3. Merge into d1_teams_enhanced.csv
4. Enable full defensive vs offensive matchup analysis
