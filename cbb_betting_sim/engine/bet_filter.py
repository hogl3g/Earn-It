"""Qualification logic loaded from `config/thresholds.yaml`.

Expected yaml keys:
- `spread_edge_min`: minimum absolute spread edge to qualify
- `min_cover_prob`: minimum cover probability to qualify

If the config file is missing, sensible defaults are used.
"""

from pathlib import Path
import yaml


DEFAULT_THRESHOLDS = {"spread_edge_min": 2.0, "min_cover_prob": 0.55}

_config_path = Path(__file__).resolve().parents[2] / "config" / "thresholds.yaml"
try:
    if _config_path.exists():
        with _config_path.open("r", encoding="utf-8") as _f:
            THRESHOLDS = {**DEFAULT_THRESHOLDS, **(yaml.safe_load(_f) or {})}
    else:
        THRESHOLDS = DEFAULT_THRESHOLDS.copy()
except Exception:
    THRESHOLDS = DEFAULT_THRESHOLDS.copy()


def qualifies(edge, cover_prob):
    """Return True if a bet qualifies using configured thresholds.

    Args:
        edge (float): model_line - market_line
        cover_prob (float): probability that the selection covers
    """
    if edge is None or cover_prob is None:
        return False

    try:
        return (abs(float(edge)) >= float(THRESHOLDS["spread_edge_min"])) and (
            float(cover_prob) >= float(THRESHOLDS["min_cover_prob"])
        )
    except Exception:
        return False
