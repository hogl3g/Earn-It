from scripts.pull_data import pull_all
from scripts.run_sims import run_sims
from scripts.generate_bets import generate_bets

def main():
    pull_all()
    run_sims()
    generate_bets()

if __name__ == "__main__":
    main()
