import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { normalizeTeamName } from '../../shared/team_names';

interface PickRow {
  date: string; // ISO or YYYY-MM-DD
  team: string;
  opponent: string;
  coverProb: number;
  marketSpread?: number;
}

interface GradeRecord {
  date: string; // YYYYMMDD
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  covered?: boolean; // if present
  closingSpread?: number; // market close
}

interface CalibrationResult {
  a: number;
  b: number;
  sampleSize: number;
  dateRange: { start: string; end: string };
  bucketMetrics: Array<{ bucket: string; n: number; predAvg: number; hitRate: number }>;
  status?: 'ok' | 'insufficient-variance' | 'small-sample';
}

function formatDateForGrades(input: string): string {
  // Converts ISO or YYYY-MM-DD to YYYYMMDD
  const iso = new Date(input);
  if (!isNaN(iso.getTime())) {
    const y = iso.getUTCFullYear();
    const m = String(iso.getUTCMonth() + 1).padStart(2, '0');
    const d = String(iso.getUTCDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
  // Try YYYY-MM-DD
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  // Already YYYYMMDD
  if (/^\d{8}$/.test(input)) return input;
  return input;
}

function readPicksCSV(picksPath: string): PickRow[] {
  if (!fs.existsSync(picksPath)) return [];
  const content = fs.readFileSync(picksPath, 'utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true });
  const out: PickRow[] = [];
  for (const r of rows as any[]) {
    const team = normalizeTeamName(String((r as any).team || (r as any).Team || (r as any).team_a || '').trim());
    const opponent = normalizeTeamName(String((r as any).opponent || (r as any).Opponent || (r as any).oppo || (r as any).team_b || '').trim());
    const date = String((r as any).date || (r as any).Date || '').trim();
    const probRaw = (r as any).coverProb ?? (r as any).CoverProb ?? (r as any).cp ?? (r as any).prob ?? (r as any).cover_prob;
    const coverProb = typeof probRaw === 'string' ? parseFloat(probRaw) : Number(probRaw);
    const marketSpreadRaw = (r as any).marketSpread ?? (r as any).MarketSpread ?? (r as any).spread ?? (r as any).market_spread;
    const marketSpread = marketSpreadRaw != null ? Number(marketSpreadRaw) : undefined;
    if (!team || !opponent || !date || !isFinite(coverProb)) continue;
    out.push({ date, team, opponent, coverProb, marketSpread });
  }
  return out;
}

function readGradeFiles(resultsDir: string): GradeRecord[] {
  if (!fs.existsSync(resultsDir)) return [];
  const files = fs.readdirSync(resultsDir).filter(f => f.startsWith('grades_') && (f.endsWith('.json') || f.endsWith('.csv')));
  const byDate: Map<string, GradeRecord[]> = new Map();
  const hasJsonDate = new Set<string>();

  for (const f of files) {
    const full = path.join(resultsDir, f);
    if (f.endsWith('.json')) {
      const json = JSON.parse(fs.readFileSync(full, 'utf8')) as any;
      const rows: any[] = Array.isArray(json) ? json : (Array.isArray(json.rows) ? json.rows : []);
      const dd = (json.summary && json.summary.date) ? String(json.summary.date).replace(/[^0-9]/g, '') : f.replace(/[^0-9]/g, '').slice(0, 8);
      hasJsonDate.add(dd);
      for (const r of rows) {
        const rec: GradeRecord = {
          date: dd,
          homeTeam: normalizeTeamName(String(r.homeTeam ?? r.home ?? r.team_a ?? '').trim()),
          awayTeam: normalizeTeamName(String(r.awayTeam ?? r.away ?? r.team_b ?? '').trim()),
          homeScore: Number(r.homeScore ?? r.hScore ?? r.home_points ?? r.a_score ?? 0),
          awayScore: Number(r.awayScore ?? r.aScore ?? r.away_points ?? r.b_score ?? 0),
          covered: r.covered ?? r.cover ?? undefined,
          closingSpread: r.closingSpread != null ? Number(r.closingSpread) : (r.market_spread != null ? Number(r.market_spread) : undefined),
        };
        if (!byDate.has(dd)) byDate.set(dd, []);
        byDate.get(dd)!.push(rec);
      }
    } else if (f.endsWith('.csv')) {
      const content = fs.readFileSync(full, 'utf8');
      const rows = parse(content, { columns: true, skip_empty_lines: true });
      const dd = f.replace(/[^0-9]/g, '').slice(0, 8);
      if (hasJsonDate.has(dd)) {
        // Skip CSV for dates already covered by JSON to avoid duplicates
        continue;
      }
      if (!byDate.has(dd)) byDate.set(dd, []);
      for (const r of rows as any[]) {
        const rec: GradeRecord = {
          date: dd,
          homeTeam: normalizeTeamName(String((r as any).homeTeam ?? (r as any).HomeTeam ?? '').trim()),
          awayTeam: normalizeTeamName(String((r as any).awayTeam ?? (r as any).AwayTeam ?? '').trim()),
          homeScore: Number((r as any).homeScore ?? (r as any).HomeScore ?? 0),
          awayScore: Number((r as any).awayScore ?? (r as any).AwayScore ?? 0),
          covered: ((r as any).covered ?? (r as any).Covered ?? '') === 'true' ? true : (((r as any).covered ?? (r as any).Covered ?? '') === 'false' ? false : undefined),
          closingSpread: (r as any).closingSpread != null ? Number((r as any).closingSpread) : undefined,
        };
        byDate.get(dd)!.push(rec);
      }
    }
  }

  const out: GradeRecord[] = [];
  for (const [d, arr] of byDate.entries()) {
    out.push(...arr);
  }
  return out;
}

function matchPickToGrade(p: PickRow, gradesByDate: Map<string, GradeRecord[]>): GradeRecord | undefined {
  const d = formatDateForGrades(p.date);
  const candidates = gradesByDate.get(d);
  if (!candidates) return undefined;
  const team = normalizeTeamName(p.team);
  const opp = normalizeTeamName(p.opponent);
  // Try direct match (home vs away or away vs home)
  for (const g of candidates) {
    const h = normalizeTeamName(g.homeTeam);
    const a = normalizeTeamName(g.awayTeam);
    if ((team === h && opp === a) || (team === a && opp === h)) {
      return g;
    }
  }
  // Fallback fuzzy: includes
  for (const g of candidates) {
    const h = normalizeTeamName(g.homeTeam);
    const a = normalizeTeamName(g.awayTeam);
    if ((team.includes(h) || h.includes(team)) && (opp.includes(a) || a.includes(opp))) {
      return g;
    }
  }
  return undefined;
}

function fitLinearCalibration(pVals: number[], outcomes: number[]): { a: number; b: number } {
  const n = pVals.length;
  const meanX = pVals.reduce((s, v) => s + v, 0) / n;
  const meanY = outcomes.reduce((s, v) => s + v, 0) / n;
  let cov = 0, varX = 0;
  for (let i = 0; i < n; i++) {
    cov += (pVals[i] - meanX) * (outcomes[i] - meanY);
    varX += (pVals[i] - meanX) ** 2;
  }
  const b = varX > 0 ? cov / varX : 0;
  const a = meanY - b * meanX;
  return { a, b };
}

function clamp01(x: number): number {
  return Math.max(0.01, Math.min(0.99, x));
}

function bucketize(p: number): string {
  const b = Math.floor(p * 10) / 10; // 0.0, 0.1, ...
  const lo = b.toFixed(1);
  const hi = Math.min(1, b + 0.1).toFixed(1);
  return `${lo}-${hi}`;
}

function main() {
  const metaPath = decodeURIComponent(new URL(import.meta.url).pathname);
  const filePath = path.normalize(metaPath.replace(/^\//, ''));
  const workspace = path.resolve(path.dirname(filePath), '../..');
  let resultsDir = path.join(workspace, 'data', 'results');
  const cleanDir = path.join(resultsDir, 'clean');
  if (fs.existsSync(cleanDir)) {
    resultsDir = cleanDir;
  }
  const picksPath = path.join(resultsDir, 'ts_projector_picks.csv');
  const altPicks = path.join(resultsDir, 'enhanced_picks_with_ci.csv');
  const outCalibPath = path.join(resultsDir, 'prob_calibration.json');
  const outRecalibratedPicks = path.join(resultsDir, 'recalibrated_picks.csv');

  const picksSource = fs.existsSync(altPicks) ? altPicks : picksPath;
  const picks = readPicksCSV(picksSource);
  const grades = readGradeFiles(resultsDir);
  const gradesByDate = new Map<string, GradeRecord[]>();
  for (const g of grades) {
    const d = g.date;
    if (!gradesByDate.has(d)) gradesByDate.set(d, []);
    gradesByDate.get(d)!.push(g);
  }

  // Collect matched samples over last ~30 days (filter by date proximity if available)
  const samples: Array<{ p: number; y: number; bucket: string }> = [];
  for (const p of picks) {
    const g = matchPickToGrade(p, gradesByDate);
    if (!g) continue;
    // Determine outcome: covered if explicitly provided, else infer by margin vs spread if possible
    let y: number | undefined = undefined;
    if (typeof g.covered === 'boolean') {
      y = g.covered ? 1 : 0;
    } else if (isFinite(g.homeScore) && isFinite(g.awayScore)) {
      const margin = g.homeScore - g.awayScore;
      // If team is home, margin should align with fav; we don't know fav side; fallback to binary win for team
      // As we lack full bet orientation, approximate using straight-up win for team
      const teamIsHome = normalizeTeamName(p.team) === normalizeTeamName(g.homeTeam);
      y = teamIsHome ? (margin > 0 ? 1 : 0) : (margin < 0 ? 1 : 0);
    }
    if (y === undefined) continue;
    const prob = p.coverProb;
    if (!isFinite(prob)) continue;
    samples.push({ p: prob, y, bucket: bucketize(prob) });
  }

  if (samples.length < 15) {
    // Fallback: use backtest_report.csv (self-contained historical outcomes)
    const backtestPath = path.join(workspace, 'data', 'results', 'backtest_report.csv');
    if (!fs.existsSync(backtestPath)) {
      console.log(`Not enough matched samples (${samples.length}) and no backtest_report.csv found.`);
      process.exit(0);
    }
    console.log(`Insufficient matched samples (${samples.length}). Falling back to backtest_report.csv.`);
    const content = fs.readFileSync(backtestPath, 'utf8');
    const rows = parse(content, { columns: true, skip_empty_lines: true });
    for (const r of rows as any[]) {
      const pRaw = (r as any).coverProb ?? (r as any).CoverProb ?? (r as any).cp ?? (r as any).prob;
      const p = typeof pRaw === 'string' ? parseFloat(pRaw) : Number(pRaw);
      const yRaw = (r as any).win ?? (r as any).Win ?? (r as any).covered ?? (r as any).Covered;
      const y = String(yRaw).toLowerCase() === 'true' || Number(yRaw) === 1 ? 1 : 0;
      if (isFinite(p)) {
        samples.push({ p, y, bucket: bucketize(p) });
      }
    }
    if (samples.length < 3) {
      console.log(`Backtest fallback still insufficient (samples=${samples.length}). Exiting.`);
      process.exit(0);
    } else if (samples.length < 15) {
      console.log(`Warning: small sample size (${samples.length}). Calibration may be noisy.`);
    }
  }

  const pVals = samples.map(s => s.p);
  const outcomes = samples.map(s => s.y);
  const { a, b } = fitLinearCalibration(pVals, outcomes);
  // Check outcome variance
  const meanY = outcomes.reduce((s, v) => s + v, 0) / outcomes.length;
  const varY = outcomes.reduce((s, v) => s + (v - meanY) * (v - meanY), 0) / outcomes.length;
  const bucketsMap = new Map<string, { n: number; predSum: number; hitSum: number }>();
  for (const s of samples) {
    const bKey = s.bucket;
    if (!bucketsMap.has(bKey)) bucketsMap.set(bKey, { n: 0, predSum: 0, hitSum: 0 });
    const agg = bucketsMap.get(bKey)!;
    agg.n += 1;
    agg.predSum += s.p;
    agg.hitSum += s.y;
  }
  const bucketMetrics = Array.from(bucketsMap.entries()).sort().map(([bucket, agg]) => ({
    bucket,
    n: agg.n,
    predAvg: agg.predSum / agg.n,
    hitRate: agg.hitSum / agg.n,
  }));

  const calib: CalibrationResult = {
    a,
    b,
    sampleSize: samples.length,
    dateRange: { start: '', end: '' },
    bucketMetrics,
    status: (samples.length < 15 ? 'small-sample' : 'ok'),
  };
  if (varY === 0) {
    calib.status = 'insufficient-variance';
  }

  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(outCalibPath, JSON.stringify(calib, null, 2));
  console.log('Saved calibration to:', outCalibPath);
  console.log(`Params: a=${a.toFixed(4)}, b=${b.toFixed(4)}, samples=${samples.length}`);
  console.log('Bucket metrics:');
  for (const m of bucketMetrics) {
    console.log(`  ${m.bucket} -> n=${m.n}, pred=${(m.predAvg*100).toFixed(1)}%, hit=${(m.hitRate*100).toFixed(1)}%`);
  }

  // Produce recalibrated picks CSV
  const recalRows = picks.map(p => {
    const pCal = clamp01(a + b * p.coverProb);
    return { ...p, coverProbCalibrated: pCal } as any;
  });
  const csv = stringify(recalRows, { header: true });
  fs.writeFileSync(outRecalibratedPicks, csv);
  console.log('Wrote recalibrated picks to:', outRecalibratedPicks);
}

main();
