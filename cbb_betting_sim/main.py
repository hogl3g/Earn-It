import sys

from scripts.run_backtest import run_backtest
from scripts.pull_data import pull_all
from scripts.run_sims import run_sims
from scripts.generate_bets import generate_bets


def run_pipeline():
    pull_all()
    run_sims()
    generate_bets()


if __name__ == "__main__":
    if "--backtest" in sys.argv:
        # default historical window; adjust as needed or extend to accept args
        run_backtest("2024-11-01", "2025-03-15")
    else:
        run_pipeline()
"""Orchestrator that pulls data, runs sims, and generates bets."""

from scripts.pull_data import pull_all
from scripts.run_simulations import run_sims
from scripts.generate_bets import generate_bets


def main():
    pull_all()
    run_sims()
    generate_bets()


if __name__ == '__main__':
    main()
