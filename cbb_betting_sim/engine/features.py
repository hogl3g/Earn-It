"""Feature builders: possessions, PPP, player impact scores (PIS), availability adjustments."""


def projected_possessions(team_a, team_b, default_tempo=70):
    t1 = team_a.get("tempo", default_tempo)
    t2 = team_b.get("tempo", default_tempo)
    return (t1 + t2) / 2


def compute_ppp(points, possessions):
    return points / possessions if possessions else 0


def compute_pis(usage, efficiency, minutes, team_minutes=240):
    minutes_pct = minutes / team_minutes
    return usage * efficiency * minutes_pct
