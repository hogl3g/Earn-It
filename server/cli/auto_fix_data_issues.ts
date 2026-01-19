import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { normalizeTeamName } from '../../shared/team_names';

function formatDateYYYYMMDD(input: string): string {
  if (!input) return '';
  const iso = new Date(input);
  if (!isNaN(iso.getTime())) {
    const y = iso.getUTCFullYear();
    const m = String(iso.getUTCMonth() + 1).padStart(2, '0');
    const d = String(iso.getUTCDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  const onlyDigits = input.replace(/[^0-9]/g, '');
  if (onlyDigits.length === 8) return onlyDigits;
  return onlyDigits;
}

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function cleanGrades(resultsDir: string, cleanDir: string) {
  const files = fs.readdirSync(resultsDir).filter(f => f.startsWith('grades_') && (f.endsWith('.json') || f.endsWith('.csv')));
  const jsonDates = new Set<string>();

  for (const f of files) {
    const full = path.join(resultsDir, f);
    if (f.endsWith('.json')) {
      const json = JSON.parse(fs.readFileSync(full, 'utf8')) as any;
      const rows: any[] = Array.isArray(json) ? json : (Array.isArray(json.rows) ? json.rows : []);
      const dd = (json.summary && json.summary.date) ? formatDateYYYYMMDD(String(json.summary.date)) : f.replace(/[^0-9]/g, '').slice(0, 8);
      jsonDates.add(dd);
      const cleanRows = rows.filter(r => isFinite(Number(r.a_score ?? r.homeScore ?? r.hScore ?? r.home_points)) && isFinite(Number(r.b_score ?? r.awayScore ?? r.aScore ?? r.away_points))).map(r => ({
        team_a: normalizeTeamName(String(r.team_a ?? r.homeTeam ?? r.home ?? '').trim()),
        team_b: normalizeTeamName(String(r.team_b ?? r.awayTeam ?? r.away ?? '').trim()),
        a_score: Number(r.a_score ?? r.homeScore ?? r.hScore ?? r.home_points ?? 0),
        b_score: Number(r.b_score ?? r.awayScore ?? r.aScore ?? r.away_points ?? 0),
        market_spread: r.market_spread != null ? Number(r.market_spread) : (r.closingSpread != null ? Number(r.closingSpread) : undefined),
        model_spread: r.model_spread != null ? Number(r.model_spread) : undefined,
        covered: r.covered ?? undefined
      }));
      const clean = { summary: { date: dd, total_picks: cleanRows.length }, rows: cleanRows };
      const out = path.join(cleanDir, `grades_${dd}.json`);
      fs.writeFileSync(out, JSON.stringify(clean, null, 2));
      console.log('Wrote cleaned grades:', out);
    }
  }

  // Process CSV only if JSON for that date does not exist
  for (const f of files) {
    if (!f.endsWith('.csv')) continue;
    const full = path.join(resultsDir, f);
    const dd = f.replace(/[^0-9]/g, '').slice(0, 8);
    if (jsonDates.has(dd)) continue;
    const content = fs.readFileSync(full, 'utf8');
    const rows = parse(content, { columns: true, skip_empty_lines: true });
    const cleanRows = rows.filter((r: any) => isFinite(Number(r.HomeScore ?? r.homeScore)) && isFinite(Number(r.AwayScore ?? r.awayScore))).map((r: any) => ({
      team_a: normalizeTeamName(String(r.HomeTeam ?? r.homeTeam ?? '').trim()),
      team_b: normalizeTeamName(String(r.AwayTeam ?? r.awayTeam ?? '').trim()),
      a_score: Number(r.HomeScore ?? r.homeScore ?? 0),
      b_score: Number(r.AwayScore ?? r.awayScore ?? 0),
      market_spread: r.closingSpread != null ? Number(r.closingSpread) : undefined,
      model_spread: r.model_spread != null ? Number(r.model_spread) : undefined,
      covered: (r.Covered ?? r.covered ?? '').toString().toLowerCase() === 'true' ? true : ((r.Covered ?? r.covered ?? '').toString().toLowerCase() === 'false' ? false : undefined)
    }));
    const clean = { summary: { date: dd, total_picks: cleanRows.length }, rows: cleanRows };
    const out = path.join(cleanDir, `grades_${dd}.json`);
    fs.writeFileSync(out, JSON.stringify(clean, null, 2));
    console.log('Wrote cleaned grades:', out);
  }
}

function cleanPicks(resultsDir: string, cleanDir: string) {
  const picksPath = path.join(resultsDir, 'ts_projector_picks.csv');
  if (!fs.existsSync(picksPath)) {
    console.log('No picks file found:', picksPath);
    return;
  }
  const content = fs.readFileSync(picksPath, 'utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true });
  const cleanRows = rows.map((r: any) => {
    const date = formatDateYYYYMMDD(String(r.date ?? r.Date ?? ''));
    const team_a = normalizeTeamName(String(r.team_a ?? r.team ?? '').trim());
    const team_b = normalizeTeamName(String(r.team_b ?? r.opponent ?? '').trim());
    const cover_prob_raw = r.coverProb ?? r.cover_prob ?? r.CoverProb ?? r.cp ?? r.prob;
    let cover_prob = typeof cover_prob_raw === 'string' ? parseFloat(cover_prob_raw) : Number(cover_prob_raw);
    if (!isFinite(cover_prob)) cover_prob = 0.5;
    if (cover_prob <= 0) cover_prob = 0.01;
    if (cover_prob >= 1) cover_prob = 0.99;
    const market_spread = r.market_spread != null ? Number(r.market_spread) : (r.spread != null ? Number(r.spread) : undefined);
    return { date, team_a, team_b, cover_prob, market_spread };
  });
  const csv = stringify(cleanRows, { header: true });
  const out = path.join(cleanDir, 'ts_projector_picks.csv');
  fs.writeFileSync(out, csv);
  console.log('Wrote cleaned picks:', out);
}

function main() {
  const metaPath = decodeURIComponent(new URL(import.meta.url).pathname);
  const filePath = path.normalize(metaPath.replace(/^\//, ''));
  const workspace = path.resolve(path.dirname(filePath), '../..');
  const resultsDir = path.join(workspace, 'data', 'results');
  const cleanDir = path.join(resultsDir, 'clean');
  ensureDir(cleanDir);

  cleanGrades(resultsDir, cleanDir);
  cleanPicks(resultsDir, cleanDir);

  console.log('Auto-fix complete. Cleaned datasets saved to:', cleanDir);
}

main();
