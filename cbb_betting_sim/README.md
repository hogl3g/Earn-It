cbb_betting_sim
================

Lightweight scaffold for a college basketball betting simulation pipeline.

Structure:
- data/raw: raw CSVs (kenpom.csv, odds.csv, injuries.csv, games_today.csv)
- data/processed: cleaned/normalized features
- data/results: saved bet cards and grading outputs
- engine: core modules (power ratings, features, simulator, edge detection, bet filter, stake sizing, bet card)
- scripts: helpers to pull data, run sims, generate bets, grade results
- config: thresholds, bankroll, team mappings

Next steps:
- Replace placeholders with ingest adapters for KenPom and market feeds
- Add unit tests and type hints
- Wire `scripts/run_simulations.py` to real data
