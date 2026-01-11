import pandas as pd
from pathlib import Path
from typing import Optional


def _find_latest_kenpom(raw: Path) -> Optional[Path]:
    # Prefer files matching kenpom_YYYY.csv; fall back to kenpom.csv
    candidates = sorted(raw.glob("kenpom_*.csv"))
    if candidates:
        return candidates[-1]
    fallback = raw / "kenpom.csv"
    return fallback if fallback.exists() else None


def pull_all(base_dir: Path | str = Path(__file__).resolve().parents[2]):
    base = Path(base_dir)
    raw = base / "data" / "raw"
    processed = base / "data" / "processed"
    processed.mkdir(parents=True, exist_ok=True)

    # kenpom: accept kenpom_YYYY.csv (pick latest) or kenpom.csv
    kenpom_path = _find_latest_kenpom(raw)
    if kenpom_path is not None and kenpom_path.exists():
        kenpom = pd.read_csv(kenpom_path)
        print(f"Loaded kenpom from {kenpom_path.name}")
    else:
        kenpom = pd.DataFrame()
        print("Warning: no kenpom CSV found in data/raw; created empty DataFrame")

    # odds: prefer odds_history.csv, then odds.csv
    odds_path = raw / "odds_history.csv"
    if not odds_path.exists():
        odds_path = raw / "odds.csv"

    if odds_path.exists():
        odds = pd.read_csv(odds_path)
        print(f"Loaded odds from {odds_path.name}")
    else:
        odds = pd.DataFrame()
        print("Warning: no odds CSV found in data/raw; created empty DataFrame")

    # injuries: prefer injuries_history.csv, then injuries.csv; default zeroed adjustments
    injuries_path = raw / "injuries_history.csv"
    if not injuries_path.exists():
        injuries_path = raw / "injuries.csv"

    if injuries_path.exists():
        injuries = pd.read_csv(injuries_path)
        print(f"Loaded injuries from {injuries_path.name}")
    else:
        injuries = pd.DataFrame(columns=["team", "adjustment"])
        print("Info: no injuries CSV found; using empty injuries (zero adjustments)")

    kenpom.to_pickle(processed / "kenpom.pkl")
    odds.to_pickle(processed / "odds.pkl")
    injuries.to_pickle(processed / "injuries.pkl")

    print(f"Saved pickles to {processed}")


if __name__ == "__main__":
    pull_all()
