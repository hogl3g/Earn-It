@echo off
setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║       CBB Betting System - Full Automation Setup           ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Checking permissions...

REM Check if running as admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: This script must run as Administrator!
    echo.
    echo SOLUTION:
    echo 1. Right-click this file
    echo 2. Select "Run as Administrator"
    echo 3. Click "Yes" when prompted
    echo.
    pause
    exit /b 1
)

echo ✓ Administrator privileges confirmed
echo.
echo Starting PowerShell automation script...
echo.

REM Run PowerShell with the automation script
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_automation.ps1"

if %errorlevel% equ 0 (
    echo.
    echo ═══════════════════════════════════════════════════════════
    echo ✓ AUTOMATION SETUP COMPLETE
    echo ═══════════════════════════════════════════════════════════
    echo.
    echo Your system will now:
    echo • Run daily at 6:00 AM automatically
    echo • Fetch ESPN scores and grade picks
    echo • Generate new picks for today
    echo.
    echo Check your picks file:
    echo data/results/ts_projector_picks.csv
    echo.
) else (
    echo.
    echo ═══════════════════════════════════════════════════════════
    echo ✗ SETUP FAILED - Error occurred
    echo ═══════════════════════════════════════════════════════════
    echo.
    echo Check the error message above for details
    echo.
)

echo Press any key to close this window...
pause >nul

