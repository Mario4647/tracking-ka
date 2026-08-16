const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { createClient } = require('@supabase/supabase-js');

// Read environment variables dynamically from .env.local
const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Kredensial Supabase tidak ditemukan di environment!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const INDONESIAN_STATIONS = {
  // DAOP 1 JAKARTA
  'GMR': { name: 'Gambir', lat: -6.1767, lng: 106.8306, city: 'Jakarta Pusat' },
  'PSE': { name: 'Pasar Senen', lat: -6.1747, lng: 106.8447, city: 'Jakarta Pusat' },
  'JAKK': { name: 'Jakarta Kota', lat: -6.1376, lng: 106.8146, city: 'Jakarta Barat' },
  'JNG': { name: 'Jatinegara', lat: -6.2151, lng: 106.8680, city: 'Jakarta Timur' },
  'MRI': { name: 'Manggarai', lat: -6.2099, lng: 106.8503, city: 'Jakarta Selatan' },
  'THB': { name: 'Tanah Abang', lat: -6.1856, lng: 106.8111, city: 'Jakarta Pusat' },
  'BKS': { name: 'Bekasi', lat: -6.2361, lng: 106.9994, city: 'Bekasi' },
  'CKR': { name: 'Cikarang', lat: -6.2611, lng: 107.1533, city: 'Bekasi' },
  'BOO': { name: 'Bogor', lat: -6.5962, lng: 106.7906, city: 'Bogor' },
  'DP': { name: 'Depok', lat: -6.4058, lng: 106.8186, city: 'Depok' },
  'RK': { name: 'Rangkasbitung', lat: -6.3603, lng: 106.2472, city: 'Lebak' },
  'SRP': { name: 'Serpong', lat: -6.3204, lng: 106.6667, city: 'Tangerang Selatan' },
  'TNG': { name: 'Tangerang', lat: -6.1772, lng: 106.6331, city: 'Tangerang' },
  'PLP': { name: 'Parung Panjang', lat: -6.3444, lng: 106.5683, city: 'Bogor' },
  'MER': { name: 'Merak', lat: -5.9328, lng: 105.9997, city: 'Cilegon' },
  'CLG': { name: 'Cilegon', lat: -6.0189, lng: 106.0544, city: 'Cilegon' },
  'SRG': { name: 'Serang', lat: -6.1186, lng: 106.1611, city: 'Serang' },

  // DAOP 2 BANDUNG
  'BD': { name: 'Bandung', lat: -6.9142, lng: 107.6025, city: 'Bandung' },
  'BDO': { name: 'Bandung', lat: -6.9142, lng: 107.6025, city: 'Bandung' },
  'KAC': { name: 'Kiaracondong', lat: -6.9247, lng: 107.6464, city: 'Bandung' },
  'CCL': { name: 'Cicalengka', lat: -6.9806, lng: 107.8394, city: 'Bandung' },
  'PWK': { name: 'Purwakarta', lat: -6.5564, lng: 107.4450, city: 'Purwakarta' },
  'CKP': { name: 'Cikampek', lat: -6.4217, lng: 107.4589, city: 'Karawang' },
  'KW': { name: 'Karawang', lat: -6.3056, lng: 107.3056, city: 'Karawang' },
  'PDL': { name: 'Padalarang', lat: -6.8406, lng: 107.4811, city: 'Bandung Barat' },
  'CMI': { name: 'Cimahi', lat: -6.8856, lng: 107.5361, city: 'Cimahi' },
  'CPD': { name: 'Cipeundeuy', lat: -7.0944, lng: 108.1006, city: 'Garut' },
  'CB': { name: 'Cibatu', lat: -7.1083, lng: 107.9806, city: 'Garut' },
  'GRT': { name: 'Garut', lat: -7.2117, lng: 107.9042, city: 'Garut' },
  'TSM': { name: 'Tasikmalaya', lat: -7.3219, lng: 108.2239, city: 'Tasikmalaya' },
  'CI': { name: 'Ciamis', lat: -7.3306, lng: 108.3528, city: 'Ciamis' },
  'BJR': { name: 'Banjar', lat: -7.3736, lng: 108.5369, city: 'Banjar' },

  // DAOP 3 CIREBON
  'CN': { name: 'Cirebon', lat: -6.7058, lng: 108.5558, city: 'Cirebon' },
  'CNP': { name: 'Cirebon Prujakan', lat: -6.7214, lng: 108.5636, city: 'Cirebon' },
  'JTB': { name: 'Jatibarang', lat: -6.4744, lng: 108.3122, city: 'Indramayu' },
  'HGL': { name: 'Haurgeulis', lat: -6.4583, lng: 107.9556, city: 'Indramayu' },
  'PGB': { name: 'Pegaden Baru', lat: -6.4639, lng: 107.8250, city: 'Subang' },
  'AWN': { name: 'Arjawinangun', lat: -6.6472, lng: 108.4111, city: 'Cirebon' },
  'BBK': { name: 'Babakan', lat: -6.8583, lng: 108.7194, city: 'Cirebon' },
  'LOS': { name: 'Losari', lat: -6.8472, lng: 108.8028, city: 'Brebes' },
  'CLD': { name: 'Ciledug', lat: -6.9056, lng: 108.7444, city: 'Cirebon' },

  // DAOP 4 SEMARANG
  'SMT': { name: 'Semarang Tawang', lat: -6.9644, lng: 110.4283, city: 'Semarang' },
  'SMC': { name: 'Semarang Poncol', lat: -6.9728, lng: 110.4150, city: 'Semarang' },
  'TG': { name: 'Tegal', lat: -6.8683, lng: 109.1417, city: 'Tegal' },
  'BB': { name: 'Brebes', lat: -6.8722, lng: 109.0417, city: 'Brebes' },
  'PML': { name: 'Pemalang', lat: -6.8889, lng: 109.3806, city: 'Pemalang' },
  'PK': { name: 'Pekalongan', lat: -6.8903, lng: 109.6642, city: 'Pekalongan' },
  'BTG': { name: 'Batang', lat: -6.9083, lng: 109.7333, city: 'Batang' },
  'WLR': { name: 'Weleri', lat: -6.9722, lng: 110.0694, city: 'Kendal' },
  'NBO': { name: 'Ngrombo', lat: -7.0972, lng: 110.9028, city: 'Grobogan' },
  'CU': { name: 'Cepu', lat: -7.1492, lng: 111.5908, city: 'Blora' },
  'RBG': { name: 'Randublatung', lat: -7.1944, lng: 111.3917, city: 'Blora' },

  // DAOP 5 PURWOKERTO
  'PWT': { name: 'Purwokerto', lat: -7.4186, lng: 109.2217, city: 'Banyumas' },
  'KYA': { name: 'Kroya', lat: -7.6300, lng: 109.2536, city: 'Cilacap' },
  'BMA': { name: 'Bumiayu', lat: -7.2417, lng: 109.0028, city: 'Brebes' },
  'MA': { name: 'Maos', lat: -7.6194, lng: 109.1417, city: 'Cilacap' },
  'CP': { name: 'Cilacap', lat: -7.7333, lng: 109.0111, city: 'Cilacap' },
  'GB': { name: 'Gombong', lat: -7.6083, lng: 109.5139, city: 'Kebumen' },
  'KM': { name: 'Kebumen', lat: -7.6778, lng: 109.6583, city: 'Kebumen' },
  'KTA': { name: 'Kutoarjo', lat: -7.7222, lng: 109.9111, city: 'Purworejo' },
  'SDR': { name: 'Sidareja', lat: -7.4833, lng: 108.8000, city: 'Cilacap' },
  'GDM': { name: 'Gandrungmangun', lat: -7.5333, lng: 108.8667, city: 'Cilacap' },

  // DAOP 6 YOGYAKARTA
  'YK': { name: 'Yogyakarta (Tugu)', lat: -7.7892, lng: 110.3633, city: 'Yogyakarta' },
  'LPN': { name: 'Lempuyangan', lat: -7.7903, lng: 110.3750, city: 'Yogyakarta' },
  'WT': { name: 'Wates', lat: -7.8583, lng: 110.1583, city: 'Kulon Progo' },
  'KT': { name: 'Klaten', lat: -7.7111, lng: 110.6028, city: 'Klaten' },
  'SLO': { name: 'Solo Balapan', lat: -7.5583, lng: 110.8217, city: 'Surakarta' },
  'PWS': { name: 'Purwosari', lat: -7.5639, lng: 110.7972, city: 'Surakarta' },
  'SK': { name: 'Solo Jebres', lat: -7.5611, lng: 110.8417, city: 'Surakarta' },
  'SR': { name: 'Sragen', lat: -7.4278, lng: 111.0222, city: 'Sragen' },
  'SMO': { name: 'Bandara Adi Soemarmo', lat: -7.5186, lng: 110.7564, city: 'Boyolali' },

  // DAOP 7 MADIUN
  'MN': { name: 'Madiun', lat: -7.6186, lng: 111.5239, city: 'Madiun' },
  'WK': { name: 'Walikukun', lat: -7.4083, lng: 111.2333, city: 'Ngawi' },
  'NGW': { name: 'Ngawi', lat: -7.4472, lng: 111.4500, city: 'Ngawi' },
  'MAG': { name: 'Magetan', lat: -7.5333, lng: 111.3917, city: 'Magetan' },
  'NJ': { name: 'Nganjuk', lat: -7.6000, lng: 111.9056, city: 'Nganjuk' },
  'KTS': { name: 'Kertosono', lat: -7.5917, lng: 112.1000, city: 'Nganjuk' },
  'KD': { name: 'Kediri', lat: -7.8194, lng: 112.0167, city: 'Kediri' },
  'TA': { name: 'Tulungagung', lat: -8.0667, lng: 111.9028, city: 'Tulungagung' },
  'BL': { name: 'Blitar', lat: -8.1000, lng: 112.1667, city: 'Blitar' },
  'JG': { name: 'Jombang', lat: -7.5583, lng: 112.2333, city: 'Jombang' },

  // DAOP 8 SURABAYA
  'SBI': { name: 'Surabaya Pasarturi', lat: -7.2478, lng: 112.7317, city: 'Surabaya' },
  'SGU': { name: 'Surabaya Gubeng', lat: -7.2656, lng: 112.7522, city: 'Surabaya' },
  'WO': { name: 'Wonokromo', lat: -7.3000, lng: 112.7361, city: 'Surabaya' },
  'MR': { name: 'Mojokerto', lat: -7.4722, lng: 112.4389, city: 'Mojokerto' },
  'SDA': { name: 'Sidoarjo', lat: -7.4472, lng: 112.7167, city: 'Sidoarjo' },
  'BG': { name: 'Bangil', lat: -7.5972, lng: 112.7667, city: 'Pasuruan' },
  'PS': { name: 'Pasuruan', lat: -7.6417, lng: 112.9083, city: 'Pasuruan' },
  'ML': { name: 'Malang', lat: -7.9786, lng: 112.6375, city: 'Malang' },
  'MLK': { name: 'Malang Kotalama', lat: -7.9944, lng: 112.6361, city: 'Malang' },
  'LW': { name: 'Lawang', lat: -7.8389, lng: 112.6972, city: 'Malang' },
  'KPN': { name: 'Kepanjen', lat: -8.1306, lng: 112.5722, city: 'Malang' },
  'BBT': { name: 'Babat', lat: -7.1139, lng: 112.1639, city: 'Lamongan' },
  'LMG': { name: 'Lamongan', lat: -7.1222, lng: 112.4167, city: 'Lamongan' },
  'BJ': { name: 'Bojonegoro', lat: -7.1639, lng: 111.8889, city: 'Bojonegoro' },

  // DAOP 9 JEMBER
  'PB': { name: 'Probolinggo', lat: -7.7472, lng: 113.2167, city: 'Probolinggo' },
  'KK': { name: 'Klakah', lat: -8.0028, lng: 113.2556, city: 'Lumajang' },
  'TGL': { name: 'Tanggul', lat: -8.1611, lng: 113.4500, city: 'Jember' },
  'RBP': { name: 'Rambipuji', lat: -8.2028, lng: 113.6083, city: 'Jember' },
  'JR': { name: 'Jember', lat: -8.1650, lng: 113.7036, city: 'Jember' },
  'KLT': { name: 'Kalisat', lat: -8.1250, lng: 113.8139, city: 'Jember' },
  'KBR': { name: 'Kalibaru', lat: -8.2917, lng: 113.9861, city: 'Banyuwangi' },
  'RGP': { name: 'Rogojampi', lat: -8.3056, lng: 114.2944, city: 'Banyuwangi' },
  'BWI': { name: 'Banyuwangi Kota', lat: -8.2250, lng: 114.3583, city: 'Banyuwangi' },
  'KTG': { name: 'Ketapang (Banyuwangi Baru)', lat: -8.1458, lng: 114.3972, city: 'Banyuwangi' },
};

function inferTrainClass(name) {
  const n = (name || '').toUpperCase();
  if (n.includes('ARGO') || n.includes('LUXURY') || n.includes('COMPARTMENT')) return 'Eksekutif Luxury';
  if (n.includes('EKSEKUTIF') || n.includes('GAJAYANA') || n.includes('BIMA') || n.includes('TURANGGA') || n.includes('TAKSAKA')) return 'Eksekutif';
  if (n.includes('BISNIS')) return 'Bisnis';
  if (n.includes('COMMUTER') || n.includes('LOKAL') || n.includes('PRAMBANAN') || n.includes('BANDARA')) return 'Ekonomi / Komuter';
  if (n.includes('BARANG') || n.includes('PARCEL') || n.includes('PETIKEMAS') || n.includes('SEMEN') || n.includes('BBM')) return 'Barang';
  return 'Eksekutif / Ekonomi';
}

function inferCategory(name, asal, tujuan) {
  const n = (name || '').toUpperCase();
  if (n.includes('COMMUTER') || n.includes('KRL')) return 'Commuter Line';
  if (n.includes('BANDARA')) return 'KA Bandara';
  if (n.includes('BARANG') || n.includes('PARCEL') || n.includes('PETIKEMAS') || n.includes('SEMEN') || n.includes('BBM')) return 'KA Barang';
  if (n.includes('LOKAL') || n.includes('PRABU') || n.includes('KEDUNG')) return 'KA Lokal / Aglomerasi';
  return 'KA Antarkota';
}

async function runExtractionAndSync() {
  console.log('===========================================================');
  console.log('  GAPEKA 2025 OFFICIAL PDF EXTRACTOR & DATABASE SYNC');
  console.log('===========================================================');

  const candidatePaths = [
    'C:\\Users\\bdstd\\Downloads\\apk-touring\\824190976-Kp-djka-224-Tahun-2024-gapeka-Jawa-Tahun-2025.pdf',
    'C:\\Users\\bdstd\\Downloads\\824190976-Kp-djka-224-Tahun-2024-gapeka-Jawa-Tahun-2025 (1).pdf',
    path.resolve(__dirname, '../../../824190976-Kp-djka-224-Tahun-2024-gapeka-Jawa-Tahun-2025.pdf'),
    path.resolve(__dirname, '../../824190976-Kp-djka-224-Tahun-2024-gapeka-Jawa-Tahun-2025.pdf')
  ];

  let pdfPath = candidatePaths.find(p => fs.existsSync(p));
  if (!pdfPath) {
    console.error('File PDF tidak ditemukan di candidate paths!');
    process.exit(1);
  }
  console.log('Menggunakan PDF dari:', pdfPath);

  console.log('Membaca file PDF (85 MB, 1.721 Halaman)...');
  const dataBuffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse(new Uint8Array(dataBuffer));
  await parser.load();
  const textObj = await parser.getText();
  console.log('Berhasil memuat', textObj.pages.length, 'halaman PDF.');

  const trainMap = new Map();
  const stationMap = new Map();

  // Pre-seed stationMap with known Indonesian stations
  Object.keys(INDONESIAN_STATIONS).forEach((code) => {
    const info = INDONESIAN_STATIONS[code];
    stationMap.set(code, {
      code,
      name: info.name,
      latitude: info.lat,
      longitude: info.lng,
      city: info.city || 'Jawa',
      daop: null,
    });
  });

  const kaHeaderRegex = /KA\s+([0-9]+[A-Za-z]?)\s*(?:\(([^)]+)\))?\s*Lintas\s+Pelayanan\s+([A-Za-z]+)-([A-Za-z]+)/i;
  let currentKA = null;

  for (let pIdx = 60; pIdx < textObj.pages.length; pIdx++) {
    const lines = textObj.pages[pIdx].text.split('\n');

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const line = lines[lIdx].trim();
      if (!line) continue;

      const headerMatch = line.match(kaHeaderRegex);
      if (headerMatch) {
        const no = headerMatch[1].trim();
        const name = (headerMatch[2] || (`KA ${no}`)).trim();
        const asal = headerMatch[3].trim().toUpperCase();
        const tujuan = headerMatch[4].trim().toUpperCase();

        if (!trainMap.has(no)) {
          currentKA = {
            no,
            name,
            asal,
            tujuan,
            train_class: inferTrainClass(name),
            category: inferCategory(name, asal, tujuan),
            stations: [],
          };
          trainMap.set(no, currentKA);
        } else {
          currentKA = trainMap.get(no);
        }
        continue;
      }

      if (!currentKA) continue;

      const rowMatch = line.match(/^(\d+)\s+([^(]+?)\s*\(([A-Z0-9]+)\)\s+(.*)$/);
      if (rowMatch) {
        const order = parseInt(rowMatch[1], 10);
        const stName = rowMatch[2].trim();
        const stCode = rowMatch[3].trim().toUpperCase();
        const rest = rowMatch[4].trim();

        // Add station to stationMap if not present
        if (stCode && !stationMap.has(stCode)) {
          const defaultGeo = INDONESIAN_STATIONS[stCode] || {};
          stationMap.set(stCode, {
            code: stCode,
            name: stName || defaultGeo.name || stCode,
            latitude: defaultGeo.lat || 0,
            longitude: defaultGeo.lng || 0,
            city: defaultGeo.city || 'Jawa',
            daop: null,
          });
        }

        let arr = '-';
        let dep = '-';
        let notes = '';

        const timeTokens = rest.split(/\s+/);
        if (timeTokens[0] === 'Ls' || timeTokens[0] === 'ls' || timeTokens[0] === 'LS') {
          arr = 'Ls';
          dep = timeTokens[1] || '-';
          notes = timeTokens.slice(2).join(' ');
        } else if (timeTokens.length >= 2 && timeTokens[0].includes(':') && timeTokens[1].includes(':')) {
          arr = timeTokens[0];
          dep = timeTokens[1];
          notes = timeTokens.slice(2).join(' ');
        } else if (timeTokens.length >= 1 && timeTokens[0].includes(':')) {
          if (order === 1) {
            dep = timeTokens[0];
          } else {
            arr = timeTokens[0];
          }
          notes = timeTokens.slice(1).join(' ');
        }

        // Avoid adding duplicate station order in the same train
        const exists = currentKA.stations.some((s) => s.order === order);
        if (!exists) {
          currentKA.stations.push({
            order,
            name: stName,
            code: stCode,
            arr,
            dep,
            notes,
          });
        }
      }
    }
  }

  console.log(`\nBerhasil mengekstrak ${trainMap.size} jadwal kereta dari PDF.`);

  // Prepare database rows
  const trainRows = [];
  const scheduleRows = [];

  for (const [no, tr] of trainMap.entries()) {
    if (tr.stations.length === 0) continue;

    // Sort stations strictly by order
    tr.stations.sort((a, b) => a.order - b.order);

    const first = tr.stations[0];
    const last = tr.stations[tr.stations.length - 1];

    const departureTime = first.dep !== '-' ? first.dep : first.arr;
    const arrivalTime = last.arr !== '-' ? last.arr : last.dep;

    trainRows.push({
      train_number: no,
      name: tr.name,
      train_class: tr.train_class,
      category: tr.category,
      origin_station_code: first.code || tr.asal || null,
      destination_station_code: last.code || tr.tujuan || null,
      departure_time: departureTime || '08:00:00',
      arrival_time: arrivalTime || '16:00:00',
    });

    tr.stations.forEach((s, idx) => {
      scheduleRows.push({
        train_number: no,
        station_order: idx + 1,
        station_code: s.code || null,
        station_name: s.name,
        arrival_time: s.arr,
        departure_time: s.dep,
        notes: s.notes || null,
      });
    });
  }

  console.log(`Total Stasiun Terdata: ${stationMap.size}`);
  console.log(`Total Master Kereta Valid: ${trainRows.length}`);
  console.log(`Total Jadwal Stasiun Valid: ${scheduleRows.length}`);

  // ─── SINKRONISASI KE SUPABASE ───────────────────────────────────────
  console.log('\n1. Membersihkan data lama di database...');
  await supabase.from('train_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('train_master').delete().neq('train_number', '__impossible__');

  console.log(`2. Mengunggah ${stationMap.size} master stasiun ke Supabase...`);
  const stationRows = Array.from(stationMap.values());
  for (let i = 0; i < stationRows.length; i += 500) {
    const batch = stationRows.slice(i, i + 500);
    const { error } = await supabase.from('train_stations').upsert(batch, { onConflict: 'code' });
    if (error) console.error('Station upsert error:', error.message);
  }

  console.log(`3. Mengunggah ${trainRows.length} master kereta resmi DJKA 2025 ke Supabase...`);
  for (let i = 0; i < trainRows.length; i += 500) {
    const batch = trainRows.slice(i, i + 500);
    const { error } = await supabase.from('train_master').upsert(batch, { onConflict: 'train_number' });
    if (error) console.error('Train master upsert error:', error.message);
  }

  console.log(`4. Mengunggah ${scheduleRows.length} jadwal stasiun resmi DJKA 2025 ke Supabase...`);
  for (let i = 0; i < scheduleRows.length; i += 1000) {
    const batch = scheduleRows.slice(i, i + 1000);
    const { error } = await supabase.from('train_schedules').insert(batch);
    if (error) console.error(`Schedule insert error pada batch ${i}:`, error.message);
  }

  const { count: sCount } = await supabase.from('train_stations').select('*', { count: 'exact', head: true });
  const { count: tCount } = await supabase.from('train_master').select('*', { count: 'exact', head: true });
  const { count: scCount } = await supabase.from('train_schedules').select('*', { count: 'exact', head: true });

  console.log('\n===========================================================');
  console.log('  SINKRONISASI DATABASE DARI PDF GAPEKA 2025 BERHASIL!');
  console.log('===========================================================');
  console.log(`- Stasiun di Database: ${sCount}`);
  console.log(`- Kereta di Database: ${tCount}`);
  console.log(`- Jadwal Stasiun di Database: ${scCount}`);
}

runExtractionAndSync();
