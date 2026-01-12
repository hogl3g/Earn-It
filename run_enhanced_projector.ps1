<#
run_enhanced_projector.ps1

Runs the enhanced projector with Luke Benz NCAA_Hoops methodology improvements:
- Home court advantage modeling
- Time-weighted historical ratings
- Logistic regression win probability
- Tempo-free offensive/defensive ratings
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Note($m){ Write-Host $m -ForegroundColor Cyan }
function Write-Ok($m){ Write-Host $m -ForegroundColor Green }
function Write-Err($m){ Write-Host $m -ForegroundColor Red }

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

Write-Note "==================================================================="
Write-Note "ENHANCED PROJECTOR - NCAA Basketball Betting Model"
Write-Note "Using Luke Benz methodology: HCA, time-weighting, logistic regression"
Write-Note "==================================================================="

# Check for Node
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Err "Node.js not found. Please install Node.js LTS from https://nodejs.org"
    exit 1
}

Write-Ok "Node found: $($node.Path)"

# Install dependencies if needed
if (Test-Path package.json) {
    if (-not (Test-Path node_modules)) {
        Write-Note "Installing npm dependencies..."
        npm install
    }
}

# Check for tsx (TypeScript executor)
$tsx = Get-Command tsx -ErrorAction SilentlyContinue
if (-not $tsx) {
    Write-Note "Installing tsx globally..."
    npm install -g tsx
}

# Set environment variables if not already set
if (-not $env:BANKROLL) {
    $env:BANKROLL = "1000"
    Write-Note "Using default bankroll: `$1000"
}

# Run the enhanced projector
Write-Note "`nRunning enhanced projector..."
Write-Note "Command: tsx server/cli/sports_app_enhanced.ts"

try {
    tsx server/cli/sports_app_enhanced.ts @args
    Write-Ok "`n✅ Enhanced projector completed successfully!"
    Write-Ok "Results saved to: data/results/enhanced_projector_picks.csv"
    Write-Ok "Also copied to: public/ts_projector_picks.csv (for GitHub Pages)"
    
    # Run HTML generator if it exists
    if (Test-Path scripts/generate_picks_html.mjs) {
        Write-Note "`nGenerating HTML page..."
        node scripts/generate_picks_html.mjs
        Write-Ok "HTML page updated: public/index.html"
    }
} catch {
    Write-Err "Error running enhanced projector: $_"
    exit 1
}
