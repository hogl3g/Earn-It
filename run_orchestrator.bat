@echo off
REM Daily Projector Orchestration
REM Runs at 10 AM daily via Windows Task Scheduler

setlocal enabledelayedexpansion
cd /d "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"

REM Create logs directory if needed
if not exist logs mkdir logs

REM Log execution with timestamp
set "timestamp=%date% %time%"
echo. >> logs\orchestrator_runs.log
echo ========================================== >> logs\orchestrator_runs.log
echo Run started: %timestamp% >> logs\orchestrator_runs.log
echo ========================================== >> logs\orchestrator_runs.log

REM Run orchestrator and capture output
npx tsx server/cli/orchestrator.ts >> logs\orchestrator_runs.log 2>&1

if %errorlevel% neq 0 (
    echo Orchestrator failed with exit code %errorlevel% >> logs\orchestrator_runs.log
    exit /b 1
) else (
    echo Orchestrator completed successfully >> logs\orchestrator_runs.log
)

exit /b 0
