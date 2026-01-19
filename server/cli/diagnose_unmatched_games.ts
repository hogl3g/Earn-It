import * as fs from "fs";
import * as path from "path";
import { fetchSportsRefScores } from "./fetch_sportsref_scores";
import { normalizeTeamName } from "../../shared/team_names";

// Simple CSV parser
function parseCSV(content: string) {
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");
  const data = lines.slice(1).map((line) => {
    const values = line.split(",");
    const row: any = {};
    headers.forEach((header, i) => {
      row[header.trim()] = values[i]?.trim();
    });
    return row;
  });
  return data;
}

// Load Jan 17 projector picks CSV
const picksPath = path.join(process.cwd(), "data/results/ts_projector_picks.csv");
const picksContent = fs.readFileSync(picksPath, "utf-8");
const picks = parseCSV(picksContent)
  .filter((row: any) => row.date && row.date.includes("2026-01-17"))
  .filter((row: any) => row.team_a && row.team_b);

console.log(`\nLoaded ${picks.length} Jan 17 picks from projector`);

// Fetch Sports Reference scores for Jan 17
const sportsRefDate = "2026-01-17";
const sportsRefScores = await fetchSportsRefScores(sportsRefDate);

console.log(`\nFetched ${sportsRefScores.length} completed games from Sports Reference for ${sportsRefDate}`);

// Normalize team names for comparison
const sportsRefNormalized = sportsRefScores.map((game: any) => ({
  ...game,
  teamA_norm: normalizeTeamName(game.team_a),
  teamB_norm: normalizeTeamName(game.team_b),
}));

const picksNormalized = picks.map((pick: any) => ({
  ...pick,
  teamA_norm: normalizeTeamName(pick.team_a),
  teamB_norm: normalizeTeamName(pick.team_b),
}));

// Find matches
const matched: any[] = [];
const unmatched: any[] = [];

picksNormalized.forEach((pick: any) => {
  const found = sportsRefNormalized.find(
    (sr: any) =>
      (sr.teamA_norm === pick.teamA_norm && sr.teamB_norm === pick.teamB_norm) ||
      (sr.teamA_norm === pick.teamB_norm && sr.teamB_norm === pick.teamA_norm)
  );

  if (found) {
    matched.push({
      pick: `${pick.team_a} vs ${pick.team_b}`,
      sportsRef: `${found.team_a} vs ${found.team_b}`,
      result: `${found.team_a} ${found.a_score} - ${found.team_b} ${found.b_score}`,
    });
  } else {
    unmatched.push({
      pick: `${pick.team_a} vs ${pick.team_b}`,
      normalized_a: pick.teamA_norm,
      normalized_b: pick.teamB_norm,
      wager: pick.wager,
      spread: pick.spread,
    });
  }
});

console.log(`\n✓ Matched: ${matched.length}`);
console.log(`✗ Unmatched: ${unmatched.length}`);

if (unmatched.length > 0) {
  console.log("\n=== UNMATCHED PICKS ===");
  unmatched.forEach((game: any) => {
    console.log(`  ${game.pick} ($${game.wager} @ ${game.spread})`);
    console.log(`    Normalized: ${game.normalized_a} vs ${game.normalized_b}`);
  });

  console.log("\n=== SPORTS REFERENCE GAMES NOT IN PICKS ===");
  const picksSet = new Set(picksNormalized.map((p: any) => `${p.teamA_norm}-${p.teamB_norm}` || `${p.teamB_norm}-${p.teamA_norm}`));
  const unmatchedSR = sportsRefNormalized.filter(
    (sr: any) => !picksSet.has(`${sr.teamA_norm}-${sr.teamB_norm}`) && !picksSet.has(`${sr.teamB_norm}-${sr.teamA_norm}`)
  );

  console.log(`Found ${unmatchedSR.length} Sports Reference games not in projector picks:`);
  unmatchedSR.slice(0, 20).forEach((game: any) => {
    console.log(`  ${game.team_a} vs ${game.team_b}`);
  });
}
