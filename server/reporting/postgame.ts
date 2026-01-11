export function gradeBet(actualMargin: number, modelSpread: number, stake: number) {
  const hit = (actualMargin > modelSpread) === (modelSpread > 0);
  return {
    hit,
    pnl: hit ? stake * 1.9 : -stake, // placeholder payout
    actualMargin,
    modelSpread,
  };
}

export default { gradeBet };
