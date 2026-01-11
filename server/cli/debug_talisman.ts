async function debug() {
  const html = await fetch('https://talismanred.com/ratings/hoops/predictions.shtml?t=' + Date.now(), {
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
  }).then(r => r.text());

  // Find all 11-Jan-2026 entries
  const idx = html.indexOf('11-Jan-2026');
  if (idx >= 0) {
    const chunk = html.slice(idx, idx + 1000);
    console.log("RAW CHUNK:");
    console.log(JSON.stringify(chunk));
    console.log("\n\nPRETTY:");
    console.log(chunk);
  } else {
    console.log("NO 11-Jan-2026 FOUND");
    console.log("Looking for dates:");
    const dateMatches = html.match(/\d{2}-\w{3}-2026/g);
    console.log(dateMatches);
  }
}

debug();

