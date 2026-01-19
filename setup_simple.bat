@echo off
REM Pure batch solution - no PowerShell complications
setlocal enabledelayedexpansion

echo.
echo Checking administrator privileges...
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Must run as Administrator
    pause
    exit /b 1
)

echo Administrator confirmed.
echo.

cd /d "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"

echo ════════════════════════════════════════════
echo CBB Betting System - Setup
echo ════════════════════════════════════════════
echo.

REM Create the batch file that Task Scheduler will run
echo Creating scheduled task runner...

set "taskBat=%CD%\run_daily_task.bat"

(
    echo @echo off
    echo cd /d "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"
    echo npx tsx server/cli/daily_refresh.ts
) > "%taskBat%"

echo.
echo Registering Task Scheduler job...

REM Delete existing task if it exists
tasklist /FI "TASKNAME eq CBB_Betting_Daily_Refresh" 2>NUL | find /I /N "CBB_Betting_Daily_Refresh">NUL
if %errorlevel% equ 0 (
    echo Removing existing task...
    schtasks /delete /tn CBB_Betting_Daily_Refresh /f >nul 2>&1
)

REM Create new task - runs at 6 AM daily
schtasks /create /tn CBB_Betting_Daily_Refresh /tr "%taskBat%" /sc daily /st 06:00 /f >nul 2>&1

if %errorlevel% equ 0 (
    echo ✓ Task created successfully
) else (
    echo ✗ Failed to create task
    pause
    exit /b 1
)

echo.
echo ════════════════════════════════════════════
echo Running first pipeline test...
echo ════════════════════════════════════════════
echo.

npx tsx server/cli/daily_refresh.ts

echo.
echo ════════════════════════════════════════════
echo ✓ Setup Complete!
echo ════════════════════════════════════════════
echo.
echo Daily Task Scheduled at 6:00 AM
echo Output file: data/results/ts_projector_picks.csv
echo.
echo Press SPACEBAR when done reading...
echo.
pause
pause
pause
