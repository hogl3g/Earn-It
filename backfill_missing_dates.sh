#!/usr/bin/env bash
# Backfill missing picks and grades for Jan 12-15, 2026
# 
# This script regenerates projector picks for the specified dates,
# then attempts to fetch grades from ESPN
#
# Usage: ./backfill_missing_dates.sh

set -e

echo "🔄 Backfilling missing dates (Jan 12-15)..."

cd "$(dirname "$0")/../../.."

DATES=("2026-01-12" "2026-01-13" "2026-01-14" "2026-01-15")

for DATE in "${DATES[@]}"; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Processing $DATE"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Run projector for this date
  echo "📊 Generating picks for $DATE..."
  npx tsx "server/cli/sports app 1.ts" --source talisman --date "$DATE" || {
    echo "⚠️  Projector failed for $DATE"
    continue
  }
  
  # Grade the picks from ESPN
  echo "📈 Grading picks from ESPN..."
  npx tsx "server/cli/grade_yesterday.ts" "$DATE" || {
    echo "⚠️  Grading failed for $DATE (game scores may not be final)"
    continue
  }
  
  echo "✓ Completed $DATE"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Backfill complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Now running calibration analysis..."
npx tsx "server/cli/analyze_calibration.ts"
