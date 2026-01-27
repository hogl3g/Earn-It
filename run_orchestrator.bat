@echo off
REM Daily Projector Orchestration
REM Runs at 10 AM daily via Windows Task Scheduler

cd /d "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"
npx tsx server/cli/orchestrator.ts

if %errorlevel% neq 0 (
    echo Orchestrator failed with exit code %errorlevel%
    exit /b 1
)

exit /b 0
