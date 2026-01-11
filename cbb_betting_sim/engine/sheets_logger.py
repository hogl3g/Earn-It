"""Logger for bets: prefers Google Sheets (service account), falls back to CSV."""
from pathlib import Path
import csv
import os
from typing import Dict, Any


OUT_PATH = Path(__file__).resolve().parents[2] / "data" / "results" / "bets_log.csv"
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)


def _row_from_bet(bet: Dict[str, Any], date=None):
    return [
        date,
        bet.get("game"),
        bet.get("bet_type"),
        bet.get("pick"),
        bet.get("market_line"),
        bet.get("model_line"),
        bet.get("edge"),
        bet.get("confidence"),
        bet.get("stake"),
        bet.get("odds"),
        "",  # Result
        "",  # Units
        "",  # CLV
        bet.get("notes", ""),
    ]


def _write_csv(bet: Dict[str, Any], date=None):
    headers = [
        "date",
        "game",
        "bet_type",
        "pick",
        "market_line",
        "model_line",
        "edge",
        "confidence",
        "stake",
        "odds",
        "result",
        "units",
        "clv",
        "notes",
    ]

    write_header = not OUT_PATH.exists()
    with OUT_PATH.open("a", newline='', encoding="utf-8") as f:
        w = csv.writer(f)
        if write_header:
            w.writerow(headers)
        w.writerow(_row_from_bet(bet, date=date))

    return str(OUT_PATH)


def log_bet_to_sheets(bet: Dict[str, Any], date=None, sheet_name: str = "Bets", creds_path: str | None = None):
    """Try to append a bet to a Google Sheet, falling back to CSV when unavailable.

    - `creds_path` can be a path to a service account JSON file or omitted to use
      `GOOGLE_APPLICATION_CREDENTIALS` environment variable.
    - Returns a string: path written or a sheets URI like `sheets://<sheet_name>` on success.
    """
    # Prefer explicit creds path, then env var, then config file under repo
    creds_path = creds_path or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds_path:
        candidate = Path(__file__).resolve().parents[2] / "config" / "sheets_credentials.json"
        if candidate.exists():
            creds_path = str(candidate)

    # Try Google Sheets if libraries available and creds exist
    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except Exception:
        return _write_csv(bet, date=date)

    if not creds_path or not Path(creds_path).exists():
        return _write_csv(bet, date=date)

    try:
        scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
        creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
        gc = gspread.authorize(creds)

        # Try to open existing sheet or create one
        try:
            sh = gc.open(sheet_name)
        except Exception:
            sh = gc.create(sheet_name)

        ws = sh.sheet1
        # ensure header
        headers = ws.row_values(1)
        if not headers:
            ws.append_row([
                "date",
                "game",
                "bet_type",
                "pick",
                "market_line",
                "model_line",
                "edge",
                "confidence",
                "stake",
                "odds",
                "result",
                "units",
                "clv",
                "notes",
            ])

        ws.append_row(_row_from_bet(bet, date=date))
        return f"sheets://{sheet_name}"
    except Exception:
        return _write_csv(bet, date=date)
