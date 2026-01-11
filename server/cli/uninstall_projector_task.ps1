param(
  [string]$TaskName = "EarnItProjector"
)

Write-Output "Deleting scheduled task '$TaskName' if it exists."
try {
  Start-Process -FilePath schtasks -ArgumentList "/Delete /TN `"$TaskName`" /F" -NoNewWindow -Wait -WindowStyle Hidden -PassThru | Out-Null
  Write-Output "Scheduled task deleted (or did not exist)."
} catch {
  Write-Error "Failed to delete scheduled task: $_"
}
