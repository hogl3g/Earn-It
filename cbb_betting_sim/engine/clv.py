"""CLV helper wrapper module."""
from .edge_detection import calculate_clv as _edge_clv


def calculate_clv(bet_line, closing_line):
    """Return Closing Line Value (closing_line - bet_line)."""
    return _edge_clv(bet_line, closing_line)
