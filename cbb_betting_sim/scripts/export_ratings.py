"""Export team ratings to CSV for TypeScript projector."""
import csv
import pandas as pd
from pathlib import Path
import sys

# Add parent directory to path so we can import engine
sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.power_ratings import calculate_team_rating

# Load KenPom data (latest available)
raw_dir = Path("data/raw")
kenpom_path = None

# Try to find kenpom_YYYY.csv first (most recent)
candidates = sorted(raw_dir.glob("kenpom_*.csv"))
if candidates:
    kenpom_path = candidates[-1]
else:
    kenpom_path = raw_dir / "kenpom.csv"

if not kenpom_path.exists():
    print(f"Error: No KenPom data found in {raw_dir}")
    exit(1)

print(f"Loading KenPom data from {kenpom_path.name}")
kenpom = pd.read_csv(kenpom_path)

# Extract all team names
teams = kenpom["team"].dropna().unique()

# Generate ratings
ratings_output = []
for team in teams:
    try:
        rating = calculate_team_rating(team, kenpom, is_home=False)
        # Get efficiency metrics from KenPom
        row = kenpom.loc[kenpom["team"] == team].iloc[0]
        adj_o = float(row.get("AdjO", row.get("adj_offense", 100)))
        adj_d = float(row.get("AdjD", row.get("adj_defense", 100)))
        
        ratings_output.append({
            "team": team,
            "power_rating": round(rating, 2),
            "offensive_efficiency": round(adj_o, 1),
            "defensive_efficiency": round(adj_d, 1),
        })
    except Exception as e:
        print(f"Warning: Could not calculate rating for {team}: {e}")

# Write to CSV
output_path = Path("data/processed/ratings.csv")
output_path.parent.mkdir(parents=True, exist_ok=True)

with open(output_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["team", "power_rating", "offensive_efficiency", "defensive_efficiency"])
    writer.writeheader()
    writer.writerows(ratings_output)

print(f"✓ Exported {len(ratings_output)} team ratings to {output_path}")
