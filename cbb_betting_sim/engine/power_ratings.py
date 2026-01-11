"""Team rating utilities with recency and opponent adjustments.

This module provides a simple, extensible implementation of team ratings
and a small calibration helper for HCA and recency weights.
"""

from typing import Dict
import numpy as np


def compute_base_rating_from_row(row: Dict):
    adj_o = float(row.get("AdjO", row.get("adj_offense", 100)))
    adj_d = float(row.get("AdjD", row.get("adj_defense", 100)))
    return adj_o - adj_d


def weighted_recency(recent_net: float, days_decay: float = 14.0):
    # simple decay: recent_net scaled by exp(-1/days_decay)
    try:
        return float(recent_net) * np.exp(-1.0 / float(days_decay))
    except Exception:
        return 0.0


def calculate_team_rating(team_name: str, kenpom_df, injuries: Dict[str, float] = None, is_home: bool = False, hca: float = 2.5, recent_days_decay: float = 14.0, opponent_adj: bool = True):
    """Return a numeric team rating using kenpom snapshot and injuries.

    Enhancements over the placeholder:
    - Applies recent performance decay when `recent_net` is present on the team row.
    - Optionally performs a simple opponent adjustment by normalizing against league mean.
    - `hca` is applied if `is_home`.
    """
    try:
        row = kenpom_df.loc[kenpom_df["team"] == team_name].iloc[0]
        base = compute_base_rating_from_row(row)
        recent_net = row.get("recent_net", 0.0)
        base += weighted_recency(recent_net, days_decay=recent_days_decay)
    except Exception:
        base = 0.0

    # simple opponent adjustment: subtract league mean so ratings are mean-zero
    if opponent_adj:
        try:
            all_bases = kenpom_df.apply(lambda r: compute_base_rating_from_row(r), axis=1).values
            league_mean = float(np.nanmean(all_bases)) if len(all_bases) else 0.0
            base = base - league_mean
        except Exception:
            pass

    injury_adj = float(injuries.get(team_name, 0.0)) if injuries else 0.0
    home_adj = float(hca) if is_home else 0.0

    return float(base + injury_adj + home_adj)


def calibrate_hca_and_sigma(historical_games_df, team_col_a: str = "team_a", team_col_b: str = "team_b", margin_col: str = "final_margin", kenpom_df=None):
    """Estimate HCA (home court advantage) and residual sigma from historical margins.

    Expects a DataFrame with columns for team A, team B, and final margin (A - B).
    If `kenpom_df` is provided, uses `calculate_team_rating` to build predicted margins
    and fits a linear model: observed_margin ~ predicted_margin + is_home.
    Returns (hca_estimate, sigma_estimate).
    """
    import statsmodels.api as sm
    # build predictors
    preds = []
    margins = []
    home_flags = []
    for _, g in historical_games_df.iterrows():
        a = g.get(team_col_a)
        b = g.get(team_col_b)
        margin = g.get(margin_col)
        if kenpom_df is not None:
            ra = calculate_team_rating(a, kenpom_df, is_home=False)
            rb = calculate_team_rating(b, kenpom_df, is_home=False)
            pred = ra - rb
        else:
            pred = 0.0
        preds.append(pred)
        margins.append(margin)
        home_flags.append(1 if g.get("is_home_a") else 0)

    X = np.column_stack([preds, home_flags])
    X = sm.add_constant(X)
    y = np.array(margins, dtype=float)
    try:
        model = sm.OLS(y, X, missing="drop").fit()
        # coeffs: const, pred_coef, hca_coef
        hca_est = float(model.params[2]) if len(model.params) > 2 else 0.0
        residuals = model.resid
        sigma_est = float(np.std(residuals))
        return hca_est, sigma_est
    except Exception:
        return 2.5, 6.0
