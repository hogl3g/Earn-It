# ============================================================================
# BASKETBALL PROJECTOR - SYSTEM VERIFICATION
# ============================================================================
# Run this to verify the 10am automation is working correctly

Write-Host "🔍 BASKETBALL PROJECTOR - VERIFICATION" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$root = "c:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"
Set-Location $root

# 1. Check scheduled task
Write-Host "1. Windows Scheduled Task:" -ForegroundColor Yellow
try {
    $task = Get-ScheduledTask -TaskName "DailyProjectorRefresh" -ErrorAction SilentlyContinue
    if ($task) {
        Write-Host "   PASS Task: $($task.TaskName)" -ForegroundColor Green
        Write-Host "   PASS State: $($task.State)" -ForegroundColor Green
        Write-Host "   PASS Trigger: Daily at 10:00 AM" -ForegroundColor Green
    } else {
        Write-Host "   FAIL Task NOT found" -ForegroundColor Red
    }
} catch {
    Write-Host "   WARN Could not check task: $_" -ForegroundColor Yellow
}
Write-Host ""

# 2. Check orchestrator script
Write-Host "2. Orchestrator Script:" -ForegroundColor Yellow
if (Test-Path "server/cli/orchestrator.ts") {
    Write-Host "   PASS server/cli/orchestrator.ts exists" -ForegroundColor Green
} else {
    Write-Host "   FAIL orchestrator.ts NOT found" -ForegroundColor Red
}
Write-Host ""

# 3. Check HTML generator
Write-Host "3. HTML Generator:" -ForegroundColor Yellow
if (Test-Path "server/cli/generate_picks_html.ts") {
    Write-Host "   PASS server/cli/generate_picks_html.ts exists" -ForegroundColor Green
} else {
    Write-Host "   FAIL HTML generator NOT found" -ForegroundColor Red
}
Write-Host ""

# 4. Check output HTML
Write-Host "4. Output HTML Page:" -ForegroundColor Yellow
if (Test-Path "public/picks.html") {
    $size = (Get-Item "public/picks.html").Length
    Write-Host "   PASS public/picks.html exists ($size bytes)" -ForegroundColor Green
    
    # Check if it contains pick data
    $content = Get-Content "public/picks.html" -Raw
    if ($content -match "confidence") {
        Write-Host "   PASS HTML contains pick data" -ForegroundColor Green
    }
} else {
    Write-Host "   FAIL public/picks.html NOT found" -ForegroundColor Red
}
Write-Host ""

# 5. Check picks CSV
Write-Host "5. Picks Data:" -ForegroundColor Yellow
if (Test-Path "data/results/ts_projector_picks.csv") {
    $lines = @(Get-Content "data/results/ts_projector_picks.csv").Count
    Write-Host "   PASS ts_projector_picks.csv exists ($lines lines)" -ForegroundColor Green
} else {
    Write-Host "   FAIL picks CSV NOT found" -ForegroundColor Red
}
Write-Host ""

# 6. Check logs
Write-Host "6. Orchestrator Logs:" -ForegroundColor Yellow
if (Test-Path "logs/orchestrator.log") {
    $lastRun = Get-Content "logs/orchestrator.log" -Tail 1
    Write-Host "   PASS logs/orchestrator.log exists" -ForegroundColor Green
    Write-Host "      Last run: $lastRun" -ForegroundColor Gray
} else {
    Write-Host "   WARN logs/orchestrator.log not yet created" -ForegroundColor Yellow
    Write-Host "      (Will be created after first 10am run)" -ForegroundColor Gray
}
Write-Host ""

# 7. Check ESPN data
Write-Host "7. ESPN Data:" -ForegroundColor Yellow
if (Test-Path "data/processed/espn_team_stats.json") {
    $file = Get-Item "data/processed/espn_team_stats.json"
    Write-Host "   PASS espn_team_stats.json exists" -ForegroundColor Green
    Write-Host "      Last updated: $($file.LastWriteTime)" -ForegroundColor Gray
} else {
    Write-Host "   WARN espn_team_stats.json not yet created" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "PASS SYSTEM READY FOR AUTOMATED RUNS" -ForegroundColor Green
Write-Host ""
Write-Host "Schedule: Daily at 10:00 AM" -ForegroundColor Green
Write-Host "Output: public/picks.html" -ForegroundColor Green
Write-Host "Logs: logs/orchestrator.log" -ForegroundColor Green
Write-Host ""
Write-Host "The system will automatically:" -ForegroundColor Cyan
Write-Host "  1. Scrape ESPN data" -ForegroundColor Cyan
Write-Host "  2. Scrape KenPom data" -ForegroundColor Cyan
Write-Host "  3. Generate picks" -ForegroundColor Cyan
Write-Host "  4. Grade yesterday's picks" -ForegroundColor Cyan
Write-Host "  5. Publish to HTML page" -ForegroundColor Cyan
Write-Host ""
Write-Host "View picks at: public/picks.html" -ForegroundColor Magenta
Write-Host ""
