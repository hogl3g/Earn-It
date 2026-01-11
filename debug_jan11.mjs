const dateStr = "2026-01-11";
const datePattern = `${dateStr.slice(8, 10)}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(dateStr.slice(5,7))-1]}-${dateStr.slice(0,4)}`;
console.log("Looking for date pattern:", datePattern);

fetch(`https://talismanred.com/ratings/hoops/predictions.shtml?t=${Date.now()}`, {
  headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
}).then(r => r.text()).then(html => {
  const idx = html.indexOf(datePattern);
  if (idx >= 0) {
    console.log("FOUND date at index", idx);
    console.log("Context:", html.slice(idx, idx + 500));
  } else {
    console.log("DATE NOT FOUND in HTML");
    const dates = html.match(/\d{2}-\w{3}-\d{4}/g);
    console.log("Available dates:", dates ? dates.slice(0, 20) : "none");
  }
});
