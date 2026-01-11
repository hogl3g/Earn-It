import pandas as pd
from pathlib import Path

# Project-local imports; ensure the working directory or PYTHONPATH
# is set so `engine` package is importable when running this script.
from engine.power_ratings import calculate_team_rating
from engine.simulator import simulate_game
from engine.edge_detection import calculate_edge


def run_sims(base_dir: Path | str = Path(__file__).resolve().parents[2]):
    base = Path(base_dir)
    processed = base / "data" / "processed"
    results_dir = base / "data" / "results"
    results_dir.mkdir(parents=True, exist_ok=True)

    kenpom = pd.read_pickle(processed / "kenpom.pkl")
    odds = pd.read_pickle(processed / "odds.pkl")
    injuries_df = pd.read_pickle(processed / "injuries.pkl")

    # injuries_df expected to have columns ['team', 'adjustment']
    injuries = dict(zip(injuries_df.team, injuries_df.adjustment))

    results = []

    for _, game in odds.iterrows():
        team_a = game["team_a"]
        team_b = game["team_b"]

        rating_a = calculate_team_rating(team_a, kenpom, injuries, game.get("home") == team_a)
        rating_b = calculate_team_rating(team_b, kenpom, injuries, game.get("home") == team_b)

        sim = simulate_game(rating_a, rating_b, game.get("pace"))

        model_spread = sim.get("avg_margin")
        edge = calculate_edge(model_spread, game.get("spread"))

        results.append({
            "matchup": f"{team_a} vs {team_b}",
            "team_a": team_a,
            "market_spread": game.get("spread"),
            "model_spread": model_spread,
            "edge": edge,
            "cover_prob": sim.get("cover_prob"),
        })

    pd.DataFrame(results).to_pickle(results_dir / "sim_results.pkl")
    print(f"Wrote {results_dir / 'sim_results.pkl'}")


if __name__ == "__main__":
    run_sims()
