# SETUP INSTRUCTIONS FOR DAILY PROJECTOR AUTOMATION
# Run this ONCE in PowerShell as Administrator to create the scheduled task

$TaskPath = "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It\run_orchestrator.bat"
$TaskAction = New-ScheduledTaskAction -Execute $TaskPath
$TaskTrigger = New-ScheduledTaskTrigger -Daily -At 10:00AM
$TaskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Remove old task if exists
Unregister-ScheduledTask -TaskName "DailyProjectorRefresh" -Confirm:$false -ErrorAction SilentlyContinue

# Create new task
Register-ScheduledTask `
    -TaskName "DailyProjectorRefresh" `
    -Action $TaskAction `
    -Trigger $TaskTrigger `
    -Settings $TaskSettings `
    -RunLevel Highest

Write-Host "✅ Task created successfully!"
Write-Host "Daily Projector will run at 10:00 AM every day"
Write-Host ""
Write-Host "5-step pipeline:"
Write-Host "1. ESPN Scraper - fetches team stats and Vegas lines"
Write-Host "2. KenPom Scraper - fetches rankings and efficiency metrics"
Write-Host "3. Daily Automation - merges data and generates picks"
Write-Host "4. Auto-Grader - grades yesterday's picks"
Write-Host "5. HTML Generator - updates public display with picks and record"
