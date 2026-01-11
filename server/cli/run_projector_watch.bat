@echo off
REM Run projector in repo root in watch mode. Usage: run_projector_watch.bat [watchSeconds]
SET WATCH_SECONDS=%1
if "%WATCH_SECONDS%"=="" set WATCH_SECONDS=60
pushd %~dp0\..
REM Ensure npx is available on PATH. Use npx to run tsx which runs the TypeScript CLI.
npx --yes tsx "server/cli/sports app 1.ts" --watch %WATCH_SECONDS%
popd
