import type { RawGamePayload } from "../../shared/sports_schema";

export function ingestGamePayload(payload: any): RawGamePayload {
  return payload as RawGamePayload;
}

export function parseGame(raw: RawGamePayload) {
  return {
    id: raw.game_id ?? `${raw.home}_${raw.away}_${raw.date}`,
    date: raw.date,
    home: raw.home,
    away: raw.away,
    score: raw.score ?? null,
    raw,
  };
}

export default { ingestGamePayload, parseGame };
