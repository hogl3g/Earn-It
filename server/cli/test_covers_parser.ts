import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseIndexLinks(html: string) {
  const matches = Array.from(html.matchAll(/href=\"(\/sports\/basketball\/ncaab[^\"\s>]*)\"/ig)).map(m=>m[1]);
  return Array.from(new Set(matches)).slice(0,40).map(h=>new URL(h, 'https://www.covers.com').toString());
}

function parseMatchup(html: string) {
  const out: any = {};
  // JSON-LD
  const ld = html.match(/<script[^>]*type=\"application\/ld\+json\"[^>]*>([\s\S]*?)<\/script>/i);
  if (ld) {
    try { const j = JSON.parse(ld[1]); out.jsonld = j; } catch(e) {}
  }

  const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1];
  out.title = title;
  // team name candidates from title and page headings
  const teamsFromTitle = title ? title.split(/\s+vs\.\s+|\s+vs\s+|\s+v\s+/i).map(s=>s.trim()).filter(Boolean) : [];
  out.teams = teamsFromTitle;

  // team blocks
  const teamNameMatches = Array.from(html.matchAll(/class=\"?matchup-team-name[^\">]*\"?[^>]*>([^<]+)<\/span>/ig)).map(m=>m[1].trim());
  if (teamNameMatches.length) out.team_blocks = teamNameMatches;

  // look for spreads/totals and american odds nearby team names
  const low = html.toLowerCase();
  const anchors = [...teamsFromTitle, ...(teamNameMatches || [])];
  const findNearby = (anchor: string) => {
    const idx = low.indexOf(anchor.toLowerCase());
    if (idx < 0) return null;
    const start = Math.max(0, idx - 600);
    const win = html.slice(start, idx + 600);
    const spreadMatch = win.match(/([-−–]?\d{1,2}(?:\.\d+)?)(?=\s*(?:pts|points|spread|line|fav|favorite|vs))/i) || win.match(/(?:spread|line|favorite|fav)[^\d\-–−]*([-−–]?\d+(?:\.\d+)?)/i) || win.match(/([-−–]\d+(?:\.\d+)?)/);
    const totalMatch = win.match(/(?:over\/?under|o\/?u|total|over under)[^0-9]{0,6}(\d{2,3}(?:\.\d+)?)/i) || win.match(/(?:total)[:\s]*?(\d{2,3}(?:\.\d+)?)/i);
    const americanMatch = win.match(/([+-]\d{2,3})(?!\d)/);
    return { spread: spreadMatch ? spreadMatch[1] : null, total: totalMatch ? totalMatch[1] : null, american: americanMatch ? americanMatch[1] : null };
  };
  out.nearby = anchors.map(a=>({anchor: a, nearby: findNearby(a)})).filter(x=>x.anchor && x.nearby);

  // generic odds blocks
  const oddsAll = Array.from(html.matchAll(/([+-]\d{2,3})(?!\d)/g)).map(m=>m[1]);
  out.all_american = oddsAll.slice(0,40);

  return out;
}

async function run() {
  const dir = path.resolve(__dirname);
  const idxPath = path.resolve(dir, 'covers_index.html');
  const matchupPath = path.resolve(dir, 'matchup_364637.html');
  try {
    const idxHtml = await fs.readFile(idxPath, 'utf8');
    const links = parseIndexLinks(idxHtml);
    console.log('Found links from index:', links.slice(0,10));
  } catch (e) { console.log('No covers_index.html found locally'); }

  try {
    const mhtml = await fs.readFile(matchupPath, 'utf8');
    const p = parseMatchup(mhtml);
    console.log('Matchup parse result:');
    console.log(' Title:', p.title);
    console.log(' JSON-LD present:', !!p.jsonld);
    console.log(' Teams from title:', p.teams);
    console.log(' Team blocks:', p.team_blocks || []);
    console.log(' Nearby matches:', JSON.stringify(p.nearby, null, 2));
    console.log(' First american odds found:', (p.all_american || []).slice(0,10));
  } catch (e) { console.log('No matchup_364637.html found locally'); }
}

run().catch(e=>{ console.error(e); process.exit(1); });
