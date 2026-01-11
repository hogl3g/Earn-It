"""Simple bankroll tracking utilities."""
from dataclasses import dataclass, field
from typing import List, Dict, Any
import math


@dataclass
class BetRecord:
    bet: Dict[str, Any]
    stake: float
    odds_decimal: float
    result: float = 0.0  # profit (positive) or loss (negative)


@dataclass
class Bankroll:
    starting: float = 100.0
    balance: float = 100.0
    history: List[BetRecord] = field(default_factory=list)

    def place_bet(self, bet: Dict[str, Any], stake: float, odds_decimal: float) -> BetRecord:
        r = BetRecord(bet=bet, stake=stake, odds_decimal=odds_decimal)
        self.history.append(r)
        # stake is deducted immediately
        self.balance -= stake
        return r

    def settle_bet(self, record: BetRecord, outcome: float):
        """Settle a bet record.

        `outcome` should be payoff in decimal units: positive profit, or negative for loss.
        Example: for a winning bet with odds_decimal 1.909 and stake 10, outcome = stake*(odds_decimal-1)
        """
        record.result = outcome
        self.balance += outcome

    def roi(self) -> float:
        invested = self.starting
        return (self.balance - invested) / invested if invested else 0.0

    def max_drawdown(self) -> float:
        peak = -math.inf
        mdd = 0.0
        bal = self.starting
        peak = bal
        for r in self.history:
            bal = bal - r.stake + r.result
            if bal > peak:
                peak = bal
            dd = (peak - bal) / peak if peak else 0.0
            if dd > mdd:
                mdd = dd
        return mdd
