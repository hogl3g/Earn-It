param(
  [int]$WatchSeconds = 60,
  [string]$TaskName = "EarnItProjector"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$batPath = Join-Path $scriptDir "run_projector_watch.bat"

if (-not (Test-Path $batPath)) {
  Write-Error "Runner batch not found: $batPath"
  exit 1
}

$action = "cmd /c `"$batPath`" $WatchSeconds"

Write-Output "Creating scheduled task '$TaskName' to run at logon and start projector (watch $WatchSeconds s)."

$cmdArgs = @("/Create", "/SC", "ONLOGON", "/TN", $TaskName, "/TR", $action, "/F")
Write-Output "Running: schtasks $($cmdArgs -join ' ')"

try {
  & schtasks @cmdArgs
} catch {
  Write-Error "schtasks failed. You may need elevated permissions or to run this script in an elevated shell.";
  exit 1
}

Write-Output "Scheduled task '$TaskName' created. It will run at user logon."
