# Backfill missing picks and grades for Jan 12-15, 2026
# 
# This script regenerates projector picks for the specified dates,
# then attempts to fetch grades from ESPN
#
# Usage: .\backfill_missing_dates.ps1

$ErrorActionPreference = "Continue"

Write-Host "🔄 Backfilling missing dates (Jan 12-15)..." -ForegroundColor Cyan
Write-Host ""

$dates = @("2026-01-12", "2026-01-13", "2026-01-14", "2026-01-15")

foreach ($date in $dates) {
  Write-Host ""
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
  Write-Host "Processing $date" -ForegroundColor Cyan
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
  
  # Run projector for this date
  Write-Host "📊 Generating picks for $date..." -ForegroundColor White
  try {
    & npx tsx "server/cli/sports app 1.ts" --source talisman --date $date
  } catch {
    Write-Host "⚠️  Projector failed for $date" -ForegroundColor Yellow
    Continue
  }
  
  # Grade the picks from ESPN
  Write-Host "📈 Grading picks from ESPN..." -ForegroundColor White
  try {
    & npx tsx "server/cli/grade_yesterday.ts" $date
  } catch {
    Write-Host "⚠️  Grading failed for $date (game scores may not be final)" -ForegroundColor Yellow
    Continue
  }
  
  Write-Host "✓ Completed $date" -ForegroundColor Green
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "✓ Backfill complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "Now running calibration analysis..." -ForegroundColor Cyan
& npx tsx "server/cli/analyze_calibration.ts"

Write-Host ""
Write-Host "Regenerating HTML with updated grades..." -ForegroundColor Cyan
& node scripts/generate_picks_html.mjs

Write-Host ""
Write-Host "✓ All done!" -ForegroundColor Green
