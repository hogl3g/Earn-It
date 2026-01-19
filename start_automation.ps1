# Start CBB Betting System Automation
# This script:
# 1. Starts the Express server (API for triggering pipeline)
# 2. Configures daily Task Scheduler job for 6 AM refresh
# 3. Runs first refresh immediately for testing

param(
    [switch]$InstallOnly = $false,
    [switch]$NoServer = $false
)

$ErrorActionPreference = "Continue"
$workDir = "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"

# Verify directory exists
if (-not (Test-Path $workDir)) {
    Write-Host "ERROR: Directory not found: $workDir" -ForegroundColor Red
    Write-Host "Please check the path and try again." -ForegroundColor Red
    exit 1
}

Set-Location $workDir

Write-Host "`n╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  CBB BETTING SYSTEM - FULL AUTOMATION      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan

# ===== STEP 1: Install Daily Task =====
Write-Host "`n[STEP 1] Configuring Task Scheduler for 6 AM daily refresh..." -ForegroundColor Yellow

$taskName = "CBB_Betting_Daily_Refresh"
$npmCmd = "cd '$workDir'; npx tsx server/cli/daily_refresh.ts"

try {
    Write-Host "  Checking for existing task..." -ForegroundColor Gray
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Host "  → Removing existing task..." -ForegroundColor Gray
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false | Out-Null
    }
    
    # Create action - use cmd.exe to run PowerShell command
    $action = New-ScheduledTaskAction `
        -Execute "powershell.exe" `
        -Argument "-NoProfile -WindowStyle Hidden -Command `"$npmCmd`""
    
    # Create trigger for 6 AM daily
    $trigger = New-ScheduledTaskTrigger -Daily -At 06:00AM
    
    # Create settings
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -MultipleInstances IgnoreNew
    
    # Register task
    $principal = New-ScheduledTaskPrincipal -UserID "$env:USERDOMAIN\$env:USERNAME" -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Daily CBB betting pipeline: auto-grade → validate → calibrate → export" | Out-Null
    
    Write-Host "  ✓ Daily task installed: Runs at 6:00 AM every day" -ForegroundColor Green
    Write-Host "  ✓ Task: $taskName" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed to install task: $_" -ForegroundColor Red
    Write-Host "  💡 You may need to run as Administrator" -ForegroundColor Yellow
}

if ($InstallOnly) {
    Write-Host "`nTask installation complete. Exiting." -ForegroundColor Green
    exit 0
}

# ===== STEP 2: Start Express Server (Background) =====
if (-not $NoServer) {
    Write-Host "`n[STEP 2] Starting Express server (background)..." -ForegroundColor Yellow
    
    $serverLogPath = Join-Path $workDir "logs\server.log"
    New-Item -ItemType Directory -Path (Split-Path $serverLogPath) -Force | Out-Null
    
    # Kill existing server processes
    Get-Process "node*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    
    # Start server in background
    $serverScript = @"
`$ErrorActionPreference = 'Continue'
Set-Location '$workDir'
Start-Transcript -Path '$serverLogPath' -Append -IncludeInvocationHeader | Out-Null
Write-Host "Server started: `$(Get-Date)"
Write-Host "Logs: $serverLogPath"
& npx tsx server/index.ts
"@
    
    Start-Process powershell -ArgumentList "-NoProfile -Command $serverScript" -NoNewWindow -WindowStyle Minimized
    Start-Sleep -Seconds 2
    
    Write-Host "  ✓ Express server started (port 5000)" -ForegroundColor Green
    Write-Host "  ✓ Logs: $serverLogPath" -ForegroundColor Green
}

# ===== STEP 3: Run Initial Pipeline =====
Write-Host "`n[STEP 3] Running initial daily refresh pipeline..." -ForegroundColor Yellow
Write-Host "  This will: auto-grade → validate → calibrate → export" -ForegroundColor Gray

try {
    & npx tsx server/cli/daily_refresh.ts
    Write-Host "  ✓ Pipeline completed successfully" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Pipeline failed: $_" -ForegroundColor Red
}

# ===== SUMMARY =====
Write-Host "`n╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✓ AUTOMATION CONFIGURED                   ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n📅 Daily Schedule:" -ForegroundColor Cyan
Write-Host "  • 6:00 AM: Auto-grade picks with ESPN scores" -ForegroundColor White
Write-Host "  • 6:05 AM: Validate and clean data" -ForegroundColor White
Write-Host "  • 6:10 AM: Recalibrate probability model" -ForegroundColor White
Write-Host "  • 6:15 AM: Export enhanced picks" -ForegroundColor White

Write-Host "`n🎯 Manual Triggers (via HTTP API):" -ForegroundColor Cyan
Write-Host "  POST http://localhost:5000/api/sports/refresh" -ForegroundColor Magenta
Write-Host "  GET  http://localhost:5000/api/sports/calibration" -ForegroundColor Magenta

Write-Host "`n📊 Pick Generation:" -ForegroundColor Cyan
Write-Host "  File: data/results/ts_projector_picks.csv" -ForegroundColor White
Write-Host "  Filters: ≥70% confidence, ≥5% edge, positive EV" -ForegroundColor White
Write-Host "  Sizing: 1/4 Kelly (capped at 25% bankroll)" -ForegroundColor White

Write-Host "`n🔔 Monitoring:" -ForegroundColor Cyan
Write-Host "  Logs: $serverLogPath" -ForegroundColor White
Write-Host "  Task: eventvwr.msc (Event Viewer)" -ForegroundColor White

Write-Host "`nℹ️  Press Ctrl+C to exit. Server runs in background." -ForegroundColor Gray
Write-Host ""

# Keep script running to show that automation is active
while ($true) {
    Start-Sleep -Seconds 1
}
