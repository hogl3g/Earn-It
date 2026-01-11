"""Export helper: copy the `cbb_betting_sim` folder to a new top-level folder for repository extraction.

Usage:
    python scripts/export_repo.py

This will create a folder `cbb_betting_sim_repo` in the workspace root (one level above `Earn-It`).
"""
from pathlib import Path
import shutil
import sys

SRC = Path(__file__).resolve().parents[1]  # cbb_betting_sim
DEST = Path(__file__).resolve().parents[3] / "cbb_betting_sim_repo"  # workspace root / cbb_betting_sim_repo


def main(force: bool = False):
    if DEST.exists():
        if not force:
            print(f"Destination {DEST} already exists. Remove it first or re-run with --force.")
            sys.exit(1)
        shutil.rmtree(DEST)

    print(f"Copying {SRC} -> {DEST}")
    shutil.copytree(SRC, DEST)
    print("Done. Next steps:")
    print(f"  cd {DEST}")
    print("  git init && git add . && git commit -m 'Initial import'")
    print("Or use `git subtree`/`git filter-repo` to preserve history if desired.")


if __name__ == '__main__':
    main(force=("--force" in sys.argv))
