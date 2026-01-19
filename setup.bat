@echo off
REM Simple setup launcher - just runs the PowerShell script

echo.
echo Checking administrator privileges...

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Must run as Administrator
    echo Right-click this file and select "Run as Administrator"
    pause
    exit /b 1
)

echo Administrator confirmed.
echo.
echo Starting setup...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"

echo.
echo ════════════════════════════════════════════
echo Done. Press any key to close...
echo ════════════════════════════════════════════
pause >nul
