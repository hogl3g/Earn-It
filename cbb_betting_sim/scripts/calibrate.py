"""Calibration script to estimate HCA and residual sigma from historical games.

Usage:
    python scripts/calibrate.py

Reads `data/raw/odds_history.csv` and `data/raw/kenpom_*.csv` and writes results to
`data/results/calibration.json`.
"""
from pathlib import Path
import pandas as pd
import json

from engine.power_ratings import calibrate_hca_and_sigma


def main():
    base = Path(__file__).resolve().parents[2]
    raw = base / "data" / "raw"
    odds_path = raw / "odds_history.csv"
    kenpom_path = None
    for p in raw.glob("kenpom_*.csv"):
        kenpom_path = p
        break

    if not odds_path.exists():
        print("No odds_history.csv found under data/raw")
        return

    odds = pd.read_csv(odds_path)

    kenpom = pd.read_csv(kenpom_path) if kenpom_path and kenpom_path.exists() else None

    hca, sigma = calibrate_hca_and_sigma(odds, team_col_a="team_a", team_col_b="team_b", margin_col="final_margin", kenpom_df=kenpom)

    out = base / "data" / "results" / "calibration.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        json.dump({"hca": hca, "sigma": sigma}, f, indent=2)

    print(f"Wrote calibration to {out}: hca={hca}, sigma={sigma}")


if __name__ == "__main__":
    main()
