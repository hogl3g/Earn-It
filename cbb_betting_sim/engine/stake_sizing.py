"""Stake sizing: map confidence to units and provide Kelly fraction helpers."""

from typing import Optional
import os


def map_confidence_to_units(conf_pct):
    # conf_pct is percentage (0..100)
    if conf_pct >= 90:
        return 1.5
    if conf_pct >= 85:
        return 1.25
    if conf_pct >= 80:
        return 1.0
    if conf_pct >= 75:
        return 0.75
    return 0.0


def kelly_fraction(win_prob: float, odds_decimal: float) -> float:
    """Kelly fraction for a binary bet.

    odds_decimal is decimal odds (e.g. -110 -> 1.909, +150 -> 2.5).
    win_prob is model probability (0..1).
    """
    try:
        b = float(odds_decimal) - 1.0
        p = float(win_prob)
        q = 1.0 - p
        if b <= 0:
            return 0.0
        f = (b * p - q) / b
        return max(0.0, f)
    except Exception:
        return 0.0


def stake_from_confidence(confidence_pct: float, method: Optional[str] = None, bankroll: float = 100.0, edge: Optional[float] = None, odds_decimal: Optional[float] = None) -> float:
    """Return stake units.

    - `method` env var `STAKING_METHOD` can override: 'kelly' or 'heuristic'.
    - If 'kelly', `edge` should be probability edge (p - q) and `odds_decimal` provided.
    """
    if method is None:
        method = os.environ.get("STAKING_METHOD", "heuristic")

    try:
        confidence = float(confidence_pct)
    except Exception:
        confidence = 0.0

    if method == "kelly":
        if edge is None or odds_decimal is None:
            return 0.0
        f = kelly_fraction(edge, odds_decimal)
        # cap per-bet fraction to 5% of bankroll for safety
        f = max(0.0, min(f, 0.05))
        # return units scaled to bankroll assuming unit=1
        return round(f * float(bankroll), 3)

    # fallback to legacy heuristic mapping
    return map_confidence_to_units(confidence)
