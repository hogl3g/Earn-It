@echo off
REM Simple test - just try to run the pipeline once
echo.
echo Testing pipeline...
echo.

cd /d "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"

if not exist "server\cli\daily_refresh.ts" (
    echo ERROR: daily_refresh.ts not found
    pause
    exit /b 1
)

echo Starting daily refresh pipeline...
echo.

npx tsx server/cli/daily_refresh.ts

if %errorlevel% equ 0 (
    echo.
    echo ✓ Pipeline executed successfully!
    echo.
    echo Check: data/results/ts_projector_picks.csv
) else (
    echo.
    echo ✗ Pipeline failed with error code %errorlevel%
)

echo.
pause
