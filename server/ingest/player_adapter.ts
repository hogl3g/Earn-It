import type { RawPlayerPayload } from "../../shared/sports_schema";

export function ingestPlayerPayload(payload: any): RawPlayerPayload {
  return payload as RawPlayerPayload;
}

export function parsePlayer(raw: RawPlayerPayload) {
  return {
    id: raw.player_id ?? raw.id,
    name: raw.name,
    position: raw.position,
    stats: raw.stats ?? {},
    raw,
  };
}

export default { ingestPlayerPayload, parsePlayer };
