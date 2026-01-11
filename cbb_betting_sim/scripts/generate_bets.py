import pandas as pd
from pathlib import Path

from engine.bet_filter import qualifies
from engine.bet_card import build_bet_card
from engine.stake_sizing import stake_from_confidence
import os
from engine.sheets_logger import log_bet_to_sheets


def generate_bets(base_dir: Path | str = Path(__file__).resolve().parents[2]):
    base = Path(base_dir)
    results_dir = base / "data" / "results"

    sims = pd.read_pickle(results_dir / "sim_results.pkl")

    for _, row in sims.iterrows():
        if qualifies(row.get("edge"), row.get("cover_prob")):
            bet = build_bet_card(row, row.get("model_spread"), row.get("edge"), row.get("cover_prob"))
            # Allow switching staking method via env var `STAKING_METHOD` (heuristic|kelly)
            method = os.environ.get("STAKING_METHOD", "heuristic")
            if method == "kelly":
                # compute probability edge and decimal odds if available
                # require `cover_prob` and `odds` (decimal) to be present
                edge_prob = row.get("cover_prob") - row.get("market_prob") if row.get("market_prob") is not None else None
                odds_decimal = bet.get("odds")
                bet["stake"] = stake_from_confidence(bet.get("confidence", 0), method="kelly", bankroll=float(os.environ.get("BANKROLL", 100.0)), edge=edge_prob, odds_decimal=odds_decimal)
            else:
                bet["stake"] = stake_from_confidence(bet.get("confidence", 0), method="heuristic")

            if bet["stake"] > 0:
                try:
                    log_bet_to_sheets(bet)
                except Exception as e:
                    print(f"Failed to log to sheets: {e}")
                print(f"BET: {bet}")


if __name__ == "__main__":
    generate_bets()
"""Generate bets by applying engine pipeline to today's games."""
