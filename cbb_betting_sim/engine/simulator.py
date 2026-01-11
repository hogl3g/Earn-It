import numpy as np
from typing import Optional


def simulate_game(
    team_a_rating: float,
    team_b_rating: float,
    pace: Optional[float] = None,
    sims: int = 3000,
    sigma: Optional[float] = None,
    pace_scale: float = 0.03,
):
    """Monte Carlo simulation using Gaussian noise around rating difference.

    Improvements:
    - `sigma` can be provided (calibrated); otherwise defaults to 6.
    - If `pace` is provided, we scale sigma by (1 + pace_scale*(pace-70)/70)
      so higher-pace games have larger dispersion.

    Returns dict with `avg_margin`, `cover_prob`, and `margin_dist`.
    """
    if sigma is None:
        sigma = 6.0

    # normalize pace scaling around 70 possessions
    if pace is not None:
        try:
            pace = float(pace)
            sigma = sigma * (1.0 + pace_scale * ((pace - 70.0) / 70.0))
            if sigma <= 0:
                sigma = 1.0
        except Exception:
            pass

    dif = team_a_rating - team_b_rating
    margins = np.random.normal(dif, sigma, size=sims)

    return {"avg_margin": float(margins.mean()), "cover_prob": float((margins > 0).mean()), "margin_dist": margins}
