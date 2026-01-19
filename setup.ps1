# Simple CBB Betting System Setup
# Installs daily task and runs pipeline

$workDir = "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"
Set-Location $workDir

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  CBB BETTING - AUTOMATION SETUP            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "[STEP 1] Installing daily Task Scheduler job..." -ForegroundColor Yellow

$taskName = "CBB_Betting_Daily_Refresh"
$taskPath = "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"

# Remove existing task if present
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "  Removing old task..." -ForegroundColor Gray
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create new task
$psCmd = "cd '$taskPath'; npx tsx server/cli/daily_refresh.ts"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -Command `"$psCmd`"" -WorkingDirectory $taskPath
$trigger = New-ScheduledTaskTrigger -Daily -At 06:00AM
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserID "$env:USERNAME" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Daily CBB betting pipeline"

Write-Host "  ✓ Daily task installed at 6:00 AM" -ForegroundColor Green
Write-Host ""

Write-Host "[STEP 2] Running first pipeline test..." -ForegroundColor Yellow
Write-Host ""

npx tsx server/cli/daily_refresh.ts

Write-Host ""
Write-Host "✓ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Your system will now run daily at 6:00 AM" -ForegroundColor Green
Write-Host "Picks file: data/results/ts_projector_picks.csv" -ForegroundColor Green
Write-Host ""
