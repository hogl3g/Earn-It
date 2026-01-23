import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { normalizeTeamName } from '../../shared/team_names';

interface ValidationIssue {
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  context?: any;
}

function listGradeFiles(resultsDir: string): string[] {
  if (!fs.existsSync(resultsDir)) return [];
  return fs.readdirSync(resultsDir).filter(f => f.startsWith('grades_') && (f.endsWith('.json') || f.endsWith('.csv')));
}

function validateGrades(resultsDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const files = listGradeFiles(resultsDir);
  const seenPairs = new Set<string>();

  for (const f of files) {
    const full = path.join(resultsDir, f);
    try {
      if (f.endsWith('.json')) {
        const arr = JSON.parse(fs.readFileSync(full, 'utf8')) as any[];
        for (const r of arr) {
          const date = String(r.date ?? '').replace(/[^0-9]/g, '');
          const home = normalizeTeamName(String(r.homeTeam ?? r.home ?? ''));
          const away = normalizeTeamName(String(r.awayTeam ?? r.away ?? ''));
          const key = `${date}:${home}:${away}`;
          if (!date || date.length !== 8) {
            issues.push({ type: 'grades/date_format', severity: 'WARNING', message: 'Bad date format', context: { file: f, value: r.date } });
          }
          if (!home || !away) {
            issues.push({ type: 'grades/missing_teams', severity: 'CRITICAL', message: 'Missing team names', context: { file: f, record: r } });
          }
          const hScore = Number(r.homeScore ?? r.hScore ?? r.home_points);
          const aScore = Number(r.awayScore ?? r.aScore ?? r.away_points);
          if (!isFinite(hScore) || !isFinite(aScore)) {
            issues.push({ type: 'grades/missing_scores', severity: 'CRITICAL', message: 'Missing or non-numeric scores', context: { file: f, record: r } });
          }
          if (seenPairs.has(key)) {
            issues.push({ type: 'grades/duplicate_record', severity: 'WARNING', message: 'Duplicate grade record found', context: { file: f, key } });
          } else {
            seenPairs.add(key);
          }
          const spread = Number(r.closingSpread ?? r.spread);
          if (isFinite(spread) && Math.abs(spread) > 40) {
            issues.push({ type: 'grades/anomalous_spread', severity: 'WARNING', message: 'Spread magnitude suspicious (>40)', context: { file: f, spread } });
          }
        }
      } else if (f.endsWith('.csv')) {
        const content = fs.readFileSync(full, 'utf8');
        const rows = parse(content, { columns: true, skip_empty_lines: true }) as any[];
        for (const r of rows as any[]) {
          const date = f.replace(/[^0-9]/g, '').slice(0, 8);
          const home = normalizeTeamName(String(r.homeTeam ?? r.HomeTeam ?? ''));
          const away = normalizeTeamName(String(r.awayTeam ?? r.AwayTeam ?? ''));
          const key = `${date}:${home}:${away}`;
          if (!home || !away) {
            issues.push({ type: 'grades/missing_teams', severity: 'CRITICAL', message: 'Missing team names (CSV)', context: { file: f, record: r } });
          }
          const hScore = Number(r.homeScore ?? r.HomeScore);
          const aScore = Number(r.awayScore ?? r.AwayScore);
          if (!isFinite(hScore) || !isFinite(aScore)) {
            issues.push({ type: 'grades/missing_scores', severity: 'CRITICAL', message: 'Missing or non-numeric scores (CSV)', context: { file: f, record: r } });
          }
          if (seenPairs.has(key)) {
            issues.push({ type: 'grades/duplicate_record', severity: 'WARNING', message: 'Duplicate grade record found (CSV)', context: { file: f, key } });
          } else {
            seenPairs.add(key);
          }
        }
      }
    } catch (err: any) {
      issues.push({ type: 'grades/read_error', severity: 'CRITICAL', message: 'Failed to read grade file', context: { file: f, error: err?.message } });
    }
  }

  return issues;
}

function validatePicks(picksPath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!fs.existsSync(picksPath)) {
    issues.push({ type: 'picks/missing_file', severity: 'CRITICAL', message: 'Picks file not found', context: { path: picksPath } });
    return issues;
  }
  const content = fs.readFileSync(picksPath, 'utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as any[];
  const seenPerDayTeam = new Set<string>();

  for (const r of rows as any[]) {
    const date = String(r.date ?? r.Date ?? '').trim();
    const team = normalizeTeamName(String(r.team ?? r.Team ?? '').trim());
    const opp = normalizeTeamName(String(r.opponent ?? r.Opponent ?? r.oppo ?? '').trim());
    const probRaw = r.coverProb ?? r.CoverProb ?? r.cp ?? r.prob;
    const prob = typeof probRaw === 'string' ? parseFloat(probRaw) : Number(probRaw);
    if (!date || !team || !opp) {
      issues.push({ type: 'picks/missing_fields', severity: 'CRITICAL', message: 'Missing date/team/opponent', context: { row: r } });
      continue;
    }
    if (!isFinite(prob) || prob <= 0 || prob >= 1) {
      issues.push({ type: 'picks/prob_out_of_range', severity: 'WARNING', message: 'Probability out of (0,1)', context: { team, prob } });
    }
    const key = `${date}:${team}:${opp}`;
    if (seenPerDayTeam.has(key)) {
      issues.push({ type: 'picks/duplicate', severity: 'WARNING', message: 'Duplicate pick for same match', context: { key } });
    } else {
      seenPerDayTeam.add(key);
    }
  }
  return issues;
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
  const reportPath = path.join(resultsDir, 'data_validation_report.json');

  const picksSource = fs.existsSync(altPicks) ? altPicks : picksPath;

  const gradeIssues = validateGrades(resultsDir);
  const pickIssues = validatePicks(picksSource);

  const summary = {
    timestamp: new Date().toISOString(),
    counts: {
      grades: gradeIssues.length,
      picks: pickIssues.length,
      critical: gradeIssues.filter(i => i.severity === 'CRITICAL').length + pickIssues.filter(i => i.severity === 'CRITICAL').length,
      warning: gradeIssues.filter(i => i.severity === 'WARNING').length + pickIssues.filter(i => i.severity === 'WARNING').length,
      info: gradeIssues.filter(i => i.severity === 'INFO').length + pickIssues.filter(i => i.severity === 'INFO').length,
    },
    gradeIssues,
    pickIssues,
  };

  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log('Data validation report saved to:', reportPath);
  console.log('Issues summary:', summary.counts);

  if (summary.counts.critical > 0) {
    console.log('CRITICAL issues detected. Please review the report.');
  } else if (summary.counts.warning > 0) {
    console.log('Warnings detected. Consider reviewing the data.');
  } else {
    console.log('No issues detected. Data looks healthy.');
  }
}

main();
