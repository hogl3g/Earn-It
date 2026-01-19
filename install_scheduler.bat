@echo off
REM Install just the Task Scheduler job (no server)
REM Run this as Administrator

echo Installing Daily Task Scheduler Job...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_automation.ps1" -InstallOnly

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Successfully installed! Task will run daily at 6:00 AM
) else (
    echo.
    echo Installation failed. Please run as Administrator.
)

pause
