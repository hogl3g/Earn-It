# CBB Betting Pipeline - Automation Guide

## Automation Options

### Option 1: Windows Task Scheduler (Recommended for Production)

Run the setup script as Administrator:

```powershell
# Navigate to project
cd C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It

# Run setup (as Administrator)
.\setup_daily_task.ps1
```

**What it does:**
- Runs `daily_refresh.ts` every day at 6:00 AM
- Auto-fix → Validate → Recalibrate → Export
- Logs saved to `data/results/clean/logs/`

**Manage the task:**
```powershell
# View task details
Get-ScheduledTask -TaskName "CBB_Betting_Daily_Refresh" | Format-List

# Run manually now
Start-ScheduledTask -TaskName "CBB_Betting_Daily_Refresh"

# Disable temporarily
Disable-ScheduledTask -TaskName "CBB_Betting_Daily_Refresh"

# Enable again
Enable-ScheduledTask -TaskName "CBB_Betting_Daily_Refresh"

# Remove task
Unregister-ScheduledTask -TaskName "CBB_Betting_Daily_Refresh" -Confirm:$false
```

### Option 2: API Endpoints (Recommended for Webhooks/Manual Triggers)

Start the server:
```powershell
npm run dev
```

**Trigger pipeline refresh:**
```bash
POST http://localhost:5000/api/sports/refresh
```

Response:
```json
{
  "success": true,
  "duration_ms": 8300,
  "message": "Pipeline refresh completed",
  "output": "...",
  "errors": null
}
```

**Get calibration status:**
```bash
GET http://localhost:5000/api/sports/calibration
```

Response:
```json
{
  "success": true,
  "output": "📊 CALIBRATION STATUS DASHBOARD..."
}
```

**Use with curl:**
```powershell
# Trigger refresh
curl -X POST http://localhost:5000/api/sports/refresh

# Get status
curl http://localhost:5000/api/sports/calibration
```

**Webhook integration:**
- Set up ESPN or external service to POST to `/api/sports/refresh` when new games are graded
- Or schedule with GitHub Actions, Zapier, etc.

### Option 3: Manual Runs

**Full pipeline:**
```powershell
cd C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It
npx tsx server/cli/daily_refresh.ts
```

**Individual steps:**
```powershell
# Just auto-fix
npx tsx server/cli/auto_fix_data_issues.ts

# Just validate
npx tsx server/cli/validate_data.ts

# Just recalibrate
npx tsx server/cli/recalibrate_probabilities.ts

# Just export enhanced picks
npx tsx server/cli/export_enhanced_picks.ts

# Check calibration status
npx tsx server/cli/calibration_status.ts
```

## Outputs

All tools write to `data/results/clean/`:

- `grades_YYYYMMDD.json` - Cleaned grade files
- `ts_projector_picks.csv` - Cleaned picks
- `prob_calibration.json` - Calibration parameters
- `recalibrated_picks.csv` - Picks with calibrated probabilities
- `enhanced_picks_with_ci.csv` - Full export with CIs, Kelly, ROI
- `data_validation_report.json` - Validation issues
- `logs/pipeline_YYYY-MM-DD.json` - Daily pipeline execution logs

## Monitoring

**Check logs:**
```powershell
# View latest pipeline log
Get-Content data/results/clean/logs/pipeline_*.json | Select-Object -Last 1 | ConvertFrom-Json | ConvertTo-Json -Depth 10

# Check calibration health
npx tsx server/cli/calibration_status.ts
```

**Key metrics to watch:**
- Calibration sample size (target: 50+)
- Calibration error (target: <10%)
- Validation criticals (should be minimal after auto-fix)
- Pipeline execution time (should be <15s)

## Troubleshooting

**Task not running:**
```powershell
# Check task status
Get-ScheduledTask -TaskName "CBB_Betting_Daily_Refresh"

# View task history
Get-ScheduledTask -TaskName "CBB_Betting_Daily_Refresh" | Get-ScheduledTaskInfo

# Check last run result (0 = success)
(Get-ScheduledTaskInfo -TaskName "CBB_Betting_Daily_Refresh").LastTaskResult
```

**API errors:**
- Ensure server is running: `npm run dev`
- Check server logs for execution errors
- Verify Node.js and npx are in PATH

**Calibration not improving:**
- Need more graded games (check `calibration_status.ts`)
- Verify picks dates overlap with grades dates
- Review validation report for data quality issues
