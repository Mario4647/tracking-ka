const fs = require('fs');
const path = require('path');

async function tryServer(server) {
  const query = `[out:json][timeout:30];
(
  node["railway"="station"](-9.2, 105.0, -5.5, 115.0);
  node["railway"="halt"](-9.2, 105.0, -5.5, 115.0);
  node["railway"="stop"](-9.2, 105.0, -5.5, 115.0);
  node["railway"="station"](-6.0, 95.0, 6.0, 106.0);
  node["railway"="halt"](-6.0, 95.0, 6.0, 106.0);
);
out body;`;

  const url = server + '?data=' + encodeURIComponent(query);
  console.log('Trying server:', server);
  const res = await fetch(url, { headers: { 'User-Agent': 'ApkTouring/1.0' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  console.log(`Success from ${server}! Got ${data.elements.length} station elements.`);
  return data.elements;
}

async function main() {
  const servers = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass-api.de/api/interpreter'
  ];

  for (const s of servers) {
    try {
      const elements = await tryServer(s);
      if (elements && elements.length > 0) {
        const stations = {};

        for (const el of elements) {
          if (!el.tags) continue;
          const name = el.tags.name || el.tags['name:id'] || '';
          const ref = el.tags.ref || el.tags['ref:uic'] || el.tags['ref:kai'] || el.tags['short_name'] || '';
          const lat = el.lat;
          const lng = el.lon;

          if (!lat || !lng) continue;

          const dataObj = { name, lat, lng, code: ref };

          if (name) {
            stations[name.toLowerCase().trim()] = dataObj;
            const cleanName = name.replace(/^Stasiun\s+/i, '').trim();
            stations[cleanName.toLowerCase().trim()] = dataObj;
          }
          if (ref) {
            stations[ref.toUpperCase().trim()] = dataObj;
          }
        }

        console.log('Sample Ngunut:', stations['ngunut']);
        console.log('Sample Rejotangan:', stations['rejotangan']);
        console.log('Sample Sumbergempol:', stations['sumbergempol']);
        console.log('Sample Ngujang:', stations['ngujang']);

        const outputPath = path.join(__dirname, '../src/lib/osm_stations_indonesia.json');
        fs.writeFileSync(outputPath, JSON.stringify(stations, null, 2));
        console.log(`Saved stations database to ${outputPath}`);
        return;
      }
    } catch (err) {
      console.log(`Server ${s} failed: ${err.message}`);
    }
  }
}

main();
