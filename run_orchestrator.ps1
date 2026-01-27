# Daily Projector Orchestration
# Runs at 10 AM daily
# 5-step pipeline: ESPN Scraper -> KenPom Scraper -> Daily Automation (picks) -> Auto-Grader -> HTML Generator

$ErrorActionPreference = "Stop"
$ProjectRoot = "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"
Set-Location $ProjectRoot

# Run the orchestrator (handles all 5 steps)
try {
    npx tsx server/cli/orchestrator.ts
    exit 0
} catch {
    Write-Error "Orchestrator failed: $_"
    exit 1
}
