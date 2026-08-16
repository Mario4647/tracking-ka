import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeLiveTrains, TrainScheduleStep } from '@/lib/gapeka_engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// In-memory cache for master data on the server
let cachedMaster: {
  trains: any[];
  schedules: Record<string, TrainScheduleStep[]>;
  stations: Record<string, any>;
  loadedAt: number;
} | null = null;

async function loadMasterData() {
  const now = Date.now();
  if (cachedMaster && now - cachedMaster.loadedAt < 10 * 60 * 1000) {
    return cachedMaster;
  }

  // 1. Fetch trains
  let allTrains: any[] = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('train_master')
      .select('*')
      .order('train_number', { ascending: true })
      .range(from, from + batchSize - 1);
    if (error || !data || data.length === 0) break;
    allTrains = allTrains.concat(data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  // 2. Fetch schedules
  let allSchedules: any[] = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('train_schedules')
      .select('train_number, station_order, station_name, station_code, arrival_time, departure_time, notes')
      .order('train_number', { ascending: true })
      .order('station_order', { ascending: true })
      .range(from, from + batchSize - 1);
    if (error || !data || data.length === 0) break;
    allSchedules = allSchedules.concat(data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  const schedulesMap: Record<string, TrainScheduleStep[]> = {};
  const seenOrders = new Map<string, Set<number>>();
  for (const s of allSchedules) {
    if (!schedulesMap[s.train_number]) {
      schedulesMap[s.train_number] = [];
      seenOrders.set(s.train_number, new Set());
    }
    const seen = seenOrders.get(s.train_number)!;
    if (!seen.has(s.station_order)) {
      seen.add(s.station_order);
      schedulesMap[s.train_number].push({
        order: s.station_order,
        name: s.station_name,
        code: s.station_code || '',
        arr: s.arrival_time || '-',
        dep: s.departure_time || '-',
        note: s.notes || '',
      });
    }
  }

  for (const trainNo in schedulesMap) {
    schedulesMap[trainNo].sort((a, b) => a.order - b.order);
  }

  // 3. Fetch stations & seed OSM
  let allStations: any[] = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('train_stations')
      .select('*')
      .range(from, from + batchSize - 1);
    if (error || !data || data.length === 0) break;
    allStations = allStations.concat(data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  const stationsMap: Record<string, any> = {};
  try {
    const osmStations = require('@/lib/osm_stations_indonesia.json');
    for (const [key, st] of Object.entries(osmStations as Record<string, any>)) {
      const geo = {
        name: st.name,
        lat: st.lat,
        lng: st.lng,
        latitude: st.lat,
        longitude: st.lng,
        code: st.code || '',
      };
      stationsMap[key] = geo;
      stationsMap[key.toLowerCase()] = geo;
      const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      stationsMap[normKey] = geo;
    }
  } catch (e) {}

  for (const st of allStations) {
    const lat = parseFloat(st.latitude) || 0;
    const lng = parseFloat(st.longitude) || 0;
    const existing = (st.code && stationsMap[st.code.toUpperCase().trim()]) ||
      (st.name && stationsMap[st.name.toLowerCase().trim()]);

    const geo = {
      name: st.name,
      lat: (existing?.lat && existing.lat !== 0) ? existing.lat : lat,
      lng: (existing?.lng && existing.lng !== 0) ? existing.lng : lng,
      latitude: (existing?.lat && existing.lat !== 0) ? existing.lat : lat,
      longitude: (existing?.lng && existing.lng !== 0) ? existing.lng : lng,
    };

    if (st.code) stationsMap[st.code.toUpperCase().trim()] = geo;
    if (st.name) {
      stationsMap[st.name.trim()] = geo;
      stationsMap[st.name.toLowerCase().trim()] = geo;
      const cleanName = st.name.replace(/^Stasiun\s+/i, '').trim();
      stationsMap[cleanName] = geo;
      stationsMap[cleanName.toLowerCase()] = geo;
      const normName = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
      stationsMap[normName] = geo;
    }
  }

  const trains = allTrains.map((t: any) => ({
    no: t.train_number,
    name: t.name,
    class: t.train_class,
    category: t.category,
    origin: t.origin_station_code,
    destination: t.destination_station_code,
    dep: t.departure_time,
    arr: t.arrival_time,
  }));

  cachedMaster = {
    trains,
    schedules: schedulesMap,
    stations: stationsMap,
    loadedAt: now,
  };

  return cachedMaster;
}

// GET /api/gapeka/live — Returns high-performance server-calculated live train positions
export async function GET(req: NextRequest) {
  try {
    const master = await loadMasterData();
    const simTime = new Date();
    
    // Server computes live positions using the GAPEKA timetable engine
    const liveTrains = computeLiveTrains(
      master.trains,
      master.schedules,
      master.stations,
      simTime
    );

    // Return compact payload for minimal network bandwidth & instantaneous client rendering
    const compactTrains = liveTrains.map(t => ({
      train_number: t.train_number,
      name: t.name,
      train_class: t.train_class,
      category: t.category,
      origin_code: t.origin_code,
      origin_name: t.origin_name,
      destination_code: t.destination_code,
      destination_name: t.destination_name,
      departure_time: t.departure_time,
      arrival_time: t.arrival_time,
      lat: t.lat,
      lng: t.lng,
      speed_kmh: t.speed_kmh,
      heading: t.heading,
      current_station: t.current_station,
      next_station: t.next_station,
      eta_next: t.eta_next,
      status: t.status,
      progress_percent: t.progress_percent,
      activity_label: t.activity_label,
      schedules: t.schedules,
      route_path: t.route_path,
    }));

    return NextResponse.json({
      success: true,
      timestamp: simTime.toISOString(),
      wibTime: new Date(simTime.getTime() + 7 * 3600000).toTimeString().split(' ')[0],
      totalActive: compactTrains.length,
      trains: compactTrains,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (err: any) {
    console.error('Error in /api/gapeka/live:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
