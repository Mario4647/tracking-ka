import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase environment variables are missing');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// GET /api/gapeka/data — Fetch all train master + schedules from Supabase in batches
export async function GET(req: NextRequest) {
  try {
    // 1. Fetch all train_master with pagination
    let allTrains: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('train_master')
        .select('*')
        .order('train_number', { ascending: true })
        .range(from, from + batchSize - 1);

      if (error) {
        return NextResponse.json({ error: `Gagal memuat data kereta: ${error.message}` }, { status: 500 });
      }

      if (!data || data.length === 0) break;
      allTrains = allTrains.concat(data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    // 2. Fetch all train_schedules with pagination (deterministic sort by train_number, station_order)
    let allSchedules: any[] = [];
    from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('train_schedules')
        .select('train_number, station_order, station_name, station_code, arrival_time, departure_time, notes')
        .order('train_number', { ascending: true })
        .order('station_order', { ascending: true })
        .range(from, from + batchSize - 1);

      if (error) {
        return NextResponse.json({ error: `Gagal memuat jadwal: ${error.message}` }, { status: 500 });
      }

      if (!data || data.length === 0) break;
      allSchedules = allSchedules.concat(data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    // 3. Build schedulesMap (ensure strictly unique station_order and sorted)
    const schedulesMap: Record<string, any[]> = {};
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

    // Sort schedules for each train by order
    for (const trainNo in schedulesMap) {
      schedulesMap[trainNo].sort((a, b) => a.order - b.order);
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

    // Sort trains numerically by train number (KA 1, 2, 3, ... 1000+)
    trains.sort((a, b) => {
      const aNum = parseInt(String(a.no).replace(/\D/g, ''), 10) || 0;
      const bNum = parseInt(String(b.no).replace(/\D/g, ''), 10) || 0;
      return aNum - bNum;
    });

    // 4. Fetch all stations
    let allStations: any[] = [];
    from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('train_stations')
        .select('*')
        .range(from, from + batchSize - 1);

      if (error) {
        console.error('Failed to load stations:', error.message);
        break;
      }
      if (!data || data.length === 0) break;
      allStations = allStations.concat(data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    const stationsMap: Record<string, any> = {};

    // 1. Seed with high-precision OpenStreetMap Indonesia stations dataset (3,000+ stations)
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
    } catch (e) {
      console.warn('Could not load local OSM stations dataset:', e);
    }

    // 2. Override/Supplement with DB stations
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

      if (st.code) {
        stationsMap[st.code.toUpperCase().trim()] = geo;
      }
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

    return NextResponse.json({
      success: true,
      source: 'supabase',
      trains,
      schedules: schedulesMap,
      stations: stationsMap,
      totalTrains: trains.length,
      totalSchedules: allSchedules.length,
      totalStations: allStations.length,
    });
  } catch (err: any) {
    console.error('GAPEKA Data Fetch Error:', err);
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}
