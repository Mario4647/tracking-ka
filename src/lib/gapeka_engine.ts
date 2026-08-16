// GAPEKA Real-time Railway Simulation Engine
// Trains follow actual railway tracks using A* pathfinding
// Schedule-aware: trains stop at stations based on actual arr/dep times
// Deterministic: train positions are calculated from the current instantaneous WIB time

import {
  findTrackPath,
  getPositionAlongPath,
  buildTrainRoutePath,
  buildTrainRoutePathAndRatios,
  computeStationDistanceRatios,
  snapToNearestRailTrack
} from './spline_utils';
import osmStationsData from './osm_stations_indonesia.json';

const normalizedOsmStations: Record<string, { lat: number; lng: number; name?: string; code?: string }> = {};
for (const [k, v] of Object.entries(osmStationsData as Record<string, any>)) {
  const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normalizedOsmStations[norm]) {
    normalizedOsmStations[norm] = v;
  }
}

export interface TrainScheduleStep {
  order: number;
  name: string;
  code: string;
  arr: string;
  dep: string;
  note: string;
}

export interface LiveTrain {
  train_number: string;
  name: string;
  train_class: string;
  category: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  departure_time: string;
  arrival_time: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  heading: number;
  current_station: string;
  next_station: string;
  eta_next: string;
  status: 'running' | 'stopped' | 'arrived' | 'not_started';
  progress_percent: number;
  delay_minutes: number;
  activity_label: string;
  schedules?: TrainScheduleStep[];
  route_path?: [number, number][];
}

// Convert "HH:MM" or "HH:MM:SS" to seconds from midnight
export function timeToSeconds(timeStr: string): number {
  if (!timeStr || timeStr === '-' || timeStr === 'Ls' || timeStr === '--') return -1;
  const match = timeStr.match(/(\d{1,2})[:.:](\d{2})(?:[:.:](\d{2}))?/);
  if (!match) return -1;
  const h = parseInt(match[1], 10) || 0;
  const m = parseInt(match[2], 10) || 0;
  const s = match[3] ? (parseInt(match[3], 10) || 0) : 0;
  return h * 3600 + m * 60 + s;
}

// Format seconds to "HH:mm"
export function secondsToTime(totalSeconds: number): string {
  const normalized = ((totalSeconds % 86400) + 86400) % 86400;
  const h = Math.floor(normalized / 3600);
  const m = Math.floor((normalized % 3600) / 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Get WIB (Asia/Jakarta, UTC+7) seconds from midnight (0..86399)
export function getWibSeconds(date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  let h = 0, m = 0, s = 0;
  for (const part of parts) {
    if (part.type === 'hour') h = parseInt(part.value, 10) % 24;
    if (part.type === 'minute') m = parseInt(part.value, 10);
    if (part.type === 'second') s = parseInt(part.value, 10);
  }
  return h * 3600 + m * 60 + s;
}

// Calculate bearing in degrees
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);

  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

// ─── Puncak Kecepatan Lintas (Official GAPEKA 2025 Speed Limits) ─────
export function getPuncakKecepatanLintas(
  lat: number,
  lng: number,
  stCodeFrom?: string,
  stCodeTo?: string,
  category: string = 'KA Antarkota',
  trainClass: string = 'Eksekutif',
  trainName: string = ''
): number {
  const cat = (category || '').toLowerCase();
  const cls = (trainClass || '').toLowerCase();
  const name = (trainName || '').toLowerCase();

  // 1. Kereta Barang (Petikemas, Semen, BBM, Parcel, Kargo)
  // Vmax resmi: 70 - 75 km/jam di jalur datar, 50 - 55 km/jam di pegunungan
  if (
    cat.includes('barang') ||
    cat.includes('petikemas') ||
    cat.includes('semen') ||
    cat.includes('cargo') ||
    cat.includes('parcel') ||
    cat.includes('bbm') ||
    cls.includes('barang') ||
    name.includes('barang') ||
    name.includes('petikemas') ||
    name.includes('semen') ||
    name.includes('parcel') ||
    name.includes('kontainer') ||
    name.includes('kargo')
  ) {
    const isMountain =
      (lat < -6.85 && lat > -7.35 && lng > 107.45 && lng < 108.35) ||
      (lat < -8.15 && lat > -8.40 && lng > 113.80 && lng < 114.30);
    return isMountain ? 55 : 75;
  }

  // 2. KA Perintis (Batara Kresna, Cut Meutia, dll.)
  if (name.includes('batara kresna') || name.includes('cut meutia') || cat.includes('perintis')) {
    return 45;
  }

  // 3. Kereta Lokal / Commuter Line (Prameks, Walahar, Jatiluhur, Dhoho, Penataran, Pandanwangi, Siliwangi, Tumapel, Kedung Sepur, dll.)
  // Vmax resmi: 65 - 80 km/jam
  const isLokalOrCommuter =
    cat.includes('lokal') ||
    cat.includes('komuter') ||
    cat.includes('commuter') ||
    cat.includes('perkotaan') ||
    cls.includes('lokal') ||
    cls.includes('komuter') ||
    [
      'prameks',
      'walahar',
      'jatiluhur',
      'dhoho',
      'penataran',
      'tumapel',
      'kedung',
      'pandanwangi',
      'siliwangi',
      'blora jaya',
      'kualastanam',
      'siantar'
    ].some((n) => name.includes(n));

  if (isLokalOrCommuter) {
    if (name.includes('siliwangi')) return 55; // Sukabumi - Cianjur jalur gunung / lengkung
    if (cat.includes('commuter') || name.includes('commuter')) return 80;
    return 75;
  }

  // 4. Lintas Pegunungan Priangan (Cikampek - Padalarang - Bandung - Cibatu - Cipeundeuy - Tasikmalaya - Banjar)
  const isPrianganMountain = lat < -6.80 && lat > -7.40 && lng > 107.40 && lng < 108.40;
  if (isPrianganMountain) {
    return 75; // Vmax resmi jalur pegunungan Daop 2
  }

  // 5. Lintas Pegunungan Tapal Kuda (Jember - Kalibaru - Banyuwangi / Gunung Gumitir)
  const isGumitirMountain = lat < -8.15 && lat > -8.40 && lng > 113.80 && lng < 114.30;
  if (isGumitirMountain) {
    return 70;
  }

  // 6. KA Aglomerasi (Kaligung, Kamandaka, Joglosemarkerto, Banyubiru, Baturraden Ekspres)
  if (
    cat.includes('aglomerasi') ||
    ['kaligung', 'kamandaka', 'joglosemarkerto', 'banyubiru', 'baturraden'].some((n) =>
      name.includes(n)
    )
  ) {
    return 90;
  }

  // 7. KA Antarkota Ekonomi Reguler / PSO (Airlangga, Kahuripan, Sri Tanjung, Bengawan, Probowangi, Matarmaja, Serayu, Kutojaya)
  const isEkonomiMurni = cls.includes('ekonomi') && !cls.includes('eksekutif') && !cls.includes('premium');
  if (isEkonomiMurni) {
    return 90;
  }

  // 8. KA Antarkota Campuran / Bisnis (Lodaya, Ranggajati, Singasari, Gaya Baru Malam Selatan, Brantas, Jayabaya, dll.)
  const isCampuran = cls.includes('bisnis') || cls.includes('campuran') || cls.includes('premium');
  if (isCampuran) {
    return 100;
  }

  // 9. KA Argo & Eksekutif Unggulan di Jalur Datar Double Track
  // Pantura (Cikampek - Cirebon - Tegal - Semarang - Bojonegoro - Surabaya) & Lintas Selatan (Kroya - Kutoarjo - Solo - Madiun - Kertosono)
  const isArgoOrEksekutif =
    cls.includes('argo') ||
    cls.includes('luxury') ||
    cls.includes('eksekutif') ||
    cls.includes('suite') ||
    cls.includes('compartment') ||
    name.includes('argo') ||
    name.includes('taksaka') ||
    name.includes('gajayana') ||
    name.includes('bima') ||
    name.includes('turangga') ||
    name.includes('sembrani');

  const isDoubleTrackFlat =
    (lat > -7.30 && lng >= 107.45 && lng <= 112.75) || // Pantura
    (lat <= -7.35 && lng >= 109.15 && lng <= 112.78); // Lintas Selatan Datar

  if (isArgoOrEksekutif && isDoubleTrackFlat) {
    return 120; // Vmax 120 km/jam hanya untuk KA Eksekutif / Argo di petak datar lurus
  }

  return 95;
}

// ─── Cached Train Route Data ─────────────────────────────────────
interface TrainRouteCache {
  stationCoords: [number, number][];
  fullPath: [number, number][];
  distanceRatios: number[];
  stationTimeSec: { arr: number; dep: number; isLs: boolean }[];
}

const trainRouteCache = new Map<string, TrainRouteCache>();

// Helper to sanitize schedule steps (remove phantom PDF table header rows / duplicate starting terminals)
function sanitizeScheduleSteps(steps: TrainScheduleStep[]): TrainScheduleStep[] {
  if (!steps || steps.length < 2) return steps || [];
  let cleaned = steps.filter(s => {
    const code = (s.code || '').toUpperCase().trim();
    const name = (s.name || '').toUpperCase().trim();
    if (['PETIKEMAS', 'BBM', 'BATUBARA', 'SEMEN', 'PUPUK', 'PARCEL', 'CARGO'].includes(code)) return false;
    if (name.includes('KA BARANG') || name.includes('PETIKEMAS') || name.includes('BATUBARA')) return false;
    return true;
  });

  if (cleaned.length < 2) return steps;

  // If first and last station share the same code (e.g. YK -> ... -> YK in reverse shuttle runs)
  if (cleaned.length >= 3 && cleaned[0].code === cleaned[cleaned.length - 1].code) {
    const t0 = cleaned[0].dep || cleaned[0].arr;
    const t1 = cleaned[1].dep || cleaned[1].arr;
    const s0 = timeToSeconds(t0);
    const s1 = timeToSeconds(t1);
    if (s0 >= 0 && s1 >= 0) {
      const diff = s1 - s0;
      // If time went backwards or jumped > 3 hours for a local shuttle run
      if (diff < 0 || (diff > 3 * 3600 && cleaned.length <= 12)) {
        cleaned.shift();
      }
    }
  }

  return cleaned;
}

// ─── Build per-station time array ────────────────────────────────
// Strictly adheres to GAPEKA timetable stops and departures with distance-weighted time interpolation
function buildStationTimes(
  schedules: TrainScheduleStep[],
  tripStart: number,
  tripEnd: number,
  distanceRatios?: number[]
): { arr: number; dep: number; isLs: boolean }[] {
  let adjustedTripEnd = tripEnd;
  if (adjustedTripEnd < tripStart) {
    adjustedTripEnd += 86400;
  }

  const times: { arr: number; dep: number; isLs: boolean }[] = [];

  for (let i = 0; i < schedules.length; i++) {
    const rawArr = schedules[i].arr;
    const rawDep = schedules[i].dep;
    const isLs = rawArr === 'Ls' || rawArr === 'ls' || rawArr === 'LS';

    let arr = timeToSeconds(rawArr);
    let dep = timeToSeconds(rawDep);

    // First station: departure only
    if (i === 0) {
      if (dep < 0) dep = arr >= 0 ? arr : tripStart;
      arr = dep;
    }
    // Last station: arrival only
    else if (i === schedules.length - 1) {
      if (arr < 0) arr = dep >= 0 ? dep : adjustedTripEnd;
      dep = arr;
    }
    // Middle stations
    else {
      if (isLs) {
        if (dep >= 0) arr = dep;
        if (arr >= 0 && dep < 0) dep = arr;
      } else {
        // Commercial stop station
        if (arr >= 0 && dep >= 0) {
          if (dep <= arr) dep = arr + 60; // Ensure at least 1 min dwell time for commercial stop
        } else if (arr >= 0 && dep < 0) {
          dep = arr + 60;
        } else if (dep >= 0 && arr < 0) {
          arr = Math.max(0, dep - 60);
        }
      }
    }

    times.push({ arr, dep, isLs });
  }

  // Handle midnight crossing for intermediate stations
  let offset = 0;
  for (let i = 1; i < times.length; i++) {
    if (times[i].arr >= 0 && times[i].arr + offset < times[i - 1].dep) {
      const prevNorm = times[i - 1].dep % 86400;
      const currNorm = times[i].arr % 86400;
      if (prevNorm >= 19 * 3600 && currNorm <= 7 * 3600) {
        offset += 86400;
      }
    }
    if (times[i].arr >= 0) times[i].arr += offset;
    if (times[i].dep >= 0) times[i].dep += offset;
  }

  // Interpolate missing intermediate passage times weighted by physical track distance
  for (let i = 0; i < times.length; i++) {
    if (times[i].arr >= 0 && times[i].dep >= 0) continue;

    let prevIdx = i - 1;
    while (prevIdx >= 0 && times[prevIdx].dep < 0) prevIdx--;
    let nextIdx = i + 1;
    while (nextIdx < times.length && times[nextIdx].arr < 0) nextIdx++;

    const prevTime = prevIdx >= 0 ? times[prevIdx].dep : tripStart;
    const nextTime = nextIdx < times.length ? times[nextIdx].arr : adjustedTripEnd;

    let distFraction = 0.5;
    if (distanceRatios && distanceRatios.length === schedules.length && prevIdx >= 0 && nextIdx < distanceRatios.length) {
      const distPrev = distanceRatios[prevIdx];
      const distNext = distanceRatios[nextIdx];
      const distCurr = distanceRatios[i];
      if (distNext > distPrev) {
        distFraction = (distCurr - distPrev) / (distNext - distPrev);
      } else {
        distFraction = (i - prevIdx) / (nextIdx - prevIdx);
      }
    } else {
      const span = nextIdx - prevIdx;
      distFraction = span > 0 ? (i - prevIdx) / span : 0.5;
    }

    const t = Math.round(prevTime + (nextTime - prevTime) * distFraction);
    if (times[i].arr < 0) times[i].arr = t;
    if (times[i].dep < 0) times[i].dep = t;

    if (times[i].isLs) {
      times[i].dep = times[i].arr;
    } else if (times[i].dep <= times[i].arr) {
      times[i].dep = times[i].arr + 60;
    }
  }

  // Ensure dwell times are respected
  for (const t of times) {
    if (t.isLs) {
      t.dep = t.arr;
    } else if (t.dep < t.arr) {
      t.dep = t.arr + 60;
    }
  }

  // Ensure monotonically increasing times
  for (let i = 1; i < times.length; i++) {
    if (times[i].arr < times[i - 1].dep) {
      times[i].arr = times[i - 1].dep + 5;
    }
    if (times[i].dep < times[i].arr) {
      times[i].dep = times[i].arr;
    }
  }

  return times;
}

// ─── Main Computation ────────────────────────────────────────────
export function computeLiveTrains(
  trainsList: any[],
  schedulesMap: Record<string, TrainScheduleStep[]>,
  stationsMap: Record<string, any>,
  simTime: Date
): LiveTrain[] {
  if (!trainsList || trainsList.length === 0) return [];

  // Current simulation time in seconds from midnight (WIB)
  const currentSec =
    simTime.getUTCHours() * 3600 +
    simTime.getUTCMinutes() * 60 +
    simTime.getUTCSeconds() +
    7 * 3600; // WIB = UTC+7

  const results: LiveTrain[] = [];

  const getDynamicStationCoordinate = (code?: string, name?: string): [number, number] | null => {
    const cleanCode = (code || '').toUpperCase().trim();
    const cleanName = (name || '').trim();
    const normCode = cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normName = cleanName.toLowerCase().replace(/^stasiun/i, '').replace(/[^a-z0-9]/g, '');

    // 1. Check DB stationsMap by code
    let st = cleanCode ? stationsMap[cleanCode] : null;
    if (st && (st.lat !== 0 || st.lng !== 0)) {
      return [st.lat, st.lng];
    }

    // 2. Check DB stationsMap by name
    if (cleanName) {
      st = stationsMap[cleanName] ||
        stationsMap[cleanName.toLowerCase()] ||
        stationsMap[cleanName.replace(/^Stasiun\s+/i, '').trim()] ||
        stationsMap[cleanName.replace(/^Stasiun\s+/i, '').toLowerCase().trim()];
      if (st && (st.lat !== 0 || st.lng !== 0)) {
        return [st.lat, st.lng];
      }
    }

    // 3. Check high-precision OpenStreetMap Indonesia stations dataset (3,000+ stations)
    const osmRaw = osmStationsData as Record<string, any>;
    if (cleanCode && osmRaw[cleanCode] && (osmRaw[cleanCode].lat !== 0 || osmRaw[cleanCode].lng !== 0)) {
      return [osmRaw[cleanCode].lat, osmRaw[cleanCode].lng];
    }
    if (cleanName && osmRaw[cleanName.toLowerCase()] && (osmRaw[cleanName.toLowerCase()].lat !== 0 || osmRaw[cleanName.toLowerCase()].lng !== 0)) {
      return [osmRaw[cleanName.toLowerCase()].lat, osmRaw[cleanName.toLowerCase()].lng];
    }
    if (normName && normalizedOsmStations[normName] && (normalizedOsmStations[normName].lat !== 0 || normalizedOsmStations[normName].lng !== 0)) {
      return [normalizedOsmStations[normName].lat, normalizedOsmStations[normName].lng];
    }
    if (normCode && normalizedOsmStations[normCode] && (normalizedOsmStations[normCode].lat !== 0 || normalizedOsmStations[normCode].lng !== 0)) {
      return [normalizedOsmStations[normCode].lat, normalizedOsmStations[normCode].lng];
    }

    return null;
  };

  for (let tIdx = 0; tIdx < trainsList.length; tIdx++) {
    const t = trainsList[tIdx];
    const trainNo = String(t.no || t.train_number || t['No KA']).trim();
    const name = t.name || t['Nama KA'] || `KA ${trainNo}`;
    const trainClass = t.class || t.train_class || t['Kelas KA'] || 'Eksekutif';
    const category = t.category || t['Kategori'] || 'KA Antarkota';
    const rawSchedules = schedulesMap[trainNo] || [];
    const schedules = sanitizeScheduleSteps(rawSchedules);

    const firstStop = schedules[0];
    const lastStop = schedules[schedules.length - 1];

    const originCode = firstStop?.code || t.origin || t.origin_station_code || 'GMR';
    const destCode = lastStop?.code || t.destination || t.destination_station_code || 'SBI';

    const originName = firstStop?.name || t.origin || 'Stasiun Asal';
    const destName = lastStop?.name || t.destination || 'Stasiun Tujuan';

    if (schedules.length >= 2) {
      // ─── 1. Get or build cached route data ───────────────────
      let routeData = trainRouteCache.get(trainNo);

      if (!routeData) {
        // Resolve station coordinates
        const stationCoords: [number, number][] = [];
        const rawCoords: ([number, number] | null)[] = schedules.map(s =>
          getDynamicStationCoordinate(s.code, s.name)
        );

        for (let i = 0; i < schedules.length; i++) {
          if (rawCoords[i]) {
            stationCoords.push(snapToNearestRailTrack(rawCoords[i]![0], rawCoords[i]![1]));
          } else {
            // Interpolate missing coordinates
            let prevIdx = i - 1;
            while (prevIdx >= 0 && !rawCoords[prevIdx]) prevIdx--;
            let nextIdx = i + 1;
            while (nextIdx < schedules.length && !rawCoords[nextIdx]) nextIdx++;

            if (prevIdx >= 0 && nextIdx < schedules.length) {
              const pA = rawCoords[prevIdx]!;
              const pB = rawCoords[nextIdx]!;
              const localRatio = (i - prevIdx) / (nextIdx - prevIdx);
              const lat = pA[0] + (pB[0] - pA[0]) * localRatio;
              const lng = pA[1] + (pB[1] - pA[1]) * localRatio;
              stationCoords.push(snapToNearestRailTrack(lat, lng));
            } else if (prevIdx >= 0) {
              stationCoords.push(snapToNearestRailTrack(rawCoords[prevIdx]![0], rawCoords[prevIdx]![1]));
            } else if (nextIdx < schedules.length) {
              stationCoords.push(snapToNearestRailTrack(rawCoords[nextIdx]![0], rawCoords[nextIdx]![1]));
            } else {
              stationCoords.push(snapToNearestRailTrack(-6.1767, 106.8306));
            }
          }
        }

        // Build the full route path along actual tracks and compute exact station distance ratios
        const { fullPath, distanceRatios } = buildTrainRoutePathAndRatios(stationCoords);

        // Parse schedule times (prefer cleaned first stop departure and last stop arrival)
        let tripStart = timeToSeconds(firstStop.dep !== '-' && firstStop.dep ? firstStop.dep : firstStop.arr);
        if (tripStart < 0) tripStart = timeToSeconds(t.dep || t.departure_time || '');

        let tripEnd = timeToSeconds(lastStop.arr !== '-' && lastStop.arr ? lastStop.arr : lastStop.dep);
        if (tripEnd < 0) tripEnd = timeToSeconds(t.arr || t.arrival_time || '');

        if (tripStart < 0) tripStart = 8 * 3600;
        if (tripEnd < 0) tripEnd = tripStart + Math.max(1800, schedules.length * 240);

        const stationTimeSec = buildStationTimes(schedules, tripStart, tripEnd, distanceRatios);

        routeData = { stationCoords, fullPath, distanceRatios, stationTimeSec };
        trainRouteCache.set(trainNo, routeData);
      }

      const { fullPath, distanceRatios, stationTimeSec } = routeData;

      // ─── 2. Timeline bounds ──────────────────────────────────
      const startSec = stationTimeSec[0].dep;
      const endSec = stationTimeSec[stationTimeSec.length - 1].arr;
      const depTimeStr = secondsToTime(startSec);
      const arrTimeStr = secondsToTime(endSec);

      // Handle midnight crossing for trains that span past midnight (e.g. 20:30 to 04:15)
      let effCurrentSec = currentSec;
      if (endSec >= 86400) {
        if (currentSec < startSec && currentSec + 86400 <= endSec) {
          effCurrentSec = currentSec + 86400;
        }
      }

      // ─── Case A: Not started yet ────────────────────────────
      if (effCurrentSec < startSec) {
        // Skip trains that have not started yet to keep map lightweight and fast
        continue;
      }

      // ─── Case B: Already arrived ────────────────────────────
      if (effCurrentSec >= endSec) {
        // Skip trains that have completed their schedule
        continue;
      }

      // ─── Case C: Active — strictly find which station or segment the train is at ───────
      let segIdx = -1;
      let isStopped = false;
      let stoppedAtStation = '';

      for (let i = 0; i < schedules.length; i++) {
        const st = stationTimeSec[i];

        // Check if train is currently dwelling at this commercial station stop (between arr and dep)
        if (i > 0 && i < schedules.length - 1 && !st.isLs && st.dep > st.arr && effCurrentSec >= st.arr && effCurrentSec < st.dep) {
          isStopped = true;
          stoppedAtStation = schedules[i].name;
          segIdx = i;
          break;
        }

        // Check if train is traveling between station i and station i+1
        if (i < schedules.length - 1) {
          const depFromI = stationTimeSec[i].dep;
          const arrAtNext = stationTimeSec[i + 1].arr;

          if (effCurrentSec >= depFromI && effCurrentSec < arrAtNext) {
            segIdx = i;
            break;
          }
        }
      }

      // Fallback transition boundary check
      if (segIdx < 0) {
        for (let i = 0; i < schedules.length - 1; i++) {
          if (effCurrentSec >= stationTimeSec[i].dep && effCurrentSec <= stationTimeSec[i + 1].arr) {
            segIdx = i;
            break;
          }
        }
        if (segIdx < 0) segIdx = Math.max(0, schedules.length - 2);
      }

      if (isStopped) {
        // Train is strictly stopped at the station — use exact station coordinates directly!
        const stationCoord = routeData.stationCoords[segIdx] || getPositionAlongPath(fullPath, distanceRatios[segIdx]);
        const depTimeStationStr = secondsToTime(stationTimeSec[segIdx].dep);

        results.push({
          train_number: trainNo,
          name,
          train_class: trainClass,
          category,
          origin_code: originCode,
          origin_name: originName,
          destination_code: destCode,
          destination_name: destName,
          departure_time: depTimeStr,
          arrival_time: arrTimeStr,
          lat: stationCoord[0],
          lng: stationCoord[1],
          speed_kmh: 0,
          heading: 0,
          current_station: stoppedAtStation,
          next_station: segIdx + 1 < schedules.length ? schedules[segIdx + 1].name : destName,
          eta_next: segIdx + 1 < schedules.length ? (schedules[segIdx + 1].arr !== '-' && schedules[segIdx + 1].arr !== 'Ls' ? schedules[segIdx + 1].arr : arrTimeStr) : arrTimeStr,
          status: 'stopped',
          progress_percent: Math.round(distanceRatios[segIdx] * 100),
          delay_minutes: 0,
          activity_label: `Berhenti di ${stoppedAtStation} (Berangkat ${depTimeStationStr})`,
          schedules,
          route_path: fullPath
        });
        continue;
      }

      // ─── Train is running between station segIdx and segIdx+1 ──────────────────
      const depFromSeg = stationTimeSec[segIdx].dep;
      const arrAtNext = stationTimeSec[segIdx + 1].arr;
      const segDuration = Math.max(1, arrAtNext - depFromSeg);

      // Timetable ratio strictly driven by departure and arrival schedule (0.0 to 1.0)
      const segRatio = Math.max(0, Math.min(1, (effCurrentSec - depFromSeg) / segDuration));

      // Overall path ratio from station segIdx to station segIdx + 1
      const startRatio = distanceRatios[segIdx];
      const endRatio = distanceRatios[segIdx + 1];
      const overallPathRatio = startRatio + (endRatio - startRatio) * segRatio;

      // Get exact coordinate along the track polyline
      const [lat, lng] = getPositionAlongPath(fullPath, overallPathRatio);

      // Calculate heading from nearby path points
      const aheadRatio = Math.min(1, overallPathRatio + 0.002);
      const [aLat, aLng] = getPositionAlongPath(fullPath, aheadRatio);
      const heading = calculateBearing(lat, lng, aLat, aLng);

      const currStep = schedules[segIdx];
      const nextStep = schedules[segIdx + 1];

      // ─── Visual Speed Display Only (Calculated from section distance & timetable) ───
      const vMax = getPuncakKecepatanLintas(lat, lng, currStep?.code, nextStep?.code, category, trainClass, name);
      const durationHours = Math.max(1 / 60, (arrAtNext - depFromSeg) / 3600);

      const stGeoA = routeData.stationCoords[segIdx] || [lat, lng];
      const stGeoB = routeData.stationCoords[segIdx + 1] || [lat, lng];
      const dLat = (stGeoB[0] - stGeoA[0]) * 111.32;
      const dLng = (stGeoB[1] - stGeoA[1]) * 111.32 * Math.cos((stGeoA[0] * Math.PI) / 180);
      const sectionDistKm = Math.sqrt(dLat * dLat + dLng * dLng) * 1.15; // with rail curvature factor

      const rawScheduleSpeed = Math.round(sectionDistKm / durationHours);
      const targetScheduleSpeed = Math.min(vMax, Math.max(35, rawScheduleSpeed));

      const isDepartingFromStop = segIdx > 0 && !stationTimeSec[segIdx].isLs;
      const isApproachingStop = segIdx + 1 < schedules.length && !stationTimeSec[segIdx + 1].isLs;

      let visualSpeed = targetScheduleSpeed;
      if (isDepartingFromStop && segRatio < 0.2) {
        // Visual acceleration: 20 km/h -> targetScheduleSpeed
        visualSpeed = Math.round(20 + (segRatio / 0.2) * (targetScheduleSpeed - 20));
      } else if (isApproachingStop && segRatio > 0.8) {
        // Visual deceleration: targetScheduleSpeed -> 15 km/h
        visualSpeed = Math.round(15 + ((1 - segRatio) / 0.2) * (targetScheduleSpeed - 15));
      } else {
        const microVariation = Math.sin(segRatio * Math.PI * 4) * 2;
        visualSpeed = Math.round(targetScheduleSpeed + microVariation);
      }
      visualSpeed = Math.max(10, Math.min(vMax, visualSpeed));
      const progress = Math.round(overallPathRatio * 100);

      results.push({
        train_number: trainNo,
        name,
        train_class: trainClass,
        category,
        origin_code: originCode,
        origin_name: originName,
        destination_code: destCode,
        destination_name: destName,
        departure_time: depTimeStr,
        arrival_time: arrTimeStr,
        lat,
        lng,
        speed_kmh: visualSpeed,
        heading,
        current_station: currStep.name,
        next_station: nextStep.name,
        eta_next: nextStep.arr !== '-' && nextStep.arr !== 'Ls' ? nextStep.arr : arrTimeStr,
        status: 'running',
        progress_percent: progress,
        delay_minutes: 0,
        activity_label: `Berjalan: ${currStep.name} ➔ ${nextStep.name} (${visualSpeed} km/jam)`,
        schedules,
        route_path: fullPath
      });
      continue;
    }

    // ─── Fallback: train with fewer than 2 schedule steps ───────
    const origGeo = getDynamicStationCoordinate(originCode, originName) || [-6.1767, 106.8306];
    const destGeo = getDynamicStationCoordinate(destCode, destName) || [-7.2478, 112.7317];

    const startSec = timeToSeconds(t.dep || t.departure_time || '08:00');
    let endSec = timeToSeconds(t.arr || t.arrival_time || '16:00');
    if (endSec < startSec) endSec += 86400;

    let effSec = currentSec;
    if (endSec >= 86400 && currentSec < startSec && currentSec + 86400 <= endSec) {
      effSec = currentSec + 86400;
    }

    const depStr = secondsToTime(startSec);
    const arrStr = secondsToTime(endSec);

    if (effSec < startSec || effSec >= endSec) {
      // Skip inactive fallback trains
      continue;
    } else {
      const duration = Math.max(1, endSec - startSec);
      const ratio = Math.max(0, Math.min(1, (effSec - startSec) / duration));
      const iLat = origGeo[0] + (destGeo[0] - origGeo[0]) * ratio;
      const iLng = origGeo[1] + (destGeo[1] - origGeo[1]) * ratio;
      const [snapLat, snapLng] = snapToNearestRailTrack(iLat, iLng);
      const heading = calculateBearing(origGeo[0], origGeo[1], destGeo[0], destGeo[1]);

      results.push({
        train_number: trainNo,
        name,
        train_class: trainClass,
        category,
        origin_code: originCode,
        origin_name: originName,
        destination_code: destCode,
        destination_name: destName,
        departure_time: depStr,
        arrival_time: arrStr,
        lat: snapLat,
        lng: snapLng,
        speed_kmh: 80,
        heading,
        current_station: originName,
        next_station: destName,
        eta_next: arrStr,
        status: 'running',
        progress_percent: Math.round(ratio * 100),
        delay_minutes: 0,
        activity_label: `Berjalan: ${originName} ➔ ${destName}`,
        schedules
      });
    }
  }

  return results;
}
