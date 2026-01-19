# CBB Betting System - Full Automation Setup

## ✅ What's Running Automatically

Your betting system is now **100% fully automatic**. Here's what happens:

### 🕐 Daily Schedule (6:00 AM)
1. **Auto-Grade** — ESPN API fetches completed game scores and grades yesterday's picks
2. **Auto-Validate** — Data quality checks and anomaly detection
3. **Auto-Calibrate** — Probability model recalibration based on graded games
4. **Auto-Export** — Enhanced picks with confidence intervals and Kelly sizing
5. **Auto-Pick** — Projector generates picks with 70%+ confidence, ≥5% edge, quarter-Kelly sizing

### 🚀 Starting Automation

#### Option 1: Full Setup (Recommended)
1. Right-click `run_automation.bat`
2. Select **Run as Administrator**
3. This will:
   - Install the 6 AM daily Task Scheduler job
   - Start the Express server (background process)
   - Run first pipeline immediately for testing

#### Option 2: Task Scheduler Only
1. Right-click `install_scheduler.bat`
2. Select **Run as Administrator**
3. Task will run daily at 6:00 AM even if no server is running

#### Option 3: Manual Daily Refresh
```powershell
cd "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"
npx tsx server/cli/daily_refresh.ts
```

### 🎛️ Manual API Triggers

Even with Task Scheduler, you can trigger manually via HTTP:

```bash
# Trigger immediate refresh
curl -X POST http://localhost:5000/api/sports/refresh

# Check calibration status
curl http://localhost:5000/api/sports/calibration
```

### 📊 Output Files

All picks are saved to:
- **Picks:** `data/results/ts_projector_picks.csv`
- **Enhanced Picks:** `data/results/enhanced_projector_picks.csv`
- **Summary:** `server/cli/last_projector_picks.txt`

### 📋 Quality Filters (All Must Pass)

Every pick in the output meets:
- ✅ ≥70% calibrated confidence
- ✅ ≥5% edge vs market
- ✅ Positive expected value
- ✅ 1/4 Kelly sizing (max 25% of bankroll)

**If no picks qualify**, the system outputs "NO PICKS TODAY" and passes.

### 📈 How Accuracy Improves Over Time

```
Week 1:  Calibration degenerate (few samples) → Uses raw probabilities
Week 2:  10-15 graded games → Calibration becomes usable
Week 3+: 30-50+ graded games → Calibration stable and accurate
Week 4+: 80+ graded games → Model highly confident
```

### 🔍 Monitoring

#### Check Task Status
```powershell
Get-ScheduledTask -TaskName "CBB_Betting_Daily_Refresh" | Select-Object State, LastRunTime
```

#### View Server Logs
```
logs/server.log
```

#### View Pipeline Logs
```
data/results/clean/logs/pipeline_YYYY-MM-DD.json
```

### 🛑 If Something Goes Wrong

#### Task Won't Install
- Ensure you ran as Administrator
- Check Windows Task Scheduler: `taskschd.msc`

#### Server Won't Start
```powershell
# Kill any hanging Node processes
Get-Process "node*" | Stop-Process -Force

# Start fresh
.\run_automation.bat
```

#### Pipeline Fails
Check the JSON log:
```powershell
Get-Content "data/results/clean/logs/pipeline_$(Get-Date -Format 'yyyy-MM-dd').json" | ConvertFrom-Json
```

### 🎯 System Architecture

```
[6:00 AM] Task Scheduler triggers:
    ↓
[6:00] auto_grade_picks.ts
    ↓ (fetch ESPN scores)
[6:05] auto_fix_data_issues.ts
    ↓ (normalize dates/teams)
[6:10] recalibrate_probabilities.ts
    ↓ (fit calibration line)
[6:15] export_enhanced_picks.ts
    ↓ (add confidence intervals)
[6:20] sports app 1.ts
    ↓ (generate tomorrow's picks)
Results saved to: data/results/
```

### ⚙️ Environment Variables

To customize, set before running:

```powershell
$env:BANKROLL = "2000"           # Starting bankroll (default: 1000)
$env:NODE_ENV = "production"     # Environment (default: development)
$env:PORT = "5000"               # Server port (default: 5000)
```

### 📞 Questions?

**System is fully automatic. You should never have to touch it again.**

- Picks generated daily at 6+ AM
- Scores auto-fetched from ESPN
- Calibration auto-updates
- Projector self-improves as more games are graded

Just check `data/results/ts_projector_picks.csv` each morning!

---

**Status:** ✅ Fully Automated | 🤖 Zero Manual Work | 📈 Self-Improving
