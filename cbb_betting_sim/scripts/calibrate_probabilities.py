"""Calibrate model cover probabilities to realized outcomes via binning.

Produces `data/results/prob_calibration.json` containing bins and observed hit rates.
"""
from pathlib import Path
import pandas as pd
import json


def main():
    base = Path(__file__).resolve().parents[2]
    results = base / "data" / "results"
    sims_path = results / "sim_results.pkl"
    odds_path = base / "data" / "raw" / "odds_history.csv"

    if not sims_path.exists() or not odds_path.exists():
        print("Need sim_results.pkl and odds_history.csv to calibrate probabilities")
        return

    sims = pd.read_pickle(sims_path)
    odds = pd.read_csv(odds_path)

    # build matchup key in odds to merge on `matchup` if sims lacks team_b
    if "matchup" in sims.columns:
        if "matchup" not in odds.columns:
            odds["matchup"] = odds["team_a"].astype(str) + " vs " + odds["team_b"].astype(str)
        merged = sims.merge(odds, how="left", on="matchup")
    else:
        merged = sims.merge(odds, how="left", left_on=["team_a", "team_b"], right_on=["team_a", "team_b"]) if set(["team_a","team_b"]).issubset(sims.columns) else sims

    # require cover_prob and final_margin to be present
    if "cover_prob" not in merged.columns or "final_margin" not in merged.columns:
        print("Input missing required columns (`cover_prob`, `final_margin`).")
        return

    merged["pred_bin"] = (merged["cover_prob"] * 10).fillna(0).astype(int)
    bins = []
    for b, g in merged.groupby("pred_bin"):
        mean_p = float(g["cover_prob"].mean())
        realized = float((g["final_margin"] > 0).mean()) if len(g) else 0.0
        bins.append({"bin": int(b), "mean_prob": mean_p, "realized": realized, "n": int(len(g))})

    out = results / "prob_calibration.json"
    with out.open("w", encoding="utf-8") as f:
        json.dump(bins, f, indent=2)

    print(f"Wrote probability calibration to {out}")


if __name__ == "__main__":
    main()
