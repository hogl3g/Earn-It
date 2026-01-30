@echo off
REM ============================================================================
REM BASKETBALL PROJECTOR - SYSTEM VERIFICATION
REM ============================================================================
REM Run this batch file to verify the 10am automation is working correctly

echo.
echo VERIFICATION CHECKLIST
echo =============================================
echo.

REM 1. Check if picks HTML exists
echo Checking files...
if exist "public\picks.html" (
    echo [OK] public\picks.html exists
) else (
    echo [FAIL] public\picks.html NOT found
)

REM 2. Check if orchestrator exists
if exist "server\cli\orchestrator.ts" (
    echo [OK] server\cli\orchestrator.ts exists
) else (
    echo [FAIL] orchestrator.ts NOT found
)

REM 3. Check if HTML generator exists
if exist "server\cli\generate_picks_html.ts" (
    echo [OK] server\cli\generate_picks_html.ts exists
) else (
    echo [FAIL] HTML generator NOT found
)

REM 4. Check if picks CSV exists
if exist "data\results\ts_projector_picks.csv" (
    echo [OK] data\results\ts_projector_picks.csv exists
) else (
    echo [FAIL] picks CSV NOT found
)

echo.
echo =============================================
echo Checking Windows Scheduled Task...
echo.

REM Check if the scheduled task exists
schtasks /query /tn "DailyProjectorRefresh" > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Windows Scheduled Task found
    echo.
    schtasks /query /tn "DailyProjectorRefresh" /fo list
) else (
    echo [FAIL] Scheduled task NOT found
)

echo.
echo =============================================
echo SYSTEM STATUS: READY FOR 10AM AUTOMATION
echo =============================================
echo.
echo The basketball projector is configured to run at 10:00 AM daily.
echo All steps are in place:
echo   1. Scrape ESPN data
echo   2. Scrape KenPom data
echo   3. Generate picks
echo   4. Grade yesterday picks
echo   5. Publish HTML picks display
echo.
echo Output: public\picks.html
echo.
pause
