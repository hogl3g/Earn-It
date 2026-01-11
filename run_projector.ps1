<#
run_projector.ps1

Usage: run this from the repository root (Earn-It) in an elevated PowerShell if you
want the script to install Node via winget. If Node is already installed the script
will skip installation, run `npm install` if needed, and execute the TypeScript
projector script using `tsx`.

This script is idempotent and conservative: it only attempts automated Node install
when `winget` is present. If installation is not possible it prints manual instructions.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Note($m){ Write-Host $m -ForegroundColor Cyan }
function Write-Ok($m){ Write-Host $m -ForegroundColor Green }
function Write-Err($m){ Write-Host $m -ForegroundColor Red }

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

Write-Note "Project root: $root"

# 1) Ensure Node
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Note "Node not found on PATH. Attempting to install via winget..."
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Note "Running: winget install OpenJS.NodeJS.LTS -e"
        try {
            winget install OpenJS.NodeJS.LTS -e --silent
            Write-Ok "winget install finished. If Node is still not found, restart your shell and re-run this script."
        } catch {
            Write-Err "winget install failed: $($_) -- please install Node manually from https://nodejs.org and re-run this script."
            exit 1
        }
    } else {
        Write-Err "winget not available. Please install Node.js (LTS) from https://nodejs.org or via your package manager, then re-run this script."
        exit 1
    }
} else {
    Write-Ok "Node found: $($node.Path)"
}

# 2) Install npm deps (if package.json exists)
if (Test-Path package.json) {
    Write-Note "Installing npm dependencies (npm install)..."
    try {
        npm install
        Write-Ok "npm install completed"
    } catch {
        Write-Err "npm install failed: $($_). Exception"
        exit 1
    }
} else {
    Write-Note "No package.json found at $root — skipping npm install"
}

# 3) Run the TypeScript projector script
$scriptPath = "server/cli/sports app 1.ts"
if (-not (Test-Path $scriptPath)) {
    Write-Err "Script not found: $scriptPath"
    exit 1
}

# Prefer local tsx binary, otherwise use npx (npx should be present with npm)
$localTsx = Join-Path node_modules ".bin/tsx"
if (Test-Path $localTsx) {
    Write-Note "Using local tsx: $localTsx"
    & $localTsx $scriptPath @args
} else {
    Write-Note "Running via npx tsx (may download tsx temporarily)"
    try {
        npx --yes tsx $scriptPath @args
    } catch {
        Write-Err "Failed to run via npx: $($_)"
        exit 1
    }
}

Write-Ok "Projector finished."
