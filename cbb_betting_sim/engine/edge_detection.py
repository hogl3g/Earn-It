"""Edge detection: compare model spread/total to market and compute edges."""

def spread_edge(model_spread, market_spread):
    if model_spread is None or market_spread is None:
        return None
    return model_spread - market_spread


def total_edge(model_total, market_total):
    if model_total is None or market_total is None:
        return None
    return model_total - market_total


def calculate_edge(model_spread, market_spread):
    """Compatibility wrapper: returns spread edge (model - market)."""
    if model_spread is None or market_spread is None:
        return None
    try:
        return model_spread - market_spread
    except Exception:
        try:
            return float(model_spread) - float(market_spread)
        except Exception:
            return None


def calculate_clv(bet_line, closing_line):
    """Compute CLV (Closing Line Value).

    Positive CLV means the bet line was better than the closing line (you beat the close).
    Example: bet_line = -4.5, closing_line = -6.0 -> CLV = -6.0 - (-4.5) = -1.5? 
    To follow the user's convention (Closing Line − Bet Line), we return closing_line - bet_line.
    """
    try:
        return float(closing_line) - float(bet_line)
    except Exception:
        return None
