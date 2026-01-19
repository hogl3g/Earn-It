@echo off
REM Diagnostic script to check why automation isn't working
REM Run this to debug issues

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          CBB BETTING - SETUP DIAGNOSTIC                    ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo [CHECK 1] Verifying directory structure...
if exist "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It\server\cli\daily_refresh.ts" (
    echo ✓ daily_refresh.ts found
) else (
    echo ✗ daily_refresh.ts NOT found
)

if exist "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It\start_automation.ps1" (
    echo ✓ start_automation.ps1 found
) else (
    echo ✗ start_automation.ps1 NOT found
)

echo.
echo [CHECK 2] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Node.js is installed
    node --version
) else (
    echo ✗ Node.js NOT found - required for automation
    echo   Install from: https://nodejs.org
)

echo.
echo [CHECK 3] Checking npm packages...
cd /d "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"
if exist "node_modules" (
    echo ✓ node_modules directory found
) else (
    echo ✗ node_modules NOT found
    echo   Run: npm install
)

echo.
echo [CHECK 4] Checking administrator privileges...
net session >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Running as Administrator
) else (
    echo ✗ NOT running as Administrator
    echo   Right-click and select "Run as Administrator"
)

echo.
echo [CHECK 5] Testing PowerShell execution...
powershell -NoProfile -Command "Write-Host 'PowerShell works'" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ PowerShell execution working
) else (
    echo ✗ PowerShell execution failed
)

echo.
echo ════════════════════════════════════════════════════════════
echo.
echo If you see any ✗ marks above, that's the issue.
echo.
echo Common fixes:
echo 1. Install Node.js from https://nodejs.org
echo 2. Run Command Prompt as Administrator
echo 3. In the Earn-It folder, run: npm install
echo 4. Then try run_automation.bat again
echo.
echo ════════════════════════════════════════════════════════════
echo.
pause
