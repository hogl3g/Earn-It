# Daily Projector Automation
# Runs at 6 AM daily: grades yesterday, generates today's picks, pushes to GitHub

$ErrorActionPreference = "Continue"
$ProjectRoot = "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"
Set-Location $ProjectRoot

$LogFile = "$ProjectRoot\automation.log"
function Log {
    param($Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$Timestamp - $Message" | Tee-Object -FilePath $LogFile -Append
}

Log "=== Starting daily automation ==="

# Get yesterday's date
$Yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
Log "Yesterday's date: $Yesterday"

# Step 1: Grade yesterday's games using Sports Reference
Log "Step 1: Grading yesterday's games ($Yesterday)..."
try {
    $Output = npx tsx server/cli/grade_with_sportsref.ts $Yesterday 2>&1
    Log "Grading output: $Output"
} catch {
    Log "ERROR grading: $_"
}

# Step 2: Generate today's picks (using Talisman Red as preferred source)
Log "Step 2: Generating today's picks..."
try {
    $Output = npx tsx "server/cli/sports app 1.ts" --source talisman 2>&1
    Log "Picks generation output: $Output"
} catch {
    Log "ERROR generating picks: $_"
}

# Step 3: Regenerate HTML
Log "Step 3: Regenerating HTML..."
try {
    $Output = node scripts/generate_picks_html.mjs 2>&1
    Log "HTML generation output: $Output"
} catch {
    Log "ERROR generating HTML: $_"
}

# Step 4: Commit and push to GitHub
Log "Step 4: Pushing to GitHub..."
try {
    git add data/results/*.json public/index.html data/results/*.csv 2>&1 | Out-Null
    
    $CommitMsg = "Daily auto-update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    git commit -m $CommitMsg 2>&1 | Out-Null
    
    $PushOutput = git push 2>&1
    Log "Push output: $PushOutput"
} catch {
    Log "ERROR pushing to GitHub: $_"
}

Log "=== Daily automation complete ==="
