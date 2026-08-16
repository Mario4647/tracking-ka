const fs = require('fs');
const path = require('path');

const manualStationCoords = {
  // Jabodetabek Commuter & Airport
  'TLM': { name: 'Metland Telaga Murni', lat: -6.269000, lng: 107.108000, code: 'TLM' },
  'SUDB': { name: 'BNI City / Sudirman Baru', lat: -6.201700, lng: 106.822800, code: 'SUDB' },
  'UP': { name: 'Universitas Pancasila', lat: -6.339100, lng: 106.834400, code: 'UP' },
  'UI': { name: 'Universitas Indonesia', lat: -6.360600, lng: 106.831700, code: 'UI' },
  'GPI': { name: 'Gunung Putri', lat: -6.442100, lng: 106.892400, code: 'GPI' },
  'BKST': { name: 'Bekasi Timur', lat: -6.248386, lng: 107.016336, code: 'BKST' },
  'YIA': { name: 'Bandara YIA', lat: -7.902222, lng: 110.054444, code: 'YIA' },
  'BST': { name: 'Bandara Adi Soemarmo', lat: -7.514603, lng: 110.755481, code: 'BST' },

  // Surabaya - Sidoarjo - Porong Suburban Corridor
  'NGA': { name: 'Ngagel', lat: -7.288597, lng: 112.745672, code: 'NGA' },
  'STM': { name: 'Segitiga Mesigit', lat: -7.251500, lng: 112.738100, code: 'STM' },
  'MST': { name: 'Mesigit', lat: -7.251500, lng: 112.738100, code: 'MST' },
  'SB': { name: 'Surabaya Kota', lat: -7.245842, lng: 112.748366, code: 'SB' },
  'MGR': { name: 'Margorejo', lat: -7.318855, lng: 112.736932, code: 'MGR' },
  'JMS': { name: 'Jemursari', lat: -7.327891, lng: 112.735492, code: 'JMS' },
  'KTL': { name: 'Kertomenanggal', lat: -7.345892, lng: 112.733512, code: 'KTL' },
  'STP': { name: 'Sawotratap', lat: -7.371520, lng: 112.733190, code: 'STP' },
  'BJK': { name: 'Banjarkemantren', lat: -7.411600, lng: 112.729900, code: 'BJK' },
  'BDR': { name: 'Buduran', lat: -7.429810, lng: 112.726510, code: 'BDR' },
  'PWJ': { name: 'Pagerwojo', lat: -7.447100, lng: 112.721400, code: 'PWJ' },

  // Jawa Barat / Priangan / Padalarang - Cianjur - Sukabumi
  'CG': { name: 'Cisomang', lat: -6.745800, 107.391200: 107.391200, lng: 107.391200, code: 'CG' },
  'SAD': { name: 'Sadang', lat: -6.524700, lng: 107.458900, code: 'SAD' },
  'PON': { name: 'Pondok Leungsir', lat: -6.862400, lng: 106.845600, code: 'PON' },
  'CJE': { name: 'Cijambe', lat: -6.912500, lng: 106.964200, code: 'CJE' },
  'RM': { name: 'Rajamandala', lat: -6.837800, lng: 107.359200, code: 'RM' },
  'SLJ': { name: 'Selajambe', lat: -6.831200, lng: 107.214500, code: 'SLJ' },
  'TPR': { name: 'Tipar', lat: -6.835400, lng: 107.265400, code: 'TPR' },
  'MLB': { name: 'Maleber', lat: -6.829100, lng: 107.168700, code: 'MLB' },
  'CIK': { name: 'Cilaku', lat: -6.852300, lng: 107.135400, code: 'CIK' },
  'SSI': { name: 'Sindangresmi', lat: -6.861200, lng: 106.882100, code: 'SSI' },
  'RI': { name: 'Ranji', lat: -6.859800, lng: 106.861200, code: 'RI' },

  // Jawa Tengah / Tegal - Prupuk - Slawi
  'MGS': { name: 'Margasari', lat: -7.172800, lng: 108.995400, code: 'MGS' },
  'BLP': { name: 'Balapulang', lat: -7.085400, lng: 109.071200, code: 'BLP' },

  // Kediri - Tulungagung - Blitar Corridor
  'NT': { name: 'Ngunut', lat: -8.102882, lng: 112.0124923, code: 'NT' },
  'RJ': { name: 'Rejotangan', lat: -8.1209345, lng: 112.0811804, code: 'RJ' },
  'SBL': { name: 'Sumbergempol', lat: -8.0826585, lng: 111.94527, code: 'SBL' },
  'NJG': { name: 'Ngujang', lat: -8.0099802, lng: 111.9273012, code: 'NJG' }
};

const jsonPath = path.join(__dirname, '../src/lib/osm_stations_indonesia.json');
let existing = {};
try {
  existing = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
} catch (e) {}

for (const [code, st] of Object.entries(manualStationCoords)) {
  existing[code] = st;
  existing[code.toLowerCase()] = st;
  if (st.name) {
    existing[st.name.toLowerCase()] = st;
    const cleanName = st.name.replace(/^Stasiun\s+/i, '').trim();
    existing[cleanName.toLowerCase()] = st;
    const norm = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
    existing[norm] = st;
  }
}

fs.writeFileSync(jsonPath, JSON.stringify(existing, null, 2));
console.log('Successfully merged all 28 manual stations into osm_stations_indonesia.json');
