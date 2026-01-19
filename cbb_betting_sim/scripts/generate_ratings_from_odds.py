"""Generate synthetic team ratings based on historical market lines."""
import csv
import pandas as pd
from pathlib import Path
from collections import defaultdict
import numpy as np

# Load odds history
odds_path = Path("data/raw/odds_history.csv")
if not odds_path.exists():
    print(f"Error: {odds_path} not found")
    exit(1)

odds = pd.read_csv(odds_path)
print(f"Loaded {len(odds)} historical odds records")

# Calculate average market spread per team (as favorite or underdog)
team_spreads = defaultdict(list)

for _, row in odds.iterrows():
    team_a = row.get("team_a")
    team_b = row.get("team_b")
    spread = row.get("spread")
    
    if pd.isna(spread):
        continue
    
    spread = float(spread)
    
    # If spread > 0, team_a is favored
    if spread > 0:
        team_spreads[team_a].append(spread)
        team_spreads[team_b].append(-spread)
    else:
        team_spreads[team_a].append(spread)
        team_spreads[team_b].append(-spread)

# Calculate average strength for each team (average spread when team_a)
team_ratings = {}
for team, spreads in team_spreads.items():
    avg_spread = np.mean(spreads)
    # Convert to strength metric: positive = stronger
    strength = avg_spread
    team_ratings[team] = strength

# Normalize ratings to mean=100 offense, defense split
teams_list = sorted(team_ratings.items(), key=lambda x: x[1], reverse=True)
print(f"\nGenerated ratings for {len(team_ratings)} teams")
print(f"Strongest: {teams_list[0][0]} ({teams_list[0][1]:.1f})")
print(f"Weakest: {teams_list[-1][0]} ({teams_list[-1][1]:.1f})")

# Create output CSV with synthetic efficiency metrics
output = []
for team, strength_diff in team_ratings.items():
    # Map spread to efficiency diff (assume 2 pt spread = 2 pt offensive advantage)
    # Assume league average is 100 off / 100 def
    # Strength = avg_offensive_spread = team_efficiency - opponent_efficiency
    # If we assume opponent_avg = 100, then team_off = 100 + strength
    team_off = 100 + (strength_diff / 2)
    team_def = 100 - (strength_diff / 2)
    
    output.append({
        "team": team,
        "power_rating": round(strength_diff, 1),
        "offensive_efficiency": round(team_off, 1),
        "defensive_efficiency": round(team_def, 1),
    })

# Sort by team name for consistency
output.sort(key=lambda x: x["team"])

# Write CSV
output_path = Path("data/processed/ratings.csv")
output_path.parent.mkdir(parents=True, exist_ok=True)

with open(output_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["team", "power_rating", "offensive_efficiency", "defensive_efficiency"])
    writer.writeheader()
    writer.writerows(output)

print(f"\n✓ Generated {len(output)} team ratings from historical odds")
print(f"  Saved to {output_path}")
