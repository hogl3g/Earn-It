"""Run simulations for games in data/raw/games_today.csv and produce bet cards."""

import csv
from engine.features import projected_possessions
from engine.simulator import simulate_game
from engine.power_ratings import compute_adjusted_rating


def load_games(path):
    games = []
    try:
        with open(path, newline='', encoding='utf-8') as f:
            rdr = csv.DictReader(f)
            for r in rdr:
                games.append(r)
    except FileNotFoundError:
        pass
    return games

def run_sims(out_path='data/results/sim_results.json'):
    import json, os
    games = load_games('data/raw/games_today.csv')
    results = []
    for g in games:
        print('Found game', g)
        # Minimal simulation pipeline placeholder
        team_a = { 'offensive_efficiency': float(g.get('off_a_eff', 100)), 'defensive_efficiency': float(g.get('off_b_eff', 100)) }
        team_b = { 'offensive_efficiency': float(g.get('off_b_eff', 100)), 'defensive_efficiency': float(g.get('off_a_eff', 100)) }
        possessions = projected_possessions(team_a, team_b)
        sim = simulate_game(team_a, team_b, possessions, sims=2000)
        model_spread = sim['mean']
        model_total = sim['mean_total']
        cover_prob = None
        if 'spread' in g and g['spread']:
            try:
                spread = float(g['spread'])
                cover_prob = len([s for s in sim['samples'] if s > spread]) / len(sim['samples'])
            except Exception:
                cover_prob = None
        rec = { 'matchup': g.get('matchup') or f"{g.get('team_a')} vs {g.get('team_b')}", 'model_spread': model_spread, 'model_total': model_total, 'cover_prob': cover_prob }
        results.append(rec)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({ 'generated_at': __import__('datetime').datetime.utcnow().isoformat() + 'Z', 'games': results }, f, indent=2)
    print(f"Wrote simulation results to {out_path}")


if __name__ == '__main__':
    run_sims()
