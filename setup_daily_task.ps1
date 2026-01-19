# Setup Daily Betting Pipeline Refresh
$taskName = "CBB_Betting_Daily_Refresh"
$scriptPath = "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"
$npxPath = (Get-Command npx).Source

$action = New-ScheduledTaskAction -Execute $npxPath -Argument "tsx server/cli/daily_refresh.ts" -WorkingDirectory $scriptPath
$trigger = New-ScheduledTaskTrigger -Daily -At 6:00AM
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

try {
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Host "Task exists. Updating..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
    
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Daily betting pipeline refresh" -User $env:USERNAME -RunLevel Highest
    
    Write-Host "Successfully configured: $taskName" -ForegroundColor Green
    Write-Host "Runs daily at 6:00 AM" -ForegroundColor Cyan
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
    Write-Host "Run as Administrator" -ForegroundColor Yellow
    exit 1
}