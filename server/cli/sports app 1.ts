import { simulate_game } from "../sim/simulate";
import { compare_teams } from "../sim/compare";
import type { TeamRecord } from "../../shared/sports_schema";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Lightweight mock loaders — replace with real adapters when available
export async function load_team_ratings(date: string): Promise<Record<string, TeamRecord>> {
  // Try to load ratings CSV from cbb_betting_sim processed data if present.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const csvPath = path.resolve(__dirname, "../../cbb_betting_sim/data/processed/ratings.csv");
  try {
    const txt = await fs.readFile(csvPath, "utf8");
    const rows = txt.split(/\r?\n/).filter(r => r.trim());
    const header = rows.shift()!.split(",");
    const out: Record<string, TeamRecord> = {};
    for (const row of rows) {
      const cols = row.split(",");
      const obj: Record<string, string> = {};
      for (let i = 0; i < header.length; i++) obj[header[i]] = cols[i] ?? "";
      const name = obj.team as string ?? obj.team_name ?? obj.team_a;
      out[name] = { id: name, metrics: { offensive_efficiency: Number(obj.offensive_efficiency ?? obj.offense ?? 100), defensive_efficiency: Number(obj.defensive_efficiency ?? obj.defense ?? 100) } } as any;
    }
    return out;
  } catch (err) {
    // Fallback to simple stubs
    const stub = (name: string): TeamRecord => ({ id: name, metrics: { offensive_efficiency: 105, defensive_efficiency: 98 } } as any);
    return {
      "Ohio State": stub("Ohio State"),
      "Nebraska": stub("Nebraska"),
      "Oregon": stub("Oregon"),
      "Rutgers": stub("Rutgers"),
      "Texas Southern": stub("Texas Southern"),
      "Grambling State": stub("Grambling State"),
    };
  }
}

export async function load_player_availability(): Promise<Record<string, Record<string, number>>> {
  // team -> playerId -> availability (0..1). Mock no injuries.
  return {};
}

export type MarketLine = {
  team_a: string;
  team_b: string;
  spread?: number; // positive means team_a favored by this many points (convention may vary)
  over_under?: number;
  spread_odds?: number;
};

export async function get_market_lines(requests: Array<[string, string]>, asOfDate?: string, source?: string): Promise<MarketLine[]> {
  // For the projector we prefer upcoming market lines. Read the repo CSV
  // (`data/raw/odds_history.csv`) and return upcoming games or match
  // explicit requests against known lines.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const csvPath = path.resolve(__dirname, "../../data/raw/odds_history.csv");
  let txt: string;
  // If a live odds API is configured, try it first. Format expected:
  // [{ team_a, team_b, spread, over_under, date }, ...]
  const liveUrl = process.env.LIVE_ODDS_API_URL;
  const coversIndexUrl = process.env.COVERS_INDEX_URL;
  // heuristic covers.com scraper helper
  async function fetchFromCovers(pairs: Array<[string,string]>): Promise<MarketLine[]> {
    const results: MarketLine[] = [];
    for (const [a,b] of pairs) {
      try {
        const searchUrl = `https://www.covers.com/search?q=${encodeURIComponent(a + ' vs ' + b)}`;
        const sresp = await fetch(searchUrl);
        if (!sresp.ok) { results.push({team_a:a, team_b:b}); continue; }
        const shtml = await sresp.text();
        const linkMatch = shtml.match(/href=\"(\/sports\/[^\"\s>]+)\"/i);
        if (!linkMatch) { results.push({team_a:a, team_b:b}); continue; }
        const gameUrl = new URL(linkMatch[1], 'https://www.covers.com').toString();
        const gresp = await fetch(gameUrl);
        if (!gresp.ok) { results.push({team_a:a, team_b:b}); continue; }
        const ghtml = await gresp.text();

        // Prefer JSON-LD SportsEvent metadata when present
        let teamA: string | undefined;
        let teamB: string | undefined;
        const ldMatch = ghtml.match(/<script[^>]*type=\"application\/ld\+json\"[^>]*>([\s\S]*?)<\/script>/i);
        if (ldMatch) {
          try {
            const j = JSON.parse(ldMatch[1]);
            if (j && (j.homeTeam || j.awayTeam)) {
              teamA = j.awayTeam?.name || j.awayTeam || teamA;
              teamB = j.homeTeam?.name || j.homeTeam || teamB;
            }
          } catch (e) {
            // ignore
          }
        }

        // Helper: search near an anchor for numeric patterns (spread/total/american odds)
        const extractNearby = (html: string, anchors: string[], radius = 500) => {
          const low = html.toLowerCase();
          for (const anchor of anchors) {
            const idx = low.indexOf(anchor.toLowerCase());
            if (idx >= 0) {
              const start = Math.max(0, idx - radius);
              const window = html.slice(start, idx + radius);
              const spreadMatch = window.match(/([-−–]?\d{1,2}(?:\.\d+)?)(?=\s*(?:pts|points|spread|line|fav|favorite|vs))/i)
                || window.match(/(?:spread|line|favorite|fav)[^\d\-–−]*([-−–]?\d+(?:\.\d+)?)/i)
                || window.match(/([-−–]\d+(?:\.\d+)?)/);
              const totalMatch = window.match(/(?:over\/?under|o\/?u|total|over under)[^0-9]{0,6}(\d{2,3}(?:\.\d+)?)/i)
                || window.match(/(?:total)[:\s]*?(\d{2,3}(?:\.\d+)?)/i);
              const americanMatch = window.match(/([+-]\d{2,3})(?!\d)/);
              return { spread: spreadMatch ? Number(spreadMatch[1].replace(/[−–]/g, '-')) : undefined, over_under: totalMatch ? Number(totalMatch[1]) : undefined, spread_odds: americanMatch ? Number(americanMatch[1].replace(/[−–]/g, '-')) : undefined };
            }
          }
          return { spread: undefined, over_under: undefined, spread_odds: undefined };
        };

        // Try anchors based on provided team names first, then generic keywords
        const anchors = [a, b, 'spread', 'odds', 'total', 'over/under', 'over under', 'line', 'favorite'];
        const nearby = extractNearby(ghtml, anchors, 800);
        const spread = nearby.spread;
        const over_under = nearby.over_under;
        const spread_odds = nearby.spread_odds;

        results.push({ team_a: a, team_b: b, spread, over_under, spread_odds });
      } catch (err) {
        results.push({ team_a: a, team_b: b });
      }
    }
    return results;
  }

  // Fetch Talisman Red predictions page and parse for a given date
  async function fetchTalismanRed(targetDate: string): Promise<MarketLine[]> {
    try {
      const resp = await fetch(`https://talismanred.com/ratings/hoops/predictions.shtml?t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      });
      if (!resp.ok) return [];
      const html = await resp.text();
      const dateStr = `${targetDate.slice(8, 10)}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(targetDate.slice(5,7))-1]}-${targetDate.slice(0,4)}`;
      
      const out: MarketLine[] = [];
      
      // Split by date markers, handling alternating pattern: [before, date1, content1, date2, content2, ...]
      const sections = html.split(new RegExp(`(\\d{2}-\\w{3}-\\d{4})`));
      
      for (let i = 1; i < sections.length; i += 2) {
        const date = sections[i]?.trim() || '';
        const content = sections[i + 1] || '';
        
        if (date !== dateStr) continue;
        
        // Within this date section, find all games (each line with TOTAL HOME/AWAY by SPREAD)
        const gamePattern = /(.+?)\s{2,}(.+?)\s+(\d{2,3})\s+(HOME|AWAY)\s+by\s+([\-\d.]+)/g;
        let gameMatch;
        
        while ((gameMatch = gamePattern.exec(content)) !== null) {
          const [, awayStr, homeStr, totalStr, homeOrAway, predStr] = gameMatch;
          const away = awayStr.trim();
          const home = homeStr.trim();
          
          // Skip header rows
          if (away.includes('---') || home.includes('---') || away.length < 2 || home.length < 2) continue;
          
          const total = Number(totalStr);
          const pred = Number(predStr);
          const spread = homeOrAway === 'AWAY' ? -Math.abs(pred) : Math.abs(pred);
          out.push({ team_a: away, team_b: home, spread, over_under: total });
        }
      }
      
      return out;
    } catch (err) {
      return [];
    }
  }


  // Crawl the covers index page (e.g. /sport/basketball/ncaab/odds) to discover
  // matchup pages and scrape lines from them in bulk.
  async function fetchCoversIndex(indexUrl: string): Promise<MarketLine[]> {
    try {
      const idxResp = await fetch(indexUrl);
      if (!idxResp.ok) return [];
      const idxHtml = await idxResp.text();
      const hrefMatches = Array.from(idxHtml.matchAll(/href=\"(\/sports\/basketball\/ncaab[^\"\s>]*)\"/ig)).map(m => m[1]);
      const unique = Array.from(new Set(hrefMatches));
      const links = unique.map(h => new URL(h, 'https://www.covers.com').toString());
      const out: MarketLine[] = [];
      for (const link of links.slice(0, 80)) {
        try {
          const resp = await fetch(link);
          if (!resp.ok) continue;
          const html = await resp.text();
          // Prefer JSON-LD metadata for team names
          let teamA: string | undefined;
          let teamB: string | undefined;
          const ldMatch = html.match(/<script[^>]*type=\"application\/ld\+json\"[^>]*>([\s\S]*?)<\/script>/i);
          if (ldMatch) {
            try {
              const j = JSON.parse(ldMatch[1]);
              if (j) {
                teamA = j.awayTeam?.name || j.awayTeam || teamA;
                teamB = j.homeTeam?.name || j.homeTeam || teamB;
              }
            } catch (e) { }
          }

          // Fallback: title parsing
          if (!teamA || !teamB) {
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
            const title = titleMatch ? titleMatch[1] : '';
            const teams = title.split(/\s+vs\.\s+|\s+vs\s+|\s+v\s+/i).map(s => s.trim()).filter(Boolean);
            teamA = teamA ?? teams[0];
            teamB = teamB ?? teams[1];
          }

          // Extract nearby numeric info using team anchors then generic keywords
          const extractNearby = (htmlStr: string, anchors: string[], radius = 600) => {
            const low = htmlStr.toLowerCase();
            for (const anchor of anchors) {
              if (!anchor) continue;
              const idx = low.indexOf(anchor.toLowerCase());
              if (idx >= 0) {
                const start = Math.max(0, idx - radius);
                const window = htmlStr.slice(start, idx + radius);
                const spreadMatch = window.match(/([-−–]?\d{1,2}(?:\.\d+)?)(?=\s*(?:pts|points|spread|line|fav|favorite|vs))/i)
                  || window.match(/(?:spread|line|favorite|fav)[^\d\-–−]*([-−–]?\d+(?:\.\d+)?)/i)
                  || window.match(/([-−–]\d+(?:\.\d+)?)/);
                const totalMatch = window.match(/(?:over\/?under|o\/?u|total|over under)[^0-9]{0,6}(\d{2,3}(?:\.\d+)?)/i)
                  || window.match(/(?:total)[:\s]*?(\d{2,3}(?:\.\d+)?)/i);
                const americanMatch = window.match(/([+-]\d{2,3})(?!\d)/);
                return { spread: spreadMatch ? Number(spreadMatch[1].replace(/[−–]/g, '-')) : undefined, over_under: totalMatch ? Number(totalMatch[1]) : undefined, spread_odds: americanMatch ? Number(americanMatch[1].replace(/[−–]/g, '-')) : undefined };
              }
            }
            return { spread: undefined, over_under: undefined, spread_odds: undefined };
          };

          const anchors = [teamA ?? '', teamB ?? '', 'spread', 'odds', 'total', 'over/under', 'over under', 'line', 'favorite'];
          const nearby = extractNearby(html, anchors, 800);
          const spread = nearby.spread;
          const over_under = nearby.over_under;
          const spread_odds = nearby.spread_odds;
          if (teamA && teamB) out.push({ team_a: teamA, team_b: teamB, spread, over_under, spread_odds });
        } catch (err) {
          continue;
        }
      }
      return out;
    } catch (err) {
      return [];
    }
  }

  if ((source === 'live') || (!source && liveUrl)) {
    try {
      // special-case covers.com scraping when liveUrl mentions covers.com
      if (liveUrl.includes('covers.com') && requests && requests.length > 0) {
        const scraped = await fetchFromCovers(requests);
        if (scraped && scraped.length > 0) return scraped;
      }

      // Build query params: optional date or teams may be applied by caller
      const params = new URLSearchParams();
      // If no explicit requests, allow caller to pass nothing; otherwise include teams
      if (requests && requests.length > 0) {
        for (const [a, b] of requests) params.append("pair", `${a}:${b}`);
      }
      const dateParam = process.env.LIVE_ODDS_DATE;
      if (dateParam) params.set("date", dateParam);
      const urlWithParams = params.toString() ? `${liveUrl}?${params.toString()}` : liveUrl;

      const headers: Record<string,string> = {};
      const apiKey = process.env.LIVE_ODDS_API_KEY;
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const resp = await fetch(urlWithParams, { headers });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((m: any) => ({
            team_a: m.team_a,
            team_b: m.team_b,
            spread: m.spread != null ? Number(m.spread) : undefined,
            over_under: m.over_under != null ? Number(m.over_under) : undefined,
          } as MarketLine));
        }
      }
    } catch (err) {
      // fall through to CSV fallback
    }
  }

  // If a covers index URL is provided via env, prefer scraping it for today's matchups
  if ((source === 'covers') || (!source && coversIndexUrl && (!liveUrl || !source))) {
    if (coversIndexUrl) {
      try {
        const scraped = await fetchCoversIndex(coversIndexUrl);
        if (scraped && scraped.length > 0) return scraped;
      } catch (err) {
        // fall through to CSV fallback
      }
    }
  }

  // Try Talisman Red if explicitly requested or as fallback
  if ((source === 'talisman') || (!source && (!requests || requests.length === 0))) {
    try {
      const scraped = await fetchTalismanRed(asOfDate ?? new Date().toISOString().slice(0, 10));
      if (scraped && scraped.length > 0) return scraped;
    } catch (err) {
      // fall through
    }
  }
  try {
    txt = await fs.readFile(csvPath, "utf8");
  } catch (err) {
    return requests && requests.length > 0 ? requests.map(([a, b]) => ({ team_a: a, team_b: b })) : [];
  }

  const rows = txt.split(/\r?\n/).filter(r => r.trim());
  const header = rows.shift()!.split(",");
  const records = rows.map(r => {
    const cols = r.split(",");
    const obj: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = cols[i] ?? "";
    return obj;
  });

  const pad = (n: number) => String(n).padStart(2, "0");
  const todayKey = asOfDate ? asOfDate : (() => { const today = new Date(); return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`; })();

  // If explicit requests are provided, try to match them to known rows
  if (requests && requests.length > 0) {
    const out: MarketLine[] = [];
    for (const [a, b] of requests) {
      const matches = records.filter(r => (r.team_a === a && r.team_b === b) || (r.team_a === b && r.team_b === a));
      if (matches.length === 0) {
        out.push({ team_a: a, team_b: b });
        continue;
      }
      let pick = matches.find(m => m.date >= todayKey) ?? matches[0];
      if (pick.team_a !== a) {
        const spreadVal = pick.spread ? -Number(pick.spread) : undefined;
        const spreadOdds = pick.spread_odds ? Number(pick.spread_odds) : undefined;
        out.push({ team_a: a, team_b: b, spread: spreadVal, over_under: pick.over_under ? Number(pick.over_under) : undefined, spread_odds: spreadOdds });
      } else {
        const spreadOdds = pick.spread_odds ? Number(pick.spread_odds) : undefined;
        out.push({ team_a: a, team_b: b, spread: pick.spread ? Number(pick.spread) : undefined, over_under: pick.over_under ? Number(pick.over_under) : undefined, spread_odds: spreadOdds });
      }
    }
    return out;
  }

  const upcoming = records
    .filter(r => r.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 50)
    .map(r => ({
        team_a: r.team_a,
        team_b: r.team_b,
        spread: r.spread ? Number(r.spread) : undefined,
        over_under: r.over_under ? Number(r.over_under) : undefined,
        spread_odds: r.spread_odds ? Number(r.spread_odds) : undefined,
    } as MarketLine));

  return upcoming;
}

async function main() {
  // parse simple CLI flags: --date YYYY-MM-DD and --max N, or provide pairs
  const argv = process.argv.slice(2);
  let reqPairs: Array<[string,string]> = [];
  let dateArg: string | undefined;
  let maxArg: number | undefined;
  let watchArg: number | undefined;
  let sourceArg: string | undefined = undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--date" && argv[i+1]) { dateArg = argv[++i]; continue; }
    if (a === "--max" && argv[i+1]) { maxArg = Number(argv[++i]); continue; }
    if (a === "--watch" && argv[i+1]) { watchArg = Number(argv[++i]); continue; }
    if (a === "--backtest") { reqPairs = []; argv.splice(i,1); i--; /* continue scanning */; continue; }
    if (a === "--source" && argv[i+1]) { sourceArg = argv[++i]; continue; }
    // allow team pairs as `"Team A:Team B"`
    if (a.includes(":")) {
      const [x,y] = a.split(":"); reqPairs.push([x.trim(), y.trim()]);
    }
  }

  const isBacktest = process.argv.includes('--backtest');

  async function run_backtest() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const csvPath = path.resolve(__dirname, "../../data/raw/odds_history.csv");
    let txt: string;
    try { txt = await fs.readFile(csvPath, 'utf8'); } catch (e) { console.error('No odds_history.csv found for backtest'); return; }
    const rows = txt.split(/\r?\n/).filter(r => r.trim());
    const header = rows.shift()!.split(',');
    const records = rows.map(r => {
      const cols = r.split(','); const obj: Record<string,string> = {}; for (let i=0;i<header.length;i++) obj[header[i]] = cols[i] ?? ''; return obj;
    });

    const initialBankroll = Number(process.env.BANKROLL ?? '1000');
    let bankroll = initialBankroll;
    const outRows: string[] = [];
    outRows.push(['date','team_a','team_b','market_spread','final_margin','win','stake','pnl','bankroll_after','ev_per_1','kelly','coverProb','impliedProb','edge'].join(','));

    for (const r of records) {
      const gameDate = r.date;
      const teamAname = r.team_a; const teamBname = r.team_b;
      const market_spread = r.spread ? Number(r.spread) : undefined;
      const final_margin = r.final_margin ? Number(r.final_margin) : undefined;

      const ratings = await load_team_ratings(gameDate);
      const teamA = ratings[teamAname] ?? ({ id: teamAname } as TeamRecord);
      const teamB = ratings[teamBname] ?? ({ id: teamBname } as TeamRecord);
      const comp = compare_teams(teamA, teamB, false, 2000, market_spread);
      const sim = simulate_game(teamA, teamB, false, 3000);

      const coverProb = (Array.isArray(sim.samples) && typeof market_spread === 'number') ? sim.samples.filter(m=>m>market_spread).length / sim.samples.length : undefined;

      let impliedProb = 1/1.9090909090909092; let decimalOdds = 1.9090909090909092;
      if (r.spread_odds) {
        const aodds = Number(r.spread_odds);
        if (!isNaN(aodds)) {
          decimalOdds = aodds < 0 ? 1 + 100/Math.abs(aodds) : 1 + aodds/100;
          impliedProb = 1/decimalOdds;
        }
      }

      let ev_per_1: number | undefined = undefined; let kelly: number | undefined = undefined; let edge: number | undefined = undefined;
      if (typeof coverProb === 'number') {
        const b = decimalOdds - 1; ev_per_1 = coverProb * b - (1 - coverProb) * 1; kelly = (b * coverProb - (1 - coverProb)) / b; if (kelly < 0) kelly = 0; edge = coverProb - impliedProb;
      }

      const stake = (kelly ?? 0) * bankroll;
      let pnl = 0;
      let win = false;
      if (typeof final_margin === 'number' && typeof market_spread === 'number') {
        win = final_margin > market_spread;
        if (win) pnl = stake * (decimalOdds - 1); else pnl = -stake;
      }
      bankroll += pnl;

      outRows.push([gameDate, teamAname, teamBname, market_spread ?? '', final_margin ?? '', win ? 1 : 0, stake.toFixed(2), pnl.toFixed(2), bankroll.toFixed(2), (ev_per_1 ?? '').toString(), (kelly ?? '').toString(), (coverProb ?? '').toString(), impliedProb.toString(), (edge ?? '').toString()].join(','));
    }

    try {
      const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'results');
      await fs.mkdir(outDir, { recursive: true } as any);
      await fs.writeFile(path.resolve(outDir, 'backtest_report.csv'), outRows.join('\n'), 'utf8');
      await fs.writeFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'last_backtest_summary.txt'), `Backtest complete. Start bankroll=${Number(process.env.BANKROLL ?? '1000')}, End bankroll=${bankroll.toFixed(2)}`, 'utf8');
      console.log('Backtest complete. Report: data/results/backtest_report.csv');
    } catch (e) {
      console.error('Failed to write backtest results', e);
    }
  }

  // render once or in watch mode
  const renderOnce = async () => {
    const ratings = await load_team_ratings(dateArg ?? new Date().toISOString().slice(0,10));
    const marketLines = await get_market_lines(reqPairs.length ? reqPairs : [], dateArg ?? new Date().toISOString().slice(0,10), sourceArg);
    if (!reqPairs.length && maxArg) marketLines.splice(maxArg);

    let out = "";
    const picks: Array<{
      team_a: string;
      team_b: string;
      market_spread?: number;
      model_spread?: number;
      coverProb?: number;
      overProb?: number;
      modelTotal?: number;
      impliedProb?: number;
      edge?: number;
      ev_per_1?: number;
      kelly?: number;
      stake_dollars?: number;
    }> = [];

    for (const game of marketLines) {
      const teamA = ratings[game.team_a] ?? ({ id: game.team_a } as TeamRecord);
      const teamB = ratings[game.team_b] ?? ({ id: game.team_b } as TeamRecord);

      const comp = compare_teams(teamA, teamB, false, 2000, game.spread);
      const sim = simulate_game(teamA, teamB, false, 5000);

      const coverProb = Array.isArray(sim.samples) && typeof game.spread === "number"
        ? sim.samples.filter(m => m > game.spread!).length / sim.samples.length
        : undefined;

      const overProb = Array.isArray(sim.totals) && typeof game.over_under === "number"
        ? sim.totals.filter(t => t > game.over_under!).length / sim.totals.length
        : undefined;

      const possessions = comp.projected_possessions;
      const adjOffA = teamA.metrics?.offensive_efficiency ?? 100;
      const adjDefA = teamA.metrics?.defensive_efficiency ?? 100;
      const adjOffB = teamB.metrics?.offensive_efficiency ?? 100;
      const adjDefB = teamB.metrics?.defensive_efficiency ?? 100;
      const expectedA = possessions * (adjOffA / 100) * (adjDefB / 100);
      const expectedB = possessions * (adjOffB / 100) * (adjDefA / 100);
      const modelTotal = expectedA + expectedB;

      const modelSpread = Number((comp.projected_spread ?? sim.mean).toFixed(1));

      // Default market implied probability for spread bets (assume -110 vig)
      const impliedProbDefault = 1 / 1.9090909090909092; // ~0.5238 for -110

      let impliedProb = impliedProbDefault;
      // Determine decimal odds used for implied probability (market-provided or default -110)
      let decimalOdds = 1.9090909090909092;
      if (typeof (game as any).spread_odds === "number") {
        const aodds = Number((game as any).spread_odds);
        let decimal: number;
        if (aodds < 0) decimal = 1 + 100 / Math.abs(aodds);
        else decimal = 1 + aodds / 100;
        impliedProb = 1 / decimal;
        decimalOdds = decimal;
      }

      let edge: number | undefined = undefined;
      let ev_per_1: number | undefined = undefined;
      let kelly: number | undefined = undefined;
      if (typeof coverProb === "number") {
        edge = coverProb - impliedProb;
        const b = decimalOdds - 1;
        ev_per_1 = coverProb * b - (1 - coverProb) * 1;
        // Kelly fraction (fraction of bankroll): (b*p - q) / b
        kelly = (b * coverProb - (1 - coverProb)) / b;
        if (kelly < 0) kelly = 0;
      }

      // Bankroll (dollars) from env, default to 1000
      const bankroll = Number(process.env.BANKROLL ?? "1000");
      const stake_dollars = (kelly ?? 0) * bankroll;

      picks.push({
        team_a: game.team_a,
        team_b: game.team_b,
        market_spread: game.spread,
        model_spread: modelSpread,
        coverProb,
        overProb,
        modelTotal,
        impliedProb,
        edge,
        ev_per_1,
        kelly,
        stake_dollars,
      });

      out += `\nGame: ${game.team_a} vs ${game.team_b}\n`;
      out += `Model Spread: ${modelSpread}\n`;
      out += `Cover Prob (A covers): ${coverProb === undefined ? "n/a" : (coverProb * 100).toFixed(1) + "%"}\n`;
      out += `Over Prob: ${overProb === undefined ? "n/a" : (overProb * 100).toFixed(1) + "%"}\n`;
      out += `Model Total: ${Number(modelTotal.toFixed(1))}\n`;
      out += `Market Spread: ${game.spread ?? "n/a"} Total: ${game.over_under ?? "n/a"}\n`;
      if (edge !== undefined) out += `Edge vs implied: ${(edge * 100).toFixed(2)}% EV/$1: ${ev_per_1?.toFixed(3)} Kelly: ${(kelly ?? 0).toFixed(3)}\n`;
    }

    // Rank picks by EV per $1 (descending) and write CSV + summary
    const ranked = picks.filter(p => typeof p.ev_per_1 === "number" && (p.coverProb ?? 0) > 0.65).sort((a,b) => (b.ev_per_1 ?? 0) - (a.ev_per_1 ?? 0));
    const top = ranked.slice(0, 20);
    const csvRows = [
      ["date","team_a","team_b","market_spread","model_spread","coverProb","impliedProb","edge","ev_per_1","kelly","stake_dollars"].join(",")
    ];
    const nowKey = new Date().toISOString();
    for (const r of ranked) {
      csvRows.push([nowKey, r.team_a, r.team_b, r.market_spread ?? "", r.model_spread ?? "", r.coverProb ?? "", r.impliedProb ?? "", r.edge ?? "", r.ev_per_1 ?? "", r.kelly ?? "", r.stake_dollars ?? ""].join(","));
    }

    try {
      const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "results");
      await fs.mkdir(outDir, { recursive: true } as any);
      await fs.writeFile(path.resolve(outDir, "ts_projector_picks.csv"), csvRows.join("\n"), "utf8");
      // Also write to enhanced_projector_picks.csv (for consistency with workflow)
      await fs.writeFile(path.resolve(outDir, "enhanced_projector_picks.csv"), csvRows.join("\n"), "utf8");
      const summary = top.map((t,i) => `${i+1}. ${t.team_a} vs ${t.team_b} — EV/$1=${(t.ev_per_1 ?? 0).toFixed(3)} Kelly=${(t.kelly ?? 0).toFixed(3)} Stake=$${((t.stake_dollars ?? 0)).toFixed(2)} Cover=${t.coverProb ? (t.coverProb*100).toFixed(1)+"%" : "n/a"}`).join("\n");
      await fs.writeFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "last_projector_picks.txt"), summary, "utf8");
      // also save verbose output
      await fs.writeFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "last_projector_output.txt"), out, "utf8");
    } catch (err) {
      // ignore write errors
    }
    console.log(out);
    console.log("\nTop Picks:\n", top.map((t,i) => {
      const displayTeams = (t.coverProb ?? 0) > 0.5 
        ? `**${t.team_a}** vs ${t.team_b}` 
        : `${t.team_a} vs **${t.team_b}**`;
      return `${i+1}. ${displayTeams} — EV/$1=${(t.ev_per_1 ?? 0).toFixed(3)} Kelly=${(t.kelly ?? 0).toFixed(3)} Cover=${t.coverProb ? (t.coverProb*100).toFixed(1)+"%" : "n/a"}`;
    }).join("\n"));
  };

  if (watchArg && watchArg > 0) {
    await renderOnce();
    setInterval(() => { renderOnce().catch(err => console.error(err)); }, watchArg * 1000);
    return;
  }

  if (isBacktest) {
    await run_backtest();
    return;
  }

  await renderOnce();
}

if (import.meta && (import.meta as any).main) {
  main().catch(err => { console.error(err); process.exit(1); });
}
