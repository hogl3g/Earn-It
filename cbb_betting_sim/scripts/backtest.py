import pandas as pd
from pathlib import Path
from typing import Optional
import argparse

from engine.power_ratings import calculate_team_rating
from engine.simulator import simulate_game
from engine.edge_detection import calculate_edge
from engine.clv import calculate_clv
from engine.bet_filter import qualifies
from engine.stake_sizing import stake_from_confidence
from engine.bankroll import Bankroll
import json
import math


def run_backtest(start_date: str, end_date: str, base_dir: Optional[Path] = None) -> pd.DataFrame:
    base = Path(base_dir or Path(__file__).resolve().parents[2])
    raw = base / "data" / "raw"
    results_dir = base / "data" / "results"
    results_dir.mkdir(parents=True, exist_ok=True)

    # support kenpom_YYYY.csv snapshots
    kenpom_path = None
    for p in raw.glob("kenpom_*.csv"):
        kenpom_path = p
        break
    odds_path = raw / "odds_history.csv"

    if not kenpom_path or not kenpom_path.exists():
        raise FileNotFoundError(f"Missing kenpom CSV under {raw} (expected kenpom_*.csv)")
    if not odds_path.exists():
        raise FileNotFoundError(f"Missing odds_history CSV at {odds_path}")

    kenpom = pd.read_csv(kenpom_path)
    odds = pd.read_csv(odds_path)

    odds["date"] = pd.to_datetime(odds["date"])
    mask = (odds["date"] >= pd.to_datetime(start_date)) & (odds["date"] <= pd.to_datetime(end_date))
    odds = odds.loc[mask]

    # load calibration if present
    calibration_path = results_dir / "calibration.json"
    if calibration_path.exists():
        with calibration_path.open("r", encoding="utf-8") as f:
            cal = json.load(f)
        cal_hca = float(cal.get("hca", 2.5))
        cal_sigma = float(cal.get("sigma", 6.0))
    else:
        cal_hca = 2.5
        cal_sigma = 6.0

    bankroll_tracker = Bankroll(starting=100.0, balance=100.0)
    results = []

    for _, game in odds.iterrows():
        rating_a = calculate_team_rating(
            game["team_a"], kenpom, {}, game.get("home") == game["team_a"], hca=cal_hca
        )
        rating_b = calculate_team_rating(
            game["team_b"], kenpom, {}, game.get("home") == game["team_b"], hca=0.0
        )

        sim = simulate_game(rating_a, rating_b, pace=game.get("pace", 70), sigma=cal_sigma)
        model_spread = sim.get("avg_margin")
        bet_line = game.get("spread")
        closing_line = game.get("close_spread") or game.get("closing_line") or game.get("close")

        edge = calculate_edge(model_spread, bet_line)
        clv = calculate_clv(bet_line, closing_line)

        if not qualifies(edge, sim.get("cover_prob")):
            continue

        confidence = int(sim.get("cover_prob", 0) * 100 + abs(edge) * 2)

        # decide staking method: use Kelly if decimal odds available
        # try common fields: 'odds', 'decimal_odds', 'ml_a', 'ml_b'
        odds_decimal = None
        if "decimal_odds" in game and not pd.isna(game.get("decimal_odds")):
            odds_decimal = float(game.get("decimal_odds"))
        elif "odds" in game and not pd.isna(game.get("odds")):
            try:
                odds_decimal = float(game.get("odds"))
            except Exception:
                odds_decimal = None

        if odds_decimal:
            # market-implied probability q
            try:
                market_prob = 1.0 / float(odds_decimal) if float(odds_decimal) > 0 else None
            except Exception:
                market_prob = None
            model_prob = float(sim.get("cover_prob") or 0.0)
            edge_prob = (model_prob - market_prob) if market_prob is not None else None
            stake = stake_from_confidence(confidence, method="kelly", bankroll=bankroll_tracker.balance, edge=edge_prob, odds_decimal=odds_decimal)
        else:
            stake = stake_from_confidence(confidence)

        if stake == 0:
            continue

        # final_margin expected as numeric final margin (team_a - team_b)
        covered = bool(game.get("final_margin") > game.get("spread"))

        # compute profit/loss using odds if available
        if odds_decimal:
            profit = stake * (odds_decimal - 1.0) if covered else -stake
        else:
            profit = stake if covered else -stake

        units = profit

        # update bankroll tracker
        record = bankroll_tracker.place_bet({"game": f"{game['team_a']} vs {game['team_b']}"}, stake, odds_decimal=(odds_decimal or 1.0))
        bankroll_tracker.settle_bet(record, outcome=profit)

        results.append({
            "date": game["date"],
            "game": f"{game['team_a']} vs {game['team_b']}",
            "edge": edge,
            "confidence": confidence,
            "stake": stake,
            "bet_line": bet_line,
            "close_line": closing_line,
            "clv": clv,
            "result": "W" if covered else "L",
            "units": units,
            "bankroll": bankroll_tracker.balance,
            "model_prob": sim.get("cover_prob"),
            "calibrated_prob": None,
        })

    df = pd.DataFrame(results)
    # compute calibration metrics if possible
    if not df.empty and "model_prob" in df.columns:
        df["actual"] = (df["units"] > 0).astype(int)
        # Brier score
        df["brier_sq"] = (df["model_prob"] - df["actual"]) ** 2
        brier = float(df["brier_sq"].mean())
        print(f"Brier score: {brier:.4f}")
        # try to apply prob calibration mapping
        prob_cal_path = results_dir / "prob_calibration.json"
        if prob_cal_path.exists():
            with prob_cal_path.open("r", encoding="utf-8") as f:
                bins = json.load(f)
            # simple bin lookup
            def calibrated(p):
                b = int(p * 10)
                for bi in bins:
                    if bi.get("bin") == b:
                        return float(bi.get("realized", p))
                return p

            df["calibrated_prob"] = df["model_prob"].apply(calibrated)
            calib_brier = float(((df["calibrated_prob"] - df["actual"]) ** 2).mean())
            print(f"Calibrated Brier score: {calib_brier:.4f}")

    # basic ROI
    roi = (bankroll_tracker.balance - bankroll_tracker.starting) / bankroll_tracker.starting if bankroll_tracker.starting else 0.0
    print(f"Final bankroll: {bankroll_tracker.balance:.2f} (ROI {roi:.3%})")

    # generate per-bin P&L and calibration report
    report_rows = []
    if not df.empty and "model_prob" in df.columns:
        df["pred_bin"] = (df["model_prob"] * 10).fillna(0).astype(int)
        for b, g in df.groupby("pred_bin"):
            n = len(g)
            mean_model = float(g["model_prob"].mean())
            realized = float((g["units"] > 0).mean()) if n else 0.0
            pnl = float(g["units"].sum())
            avg_stake = float(g["stake"].mean()) if n else 0.0
            report_rows.append({"bin": int(b), "n": int(n), "mean_model": mean_model, "realized": realized, "pnl": pnl, "avg_stake": avg_stake})

    report_df = pd.DataFrame(report_rows)
    csv_out = results_dir / f"backtest_report_{start_date}_to_{end_date}.csv"
    report_df.to_csv(csv_out, index=False)
    print(f"Wrote backtest report CSV to {csv_out}")

    # write a tiny HTML summary
    html_out = results_dir / f"backtest_report_{start_date}_to_{end_date}.html"
    with html_out.open("w", encoding="utf-8") as f:
        f.write("<html><head><meta charset='utf-8'><title>Backtest Report</title></head><body>")
        f.write(f"<h2>Backtest {start_date} to {end_date}</h2>")
        f.write(f"<p>Final bankroll: {bankroll_tracker.balance:.2f} (ROI {roi:.3%})</p>")
        f.write(report_df.to_html(index=False, float_format='{:,.3f}'.format))
        f.write("</body></html>")
    print(f"Wrote backtest report HTML to {html_out}")
    out_path = results_dir / f"backtest_{start_date}_to_{end_date}.pkl"
    df.to_pickle(out_path)
    print(f"Wrote backtest results to {out_path}")
    return df


def _cli():
    p = argparse.ArgumentParser(description="Run historical backtest over a date range")
    p.add_argument("start_date")
    p.add_argument("end_date")
    args = p.parse_args()
    run_backtest(args.start_date, args.end_date)


if __name__ == "__main__":
    _cli()
