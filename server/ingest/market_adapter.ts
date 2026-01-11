export function ingestMarketPayload(payload: any) {
  return {
    market_id: payload.id ?? null,
    home: payload.home,
    away: payload.away,
    spread: payload.spread ?? payload.line ?? null,
    total: payload.over_under ?? null,
    ml: payload.moneyline ?? null,
    timestamp: payload.timestamp ?? Date.now(),
    raw: payload,
  };
}

export default { ingestMarketPayload };
