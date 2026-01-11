"""Format bet card JSON for output/persistence."""

import json

def make_bet_card(matchup, market, model, edge, confidence_pct, units):
    card = {
        "matchup": matchup,
        "market": market,
        "model": model,
        "edge": edge,
        "confidence_pct": confidence_pct,
        "units": units,
    }
    return card

def save_card(card, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(card, f, indent=2)
    return path


def build_bet_card(game, model_spread, edge, cover_prob):
    confidence = int((cover_prob * 100) + abs(edge) * 2)

    return {
        "game": game["matchup"],
        "bet_type": "spread",
        "pick": f"{game['team_a']} {game.get('market_spread')}",
        "market_line": game.get("market_spread"),
        "model_line": round(model_spread, 2) if model_spread is not None else None,
        "edge": round(edge, 2) if edge is not None else None,
        "confidence": confidence,
        "stake": confidence,
    }
