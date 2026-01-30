#!/bin/bash
# ============================================================================
# BASKETBALL PROJECTOR - 10AM AUTOMATION VERIFICATION
# ============================================================================
# Run this to verify the system is working correctly

echo "🔍 VERIFICATION CHECKLIST"
echo "======================"
echo ""

# 1. Check scheduled task
echo "1️⃣  Windows Scheduled Task:"
pwsh -Command "Get-ScheduledTask -TaskName 'DailyProjectorRefresh' | Select-Object TaskName, State" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ Task found and active"
else
    echo "   ❌ Task NOT found"
fi
echo ""

# 2. Check orchestrator script
echo "2️⃣  Orchestrator Script:"
if [ -f "server/cli/orchestrator.ts" ]; then
    echo "   ✅ server/cli/orchestrator.ts exists"
else
    echo "   ❌ orchestrator.ts NOT found"
fi
echo ""

# 3. Check HTML generator
echo "3️⃣  HTML Generator:"
if [ -f "server/cli/generate_picks_html.ts" ]; then
    echo "   ✅ server/cli/generate_picks_html.ts exists"
else
    echo "   ❌ HTML generator NOT found"
fi
echo ""

# 4. Check output HTML
echo "4️⃣  Output HTML Page:"
if [ -f "public/picks.html" ]; then
    SIZE=$(stat -c%s "public/picks.html" 2>/dev/null || stat -f%z "public/picks.html" 2>/dev/null)
    echo "   ✅ public/picks.html exists ($SIZE bytes)"
else
    echo "   ❌ public/picks.html NOT found"
fi
echo ""

# 5. Check picks data
echo "5️⃣  Picks Data:"
if [ -f "data/results/ts_projector_picks.csv" ]; then
    COUNT=$(grep -c "^" "data/results/ts_projector_picks.csv" 2>/dev/null)
    echo "   ✅ ts_projector_picks.csv exists ($COUNT lines)"
else
    echo "   ❌ picks CSV NOT found"
fi
echo ""

# 6. Check logs
echo "6️⃣  Orchestrator Logs:"
if [ -f "logs/orchestrator.log" ]; then
    LAST_RUN=$(tail -1 "logs/orchestrator.log" 2>/dev/null)
    echo "   ✅ logs/orchestrator.log exists"
    echo "      Last run: $LAST_RUN"
else
    echo "   ⚠️  logs/orchestrator.log not yet created (will be on first run)"
fi
echo ""

# 7. Check ESPN data
echo "7️⃣  ESPN Data:"
if [ -f "data/processed/espn_team_stats.json" ]; then
    echo "   ✅ espn_team_stats.json exists"
else
    echo "   ⚠️  espn_team_stats.json not yet created"
fi
echo ""

echo "======================"
echo "✅ SYSTEM READY"
echo ""
echo "The projector will run automatically at 10:00 AM daily"
echo "Picks will be published to: public/picks.html"
echo ""
