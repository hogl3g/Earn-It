import json
import os
import re
import argparse
from datetime import datetime, timedelta
from typing import Dict, Tuple, List
import pandas as pd
import requests
from bs4 import BeautifulSoup

def build_espn_urls(yyyymmdd: str) -> List[str]:
    return [
        f"https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/scoreboard?dates={yyyymmdd}&groups=50",
        f"https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/scoreboard?dates={yyyymmdd}&limit=300",
        f"https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/scoreboard?dates={yyyymmdd}",
    ]

PICKS_CSV = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "..",
    "data",
    "results",
    "ts_projector_picks.csv",
)

OUTPUT_CSV = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "..",
    "data",
    "results",
    "jan10_grade.csv",
)

TEAM_ALIASES = {
    "ohio st": "ohio state",
    "st marys": "saint mary's",
    "st mary's": "saint mary's",
    "mt st marys": "mount st mary's",
    "mount st marys": "mount st mary's",
    "ucf": "ucf",
    "e carolina": "east carolina",
    "east caro": "east carolina",
    # Common short names
    "uab": "uab",
    "east carolina": "east carolina",
    "ecu": "east carolina",
    "florida atlantic": "florida atlantic",
    "fau": "florida atlantic",
    "purdue fort wayne": "purdue fort wayne",
    "ipfw": "purdue fort wayne",
    "robert morris": "robert morris",
    "ohio state": "ohio state",
}

# Manual score overrides for cases where the source feed is missing or mismatched.
# Keys are normalized team name pairs (team_a, team_b) as produced by norm_name.
MANUAL_SCORES: Dict[Tuple[str, str], Tuple[int, int]] = {
    ("uab", "east carolina"): (87, 85),
    ("memphis", "florida atlantic"): (78, 89),
    ("northwestern", "rutgers"): (75, 77),
    ("illinois", "iowa"): (75, 69),
    ("northern kentucky", "green bay"): (78, 80),
    ("ohio state", "washington"): (74, 81),
    ("purdue fort wayne", "robert morris"): (79, 74),
    ("charlotte", "rice"): (74, 73),
    ("siena", "mount st mary's"): (67, 50),
    ("siena", "mount saint mary's"): (67, 50),
    ("marist", "rider"): (71, 49),
    ("quinnipiac", "sacred heart"): (70, 60),
}


def norm_name(name: str) -> str:
    n = name.lower()
    n = re.sub(r"\(.*?\)", "", n)  # drop rankings or seeds in parentheses
    n = re.sub(r"[\.'`-]", "", n)  # remove punctuation
    n = n.replace("&", "and")
    n = n.replace("st ", "saint ")  # st -> saint
    n = re.sub(r"\s+", " ", n).strip()
    # apply alias mapping
    return TEAM_ALIASES.get(n, n)


def fetch_scoreboard(yyyymmdd: str) -> List[Dict]:
    last_err = None
    for url in build_espn_urls(yyyymmdd):
        try:
            resp = requests.get(url, timeout=30)
            if resp.status_code != 200:
                last_err = f"HTTP {resp.status_code}"
                continue
            data = resp.json()
            events = data.get("events", [])
            if events:
                return events
        except Exception as e:
            last_err = str(e)
            continue
    raise RuntimeError(f"Failed to fetch ESPN scoreboard: {last_err}")


def build_sr_url(year: int, month: int, day: int) -> str:
    return f"https://www.sports-reference.com/cbb/boxscores/index.cgi?month={month}&day={day}&year={year}"


def fetch_sr_boxscores(year: int, month: int, day: int) -> Dict[Tuple[str, str], Tuple[int, int]]:
    """Scrape Sports-Reference boxscores page for team scores.
    Returns index mapping (teamA, teamB) -> (scoreA, scoreB) with both orders.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    r = requests.get(build_sr_url(year, month, day), headers=headers, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")
    idx: Dict[Tuple[str, str], Tuple[int, int]] = {}
    # SR day boxscore page lists many small tables with class 'teams'
    for tbl in soup.find_all("table", class_="teams"):
        # Heuristic: look for two rows with team links and score cells
        rows = tbl.find_all("tr")
        if len(rows) < 2:
            continue
        # Extract team names and scores from first two rows
        def parse_row(tr):
            # team name in anchor
            a = tr.find("a")
            team = a.get_text(strip=True) if a else None
            # scores often in last td
            tds = tr.find_all("td")
            score = None
            for td in reversed(tds):
                txt = td.get_text(strip=True)
                if txt.isdigit():
                    score = int(txt)
                    break
            return team, score

        t1, s1 = parse_row(rows[0])
        t2, s2 = parse_row(rows[1])
        if not t1 or not t2 or s1 is None or s2 is None:
            continue
        # Filter out non-game tables by requiring plausible scores
        if s1 < 20 or s2 < 20:
            # skip likely non-boxscore tables
            continue
        k1 = (norm_name(t1), norm_name(t2))
        k2 = (norm_name(t2), norm_name(t1))
        idx[k1] = (s1, s2)
        idx[k2] = (s2, s1)
    return idx


def build_game_index(events: List[Dict]) -> Dict[Tuple[str, str], Tuple[int, int]]:
    idx: Dict[Tuple[str, str], Tuple[int, int]] = {}
    for ev in events:
        comps = ev.get("competitions", [])
        if not comps:
            continue
        comp = comps[0]
        teams = comp.get("competitors", [])
        if len(teams) != 2:
            continue
        t1 = teams[0]
        t2 = teams[1]
        name1 = t1.get("team", {}).get("shortDisplayName") or t1.get("team", {}).get("displayName")
        name2 = t2.get("team", {}).get("shortDisplayName") or t2.get("team", {}).get("displayName")
        try:
            score1 = int(t1.get("score", 0))
            score2 = int(t2.get("score", 0))
        except (TypeError, ValueError):
            continue
        if not name1 or not name2:
            continue
        k1 = (norm_name(name1), norm_name(name2))
        k2 = (norm_name(name2), norm_name(name1))
        idx[k1] = (score1, score2)
        idx[k2] = (score2, score1)
    return idx


def load_picks(date_filter: str | None) -> pd.DataFrame:
    df = pd.read_csv(PICKS_CSV)
    if date_filter:
        # Keep rows whose ISO timestamp starts with date_filter
        # date column exists and is ISO-like; fallback to all rows if missing
        if "date" in df.columns:
            picks = df[df["date"].astype(str).str.startswith(date_filter)].copy()
        else:
            picks = df.copy()
    else:
        picks = df.copy()
    return picks


def grade(picks: pd.DataFrame, idx: Dict[Tuple[str, str], Tuple[int, int]]) -> pd.DataFrame:
    rows = []
    for _, r in picks.iterrows():
        a = r["team_a"]
        b = r["team_b"]
        key = (norm_name(a), norm_name(b))
        # Prefer manual scores first to ensure grading even if feeds missed the game
        scores = MANUAL_SCORES.get(key) or idx.get(key)
        if not scores:
            # try swapped
            key2 = (norm_name(b), norm_name(a))
            scores = MANUAL_SCORES.get(key2) or idx.get(key2)
        if not scores:
            stake = float(r.get("stake_dollars", 0))
            rows.append({
                "team_a": a,
                "team_b": b,
                "a_score": None,
                "b_score": None,
                "margin": None,
                "market_spread": r.get("market_spread"),
                "model_spread": r.get("model_spread"),
                    "covered": None,
                    "won": None,
                    "stake": 0.0,  # do not count ungraded stakes
                    "profit": 0.0,  # neutral until graded
                "note": "score not found",
            })
            continue
        a_score, b_score = scores
        margin = int(a_score) - int(b_score)
        spread = float(r["market_spread"])  # team_a perspective
        # If team_a favored by -X, cover if margin > X
        cover_thresh = -spread
        covered = margin > cover_thresh
        # Win if margin > 0
        won = margin > 0
        stake = float(r.get("stake_dollars", 0))
        # Assume -110 odds
        profit = stake * 0.9091 if covered else -stake
        rows.append({
            "team_a": a,
            "team_b": b,
            "a_score": a_score,
            "b_score": b_score,
            "margin": margin,
            "market_spread": spread,
            "model_spread": r["model_spread"],
            "covered": covered,
            "won": won,
            "stake": stake,
            "profit": profit,
        })
    out = pd.DataFrame(rows)
    return out


def main():
    parser = argparse.ArgumentParser(description="Grade projector picks using final scores")
    parser.add_argument("--date", help="Date to grade (YYYY-MM-DD). Default: today.", default=None)
    parser.add_argument("--score-date", help="Date to pull scores (YYYY-MM-DD). Default: --date", default=None)
    args = parser.parse_args()

    if args.date:
        try:
            dt = datetime.strptime(args.date, "%Y-%m-%d")
        except ValueError:
            raise SystemExit("Invalid --date. Use YYYY-MM-DD")
    else:
        dt = datetime.now()

    if args.score_date:
        try:
            score_dt = datetime.strptime(args.score_date, "%Y-%m-%d")
        except ValueError:
            raise SystemExit("Invalid --score-date. Use YYYY-MM-DD")
    else:
        score_dt = dt

    yyyymmdd = score_dt.strftime("%Y%m%d")
    iso_date = dt.strftime("%Y-%m-%d")

    print(f"Fetching ESPN scoreboard for {score_dt.strftime('%Y-%m-%d')}...")
    try:
        events = fetch_scoreboard(yyyymmdd)
        idx = build_game_index(events)
        print(f"Loaded {len(idx)//2} games from ESPN")
    except Exception as e:
        print(f"ESPN fetch failed ({e}). Falling back to Sports-Reference...")
        idx = fetch_sr_boxscores(score_dt.year, score_dt.month, score_dt.day)
        # also fetch previous day
        prev = score_dt - timedelta(days=1)
        idx_prev = fetch_sr_boxscores(prev.year, prev.month, prev.day)
        idx.update(idx_prev)
        print(f"Loaded {len(idx)//2} games from Sports-Reference (today + prev day)")
    picks = load_picks(iso_date)
    print(f"Found {len(picks)} projector picks for grading")
    out = grade(picks, idx)
    if out.empty:
        print("No output rows produced.")
        return
    # summary
    covers = out["covered"].sum()
    wins = out["won"].sum()
    total = len(out)
    total_stake = out["stake"].sum()
    total_profit = out["profit"].sum()
    roi = (total_profit / total_stake) * 100 if total_stake else 0.0
    print("\nSUMMARY")
    print("-" * 60)
    print(f"Total picks: {total}")
    print(f"Covers: {covers}/{total} ({covers/total*100:.1f}%)")
    print(f"Wins: {wins}/{total} ({wins/total*100:.1f}%)")
    print(f"Total staked: ${total_stake:.2f}")
    print(f"Total profit: ${total_profit:.2f}")
    print(f"ROI: {roi:.2f}%")

    # write csv
    # Per-date output paths
    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "data", "results")
    os.makedirs(out_dir, exist_ok=True)
    per_date_csv = os.path.join(out_dir, f"grades_{dt.strftime('%Y%m%d')}.csv")
    out.to_csv(per_date_csv, index=False)
    # write summary json
    summary = {
        "date": iso_date,
        "total_picks": int(total),
        "covers": int(covers),
        "wins": int(wins),
        "total_stake": float(total_stake),
        "total_profit": float(total_profit),
        "roi": float(roi),
    }
    per_date_json = os.path.join(out_dir, f"grades_{dt.strftime('%Y%m%d')}.json")
    with open(per_date_json, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "rows": out.to_dict(orient="records")}, f, ensure_ascii=False, indent=2)
    print(f"\nWrote results: {per_date_csv}\nWrote summary: {per_date_json}")


if __name__ == "__main__":
    main()
