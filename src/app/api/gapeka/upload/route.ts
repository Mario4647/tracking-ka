import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase environment variables are missing');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const INDONESIAN_STATIONS: Record<string, any> = {
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

function formatExcelTime(val: any): string {
  if (val === undefined || val === null || val === '' || val === '-' || val === '--') return '-';
  const strCheck = String(val).trim();
  if (strCheck.toUpperCase() === 'LS' || strCheck === 'Ls') return 'Ls';
  if (typeof val === 'number') {
    const totalSecs = Math.round(val * 86400);
    const hours = Math.floor(totalSecs / 3600) % 24;
    const mins = Math.floor((totalSecs % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
  const match = strCheck.match(/(\d{1,2})[:.](\d{2})/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return strCheck;
}

// Disentangle interleaved / multi-route streams for a train from raw rows in Jadwal_Stasiun
function extractTrainJourney(trainNo: string, rawRows: any[], rkInfo?: any): any[] {
  const expectedAsal = String(rkInfo?.Asal || '').toUpperCase().trim();
  const expectedTujuan = String(rkInfo?.Tujuan || '').toUpperCase().trim();
  const expectedDep = rkInfo?.['Jam Berangkat (Awal)'];

  const order1Indices: number[] = [];
  rawRows.forEach((r, idx) => {
    const ord = parseInt(r['Urutan Stasiun'] || r.Urutan || r.order || '0', 10);
    if (ord === 1) order1Indices.push(idx);
  });

  if (order1Indices.length <= 1) {
    const clean: any[] = [];
    const seen = new Set<number>();
    for (const r of rawRows) {
      const ord = parseInt(r['Urutan Stasiun'] || r.Urutan || '0', 10);
      if (!seen.has(ord)) {
        seen.add(ord);
        clean.push(r);
      }
    }
    return clean;
  }

  const numStreams = order1Indices.length;
  const isInterleaved = order1Indices[1] - order1Indices[0] === 1;
  const candidateStreams: any[][] = [];

  if (isInterleaved) {
    for (let s = 0; s < numStreams; s++) {
      const stream: any[] = [];
      let lastOrd = 0;
      for (let i = s; i < rawRows.length; i += numStreams) {
        const r = rawRows[i];
        const ord = parseInt(r['Urutan Stasiun'] || r.Urutan || '0', 10);
        if (ord === lastOrd + 1) {
          stream.push(r);
          lastOrd = ord;
          const code = String(r['Kode Stasiun'] || r.Singkatan || '').toUpperCase().trim();
          if (expectedTujuan && code === expectedTujuan && ord > 1) {
            break;
          }
        } else {
          break;
        }
      }
      candidateStreams.push(stream);
    }
  } else {
    for (let s = 0; s < numStreams; s++) {
      const start = order1Indices[s];
      const end = s + 1 < numStreams ? order1Indices[s + 1] : rawRows.length;
      candidateStreams.push(rawRows.slice(start, end));
    }
  }

  let bestStream = candidateStreams[0];
  let bestScore = -1;

  candidateStreams.forEach((stream) => {
    if (stream.length === 0) return;
    const first = stream[0];
    const last = stream[stream.length - 1];
    const firstCode = String(first['Kode Stasiun'] || first.Singkatan || '').toUpperCase().trim();
    const lastCode = String(last['Kode Stasiun'] || last.Singkatan || '').toUpperCase().trim();
    const firstDep = first['Jam Berangkat'];

    let score = stream.length;
    if (expectedAsal && firstCode === expectedAsal) score += 2000;
    if (expectedTujuan && lastCode === expectedTujuan) score += 2000;
    if (expectedDep && firstDep === expectedDep) score += 1000;

    if (score > bestScore) {
      bestScore = score;
      bestStream = stream;
    }
  });

  return bestStream;
}

function inferTrainClass(name: string): string {
  const n = (name || '').toUpperCase();
  if (n.includes('ARGO') || n.includes('LUXURY') || n.includes('COMPARTMENT')) return 'Eksekutif Luxury';
  if (n.includes('EKSEKUTIF') || n.includes('GAJAYANA') || n.includes('BIMA') || n.includes('TURANGGA') || n.includes('TAKSAKA')) return 'Eksekutif';
  if (n.includes('BISNIS')) return 'Bisnis';
  if (n.includes('COMMUTER') || n.includes('LOKAL') || n.includes('PRAMBANAN') || n.includes('BANDARA')) return 'Ekonomi / Komuter';
  if (n.includes('BARANG') || n.includes('PARCEL') || n.includes('PETIKEMAS') || n.includes('SEMEN') || n.includes('BBM')) return 'Barang';
  return 'Eksekutif / Ekonomi';
}

function inferCategory(name: string, asal: string, tujuan: string): string {
  const n = (name || '').toUpperCase();
  if (n.includes('COMMUTER') || n.includes('KRL')) return 'Commuter Line';
  if (n.includes('BANDARA')) return 'KA Bandara';
  if (n.includes('BARANG') || n.includes('PARCEL') || n.includes('PETIKEMAS') || n.includes('SEMEN') || n.includes('BBM')) return 'KA Barang';
  if (n.includes('LOKAL') || n.includes('PRABU') || n.includes('KEDUNG')) return 'KA Lokal / Aglomerasi';
  return 'KA Antarkota';
}

async function processGapekaPdf(dataBuffer: Uint8Array) {
  const { PDFParse } = require('pdf-parse');
  const parser: any = new PDFParse(dataBuffer);
  if (typeof parser.load === 'function') {
    await parser.load();
  }
  const textObj = await parser.getText();

  const trainMap = new Map<string, any>();
  const stationMap = new Map<string, any>();

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
  let currentKA: any = null;

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

        const exists = currentKA.stations.some((s: any) => s.order === order);
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

  // Format train master and schedules
  const trainRows: any[] = [];
  const scheduleRows: any[] = [];

  for (const [no, tr] of Array.from(trainMap.entries())) {
    if (tr.stations.length === 0) continue;
    tr.stations.sort((a: any, b: any) => a.order - b.order);

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

    tr.stations.forEach((s: any, idx: number) => {
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

  // Clear & Upsert to database
  await supabase.from('train_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('train_master').delete().neq('train_number', '__impossible__');

  const stationRows = Array.from(stationMap.values());
  for (let i = 0; i < stationRows.length; i += 500) {
    const batch = stationRows.slice(i, i + 500);
    await supabase.from('train_stations').upsert(batch, { onConflict: 'code' });
  }

  for (let i = 0; i < trainRows.length; i += 500) {
    const batch = trainRows.slice(i, i + 500);
    await supabase.from('train_master').upsert(batch, { onConflict: 'train_number' });
  }

  for (let i = 0; i < scheduleRows.length; i += 1000) {
    const batch = scheduleRows.slice(i, i + 1000);
    await supabase.from('train_schedules').insert(batch);
  }

  return {
    totalStations: stationRows.length,
    totalTrains: trainRows.length,
    totalSchedules: scheduleRows.length,
  };
}

function validateFileSecurity(fileBuffer: Uint8Array, fileName: string): { valid: boolean; error?: string; type: 'pdf' | 'excel' | 'invalid' } {
  if (fileBuffer.length > 120 * 1024 * 1024) {
    return { valid: false, error: 'Ukuran file melebihi batas maksimum 120MB', type: 'invalid' };
  }

  const name = fileName.toLowerCase();
  
  // PDF Magic Bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (name.endsWith('.pdf')) {
    const isPdfMagic = fileBuffer[0] === 0x25 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x44 && fileBuffer[3] === 0x46;
    if (!isPdfMagic) {
      return { valid: false, error: 'Format file ditolak! Magic bytes tidak sesuai spesifikasi dokumen PDF resmi.', type: 'invalid' };
    }
    return { valid: true, type: 'pdf' };
  }

  // XLSX (Zip archive): PK\x03\x04 (0x50 0x4B 0x03 0x04)
  // XLS (Compound File Binary): 0xD0 0xCF 0x11 0xE0
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const isXlsx = fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B && fileBuffer[2] === 0x03 && fileBuffer[3] === 0x04;
    const isXls = fileBuffer[0] === 0xD0 && fileBuffer[1] === 0xCF && fileBuffer[2] === 0x11 && fileBuffer[3] === 0xE0;
    if (!isXlsx && !isXls) {
      return { valid: false, error: 'Format file ditolak! Magic bytes tidak sesuai spesifikasi Excel resmi.', type: 'invalid' };
    }
    return { valid: true, type: 'excel' };
  }

  return { valid: false, error: 'Ekstensi file tidak diizinkan! Hanya menerima file .pdf, .xlsx, atau .xls', type: 'invalid' };
}

// POST /api/gapeka/upload — Flexible batch upload for GAPEKA dataset into Supabase
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // Handle Direct File Upload (FormData)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });

      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      // Verify file security (anti-shell, anti-RCE, magic bytes)
      const secCheck = validateFileSecurity(uint8, file.name || '');
      if (!secCheck.valid) {
        return NextResponse.json({ error: secCheck.error }, { status: 400 });
      }

      if (secCheck.type === 'pdf') {
        const result = await processGapekaPdf(uint8);
        return NextResponse.json({
          success: true,
          fileType: 'pdf',
          message: `Dokumen PDF GAPEKA berhasil diverifikasi & diproses! (${result.totalTrains} KA, ${result.totalSchedules} jadwal stasiun)`,
          ...result,
        });
      }

      const workbook = XLSX.read(arrayBuffer, { cellDates: true });

      const stSheet = workbook.Sheets['Master_Stasiun'];
      const trSheet = workbook.Sheets['Jadwal_Stasiun'];
      const rkSheet = workbook.Sheets['Ringkasan_KA'];

      if (!stSheet || !trSheet) {
        return NextResponse.json({ error: 'Format salah! Harus ada sheet Master_Stasiun dan Jadwal_Stasiun.' }, { status: 400 });
      }

      // ─── 1. Parse Master_Stasiun ──────────────────────────────────────────
      const rawStRows = XLSX.utils.sheet_to_json(stSheet, { header: 1 }) as any[][];
      let headerIdx = 0;
      for (let i = 0; i < Math.min(rawStRows.length, 5); i++) {
        if (Array.isArray(rawStRows[i]) && rawStRows[i].some((c) => String(c).toLowerCase().includes('kode') || String(c).toLowerCase().includes('stasiun'))) {
          headerIdx = i;
          break;
        }
      }
      const headers = (rawStRows[headerIdx] || []).map((h) => String(h || '').trim());
      const rawStations: any[] = [];
      for (let i = headerIdx + 1; i < rawStRows.length; i++) {
        const row = rawStRows[i];
        if (!Array.isArray(row) || row.length === 0) continue;
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = row[idx];
        });
        rawStations.push(obj);
      }

      const stationMap = new Map<string, any>();
      rawStations.forEach((s) => {
        const code = String(s['Kode Stasiun'] || s['Singkatan'] || s['Kode'] || s['code'] || '').trim().toUpperCase();
        const name = String(s['Nama Stasiun'] || s['Nama'] || s['Stasiun'] || s['name'] || '').trim();
        if (code && name) {
          const defaultGeo = INDONESIAN_STATIONS[code] || {};
          const lat = parseFloat(s['Latitude'] || s['lat'] || '0') || defaultGeo.lat || 0;
          const lng = parseFloat(s['Longitude'] || s['lng'] || '0') || defaultGeo.lng || 0;
          stationMap.set(code, {
            code,
            name,
            latitude: lat,
            longitude: lng,
            city: String(s['Kota'] || s['city'] || defaultGeo.city || 'Jawa').trim(),
            daop: String(s['Daop'] || s['daop'] || '').trim() || null,
          });
        }
      });

      // ─── 2. Parse Ringkasan_KA (Train Master) ────────────────────────────
      const ringkasan = rkSheet ? XLSX.utils.sheet_to_json(rkSheet, { raw: false }) : [];
      const rkMap: Record<string, any> = {};
      const trainMap = new Map<string, any>();

      ringkasan.forEach((row: any) => {
        const no = String(row['No KA'] || row['No. KA'] || row['Nomor KA'] || '').trim();
        if (!no) return;
        rkMap[no] = row;

        const originCode = String(row['Asal'] || row['Stasiun Asal'] || '').trim().toUpperCase();
        const destCode = String(row['Tujuan'] || row['Stasiun Tujuan'] || '').trim().toUpperCase();

        // Ensure origin/destination stations exist in stationMap to prevent foreign key errors
        if (originCode && !stationMap.has(originCode)) {
          const geo = INDONESIAN_STATIONS[originCode] || {};
          stationMap.set(originCode, { code: originCode, name: geo.name || originCode, latitude: geo.lat || 0, longitude: geo.lng || 0, city: 'Jawa', daop: null });
        }
        if (destCode && !stationMap.has(destCode)) {
          const geo = INDONESIAN_STATIONS[destCode] || {};
          stationMap.set(destCode, { code: destCode, name: geo.name || destCode, latitude: geo.lat || 0, longitude: geo.lng || 0, city: 'Jawa', daop: null });
        }

        trainMap.set(no, {
          train_number: no,
          name: row['Nama KA'] || row['name'] || `KA ${no}`,
          train_class: row['Kelas KA'] || row['Kelas'] || row['class'] || 'Eksekutif',
          category: row['Kategori'] || row['category'] || 'KA Antarkota',
          origin_station_code: originCode || null,
          destination_station_code: destCode || null,
          departure_time: formatExcelTime(row['Jam Berangkat (Awal)'] || row['Jam Berangkat'] || row['Berangkat']),
          arrival_time: formatExcelTime(row['Jam Tiba (Akhir)'] || row['Jam Tiba'] || row['Tiba']),
        });
      });

      // ─── 3. Parse Jadwal_Stasiun (Schedules) ──────────────────────────────
      const rawSchedules = XLSX.utils.sheet_to_json(trSheet, { raw: false }) as any[];
      const trainScheduleGroups = new Map<string, any[]>();

      rawSchedules.forEach((row) => {
        const no = String(row['No KA'] || row['No. KA'] || row['Nomor KA'] || row['train_number'] || row['KA'] || row['No'] || row['no'] || '').trim();
        if (!no) return;
        if (!trainScheduleGroups.has(no)) trainScheduleGroups.set(no, []);
        trainScheduleGroups.get(no)!.push(row);

        // Fallback for trains not in Ringkasan
        if (!trainMap.has(no)) {
          const originCode = String(row['Asal'] || row['Stasiun Asal'] || '').trim().toUpperCase();
          const destCode = String(row['Tujuan'] || row['Stasiun Tujuan'] || '').trim().toUpperCase();
          trainMap.set(no, {
            train_number: no,
            name: row['Nama KA'] || row['name'] || `KA ${no}`,
            train_class: row['Kelas'] || row['class'] || 'Eksekutif',
            category: row['Kategori'] || row['category'] || 'KA Antarkota',
            origin_station_code: originCode || null,
            destination_station_code: destCode || null,
            departure_time: formatExcelTime(row['Jam Berangkat'] || row['Berangkat'] || row['dep']),
            arrival_time: '-',
          });
        }
      });

      // Disentangle and clean all train schedules
      const cleanScheduleRows: any[] = [];
      const groupsArray = Array.from(trainScheduleGroups.entries());
      for (let g = 0; g < groupsArray.length; g++) {
        const [trainNo, rows] = groupsArray[g];
        const cleanJourney = extractTrainJourney(trainNo, rows, rkMap[trainNo]);
        cleanJourney.forEach((s, idx) => {
          const stName = String(s['Nama Stasiun'] || s['Stasiun'] || s['STASIUN'] || s['Nama'] || s['name'] || '').trim();
          const stCode = String(s['Kode Stasiun'] || s['Singkatan'] || s['Kode'] || s['code'] || '').trim().toUpperCase() || null;
          const arrTime = formatExcelTime(s['Jam Datang'] || s['Datang'] || s['Waktu Datang'] || s['Tiba'] || s['Jam Tiba'] || s['arr']);
          const depTime = formatExcelTime(s['Jam Berangkat'] || s['Berangkat'] || s['Waktu Berangkat'] || s['dep']);
          const notes = String(s['Keterangan'] || s['note'] || s['notes'] || '').trim();

          // Ensure station code is in stationMap
          if (stCode && !stationMap.has(stCode)) {
            const geo = INDONESIAN_STATIONS[stCode] || {};
            stationMap.set(stCode, { code: stCode, name: stName || geo.name || stCode, latitude: geo.lat || 0, longitude: geo.lng || 0, city: 'Jawa', daop: null });
          }

          cleanScheduleRows.push({
            train_number: trainNo,
            station_order: idx + 1,
            station_code: stCode,
            station_name: stName,
            arrival_time: arrTime,
            departure_time: depTime,
            notes: notes || null,
          });
        });
      }

      // ─── 4. Database Sync ────────────────────────────────────────────────
      // A. Clear old schedules & master
      await supabase.from('train_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('train_master').delete().neq('train_number', '__impossible__');

      // B. Upsert stations in chunks of 500
      const stationRows = Array.from(stationMap.values());
      for (let i = 0; i < stationRows.length; i += 500) {
        const batch = stationRows.slice(i, i + 500);
        const { error } = await supabase.from('train_stations').upsert(batch, { onConflict: 'code' });
        if (error) console.error('Station batch upsert error:', error);
      }

      // C. Upsert train master in chunks of 500
      const trainRows = Array.from(trainMap.values());
      for (let i = 0; i < trainRows.length; i += 500) {
        const batch = trainRows.slice(i, i + 500);
        const { error } = await supabase.from('train_master').upsert(batch, { onConflict: 'train_number' });
        if (error) console.error('Train master batch upsert error:', error);
      }

      // D. Insert train schedules in chunks of 1000
      for (let i = 0; i < cleanScheduleRows.length; i += 1000) {
        const batch = cleanScheduleRows.slice(i, i + 1000);
        const { error } = await supabase.from('train_schedules').insert(batch);
        if (error) console.error('Schedule batch insert error:', error);
      }

      return NextResponse.json({
        success: true,
        message: 'Upload & sinkronisasi berhasil!',
        totalStations: stationRows.length,
        totalTrains: trainRows.length,
        totalSchedules: cleanScheduleRows.length,
      });
    }

    const body = await req.json();
    const { action, trains, schedules, stations } = body;

    // Action 1: Clear old database records
    if (action === 'clear') {
      await supabase.from('train_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('train_master').delete().neq('train_number', '__impossible__');
      return NextResponse.json({ success: true, message: 'Database lama berhasil dibersihkan.' });
    }

    // Action 2: Batch insert stations
    if (action === 'stations' || (stations && Array.isArray(stations))) {
      const stationList = stations || [];
      const stationRows = stationList.map((s: any) => ({
        code: String(s.code || '').trim().toUpperCase(),
        name: String(s.name || '').trim(),
        latitude: parseFloat(s.latitude || s.lat || '0') || (INDONESIAN_STATIONS[String(s.code || '').trim().toUpperCase()]?.lat) || 0,
        longitude: parseFloat(s.longitude || s.lng || '0') || (INDONESIAN_STATIONS[String(s.code || '').trim().toUpperCase()]?.lng) || 0,
        city: String(s.city || s.kota || 'Jawa').trim(),
        daop: String(s.daop || '').trim() || null,
      })).filter((s: any) => s.code && s.name);

      for (let i = 0; i < stationRows.length; i += 500) {
        const batch = stationRows.slice(i, i + 500);
        const { error } = await supabase.from('train_stations').upsert(batch, { onConflict: 'code' });
        if (error) throw error;
      }
      return NextResponse.json({ success: true, count: stationRows.length });
    }

    // Action 3: Batch insert train_master
    if (action === 'trains' || (trains && Array.isArray(trains) && !schedules)) {
      const trainList = trains || [];
      const trainRows = trainList.map((t: any) => ({
        train_number: String(t.no || t.train_number || '').trim(),
        name: String(t.name || '').trim(),
        train_class: String(t.class || t.train_class || 'Eksekutif').trim(),
        category: String(t.category || 'KA Antarkota').trim(),
        origin_station_code: String(t.origin || t.origin_station_code || '').trim().toUpperCase() || null,
        destination_station_code: String(t.destination || t.destination_station_code || '').trim().toUpperCase() || null,
        departure_time: String(t.dep || t.departure_time || '').trim(),
        arrival_time: String(t.arr || t.arrival_time || '').trim(),
      })).filter((t: any) => t.train_number && t.name);

      for (let i = 0; i < trainRows.length; i += 500) {
        const batch = trainRows.slice(i, i + 500);
        const { error } = await supabase.from('train_master').upsert(batch, { onConflict: 'train_number' });
        if (error) throw error;
      }
      return NextResponse.json({ success: true, count: trainRows.length });
    }

    // Action 4: Batch insert train_schedules
    if (action === 'schedules' || Array.isArray(schedules)) {
      const scheduleList = schedules || [];
      const scheduleRows = scheduleList.map((s: any) => ({
        train_number: String(s.train_number || s.no || '').trim(),
        station_order: parseInt(s.station_order || s.order, 10) || 1,
        station_code: String(s.station_code || s.code || '').trim().toUpperCase() || null,
        station_name: String(s.station_name || s.name || '').trim(),
        arrival_time: String(s.arrival_time || s.arr || '-').trim(),
        departure_time: String(s.departure_time || s.dep || '-').trim(),
        notes: String(s.notes || s.note || '').trim() || null,
      })).filter((s: any) => s.train_number && s.station_name);

      for (let i = 0; i < scheduleRows.length; i += 1000) {
        const batch = scheduleRows.slice(i, i + 1000);
        const { error } = await supabase.from('train_schedules').insert(batch);
        if (error) throw error;
      }
      return NextResponse.json({ success: true, count: scheduleRows.length });
    }

    return NextResponse.json({ success: true, message: 'Upload siap diproses.' });
  } catch (err: any) {
    console.error('GAPEKA Upload Error:', err);
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}
