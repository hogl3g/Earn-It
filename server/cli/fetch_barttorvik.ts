/**
 * Fetch team ratings from Barttorvik (free KenPom alternative)
 * https://barttorvik.com/
 */

export async function fetchBarttorvik(): Promise<any[]> {
  try {
    const url = "https://barttorvik.com/trank.php?year=2026&sort=&top=0&conlimit=All";
    
    console.log(`Fetching Barttorvik ratings...`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log(`Response length: ${html.length} bytes`);
    
    const teams: any[] = [];
    
    // Parse table rows
    const rowRegex = /<tr[^>]*>(.*?)<\/tr>/g;
    const rows = html.match(rowRegex) || [];
    
    for (const row of rows) {
      if (row.includes('<th')) continue;
      
      const cellRegex = /<td[^>]*>(.*?)<\/td>/g;
      const cells = Array.from(row.matchAll(cellRegex)).map(m => m[1].replace(/<[^>]*>/g, '').trim());
      
      if (cells.length < 10) continue;
      
      const team = cells[1];
      const adjOE = parseFloat(cells[4]);
      const adjDE = parseFloat(cells[5]);
      const barthag = parseFloat(cells[6]);
      
      if (team && !isNaN(adjOE) && !isNaN(adjDE)) {
        teams.push({
          team: team.trim(),
          AdjO: adjOE,
          AdjD: adjDE,
          adj_offense: adjOE,
          adj_defense: adjDE,
          barthag: barthag,
          recent_net: 0,
        });
      }
    }
    
    console.log(`✓ Parsed ${teams.length} teams from Barttorvik`);
    return teams;
    
  } catch (error) {
    console.error("Error fetching Barttorvik data:", error);
    return [];
  }
}

// Execute when run directly
(async () => {
  const teams = await fetchBarttorvik();
  
  if (teams.length === 0) {
    console.log("❌ No teams fetched");
    return;
  }
  
  console.log(`\nSample (first 5):`);
  teams.slice(0, 5).forEach((t, i) => {
    console.log(`${i + 1}. ${t.team}: ${t.AdjO.toFixed(1)} OffEff, ${t.AdjD.toFixed(1)} DefEff`);
  });
  
  // Save to CSV
  const fs = await import("fs/promises");
  const path = await import("path");
  const csvPath = path.resolve("cbb_betting_sim/data/raw/kenpom_2026.csv");
  
  const headers = "team,AdjO,AdjD,adj_offense,adj_defense,recent_net\n";
  const rows = teams.map(t => `${t.team},${t.AdjO},${t.AdjD},${t.adj_offense},${t.adj_defense},${t.recent_net}`).join("\n");
  
  await fs.writeFile(csvPath, headers + rows, "utf8");
  console.log(`\n✓ Saved ${teams.length} teams to ${csvPath}`);
})();
