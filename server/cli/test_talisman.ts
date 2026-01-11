

async function test() {
  const resp = await fetch('https://talismanred.com/ratings/hoops/predictions.shtml');
  const html = await resp.text();
  
  const targetDate = '2026-01-09';
  const datePattern = `${targetDate.slice(8, 10)}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(targetDate.slice(5,7))-1]}-${targetDate.slice(0,4)}`;
  console.log('Looking for date pattern:', datePattern);

  const lines = html.split('\n');
  let found = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(datePattern)) {
      let fullMatch = line;
      if (i + 1 < lines.length && (lines[i+1].includes('HOME by') || lines[i+1].includes('AWAY by'))) {
        fullMatch = line + ' ' + lines[i+1];
      }
      const match = fullMatch.match(new RegExp(`${datePattern}\\s+([\\w\\s&.'-]+?)\\s{2,}([\\w\\s&.'-]+?)\\s+(\\d{2,3})\\s+(HOME|AWAY)\\s+by\\s+([\\-\\d.]+)`));
      found++;
      console.log(`Line ${i}: matches=${!!match}`);
      if (match) {
        console.log(`  Away: "${match[1].trim()}"`);
        console.log(`  Home: "${match[2].trim()}"`);
        console.log(`  Total: ${match[3]}, Pred: ${match[4]} by ${match[5]}`);
      } else {
        console.log(`  Raw: ${fullMatch.slice(0,100)}`);
      }
      if (found >= 3) break;
    }
  }
  console.log(`Total lines matching date: ${found}`);
}

test().catch(e=>console.error(e));
