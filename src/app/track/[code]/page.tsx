'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { 
  Navigation, 
  ArrowLeft, 
  Gauge, 
  BatteryCharging, 
  Battery, 
  Users, 
  MapPin, 
  Layers, 
  Compass, 
  AlertTriangle,
  Flame,
  CheckCircle2,
  Car,
  AlertCircle,
  RefreshCw,
  Train,
  Plus,
  Minus
} from 'lucide-react';
import { supabase, MAPBOX_ACCESS_TOKEN } from '@/lib/supabase';
import { TouringSession, Checkpoint, LocationTracking } from '@/lib/types';
import { realWays } from '@/lib/spline_utils';

export default function TrackPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = (params?.code as string)?.toUpperCase();
  const viewerName = searchParams.get('viewer') || searchParams.get('name') || 'Pemantau';

  const [session, setSession] = useState<TouringSession | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationTracking | null>(null);
  const [activeViewersCount, setActiveViewersCount] = useState<number>(1);
  const [currentStyle, setCurrentStyle] = useState<'Default' | '3D Light' | '3D Dark' | 'Satelit' | 'Medan'>('Default');
  const [isDrivingMode, setIsDrivingMode] = useState<boolean>(false);
  const [isCameraLocked, setIsCameraLocked] = useState<boolean>(true);
  const [showStyleMenu, setShowStyleMenu] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showLiveTrains, setShowLiveTrains] = useState<boolean>(false);
  const [liveTrains, setLiveTrains] = useState<any[]>([]);
  const trainLayerGroupRef = useRef<any>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const completedPolylineRef = useRef<any>(null);
  const upcomingPolylineRef = useRef<any>(null);
  const fullPolylineCoordsRef = useRef<[number, number][]>([]);

  // Map Tile URL Helper
  const getTileUrl = (styleName: string) => {
    const token = MAPBOX_ACCESS_TOKEN;
    if (token && token.startsWith('pk.')) {
      switch (styleName) {
        case 'Default':
          return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${token}`;
        case '3D Light':
          return `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${token}`;
        case '3D Dark':
          return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${token}`;
        case 'Satelit':
          return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${token}`;
        case 'Medan':
          return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${token}`;
        default:
          return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${token}`;
      }
    }
    switch (styleName) {
      case 'Default':
        return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      case '3D Light':
        return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      case '3D Dark':
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      case 'Satelit':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'Medan':
        return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      default:
        return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    }
  };

  // 1. Fetch Real Session Data from Supabase
  const loadRealSession = async () => {
    if (!code) return;
    setIsLoading(true);
    setErrorMsg('');

    try {
      const { data: sessionData, error: sessionErr } = await supabase
        .from('touring_sessions')
        .select('*, touring_checkpoints(*), touring_route_segments(*)')
        .eq('session_code', code)
        .maybeSingle();

      if (sessionErr) {
        throw sessionErr;
      }

      if (!sessionData) {
        setErrorMsg(`Sesi perjalanan dengan kode "${code}" tidak ditemukan. Pastikan rider sudah membagikan kode yang benar.`);
        setIsLoading(false);
        return;
      }

      setSession(sessionData);

      const cpList: Checkpoint[] = (sessionData.touring_checkpoints || []).sort(
        (a: any, b: any) => a.order_index - b.order_index
      );
      setCheckpoints(cpList);

      const { data: lastLoc } = await supabase
        .from('touring_locations')
        .select('*')
        .eq('session_id', sessionData.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastLoc) {
        setCurrentLocation(lastLoc);
      } else if (cpList.length > 0) {
        setCurrentLocation({
          id: 'init',
          session_id: sessionData.id,
          latitude: cpList[0].latitude,
          longitude: cpList[0].longitude,
          speed_kmh: 0,
          heading: 0,
          altitude_meters: 0,
          accuracy_meters: 5,
          battery_level: sessionData.fuel_level || 100,
          is_charging: false,
          recorded_at: sessionData.created_at,
        });
      }

      const rawRoute = sessionData.raw_route_points || sessionData.touring_route_segments;
      if (rawRoute && Array.isArray(rawRoute)) {
        fullPolylineCoordsRef.current = rawRoute.map((p: any) => [p.latitude || p.lat, p.longitude || p.lng]);
      } else if (cpList.length > 0) {
        fullPolylineCoordsRef.current = cpList.map(c => [c.latitude, c.longitude]);
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Gagal memuat sesi perjalanan: ${err.message || 'Kesalahan jaringan'}`);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRealSession();
  }, [code]);

  // 2. Realtime Subscriptions
  useEffect(() => {
    if (!session?.id) return;

    const locChannel = supabase
      .channel(`live-loc-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'touring_locations',
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const newLoc = payload.new as LocationTracking;
          setCurrentLocation(newLoc);
          updateRiderPositionOnMap(newLoc.latitude, newLoc.longitude, newLoc.heading || 0);
        }
      )
      .subscribe();

    const sessChannel = supabase
      .channel(`live-sess-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'touring_sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          setSession((prev) => (prev ? { ...prev, ...payload.new } : (payload.new as TouringSession)));
        }
      )
      .subscribe();

    const presenceChannel = supabase.channel(`presence-session-${session.id}`, {
      config: { presence: { key: viewerName } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const total = Object.keys(state).length;
        setActiveViewersCount(Math.max(1, total));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
            viewer_name: viewerName,
          });
        }
      });

    return () => {
      supabase.removeChannel(locChannel);
      supabase.removeChannel(sessChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [session?.id, viewerName]);

  // 3. Leaflet Map Initialization
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current || mapInstanceRef.current) return;

    const initMap = () => {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;

      const initialCenter: [number, number] = currentLocation 
        ? [currentLocation.latitude, currentLocation.longitude]
        : checkpoints.length > 0
        ? [checkpoints[0].latitude, checkpoints[0].longitude]
        : [-6.9175, 107.6191];

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      tileLayerRef.current = L.tileLayer(getTileUrl('Default'), {
        maxZoom: 19,
        tileSize: 512,
        zoomOffset: -1,
      }).addTo(map);

      mapInstanceRef.current = map;

      drawRouteAndCheckpoints();
      if (currentLocation) {
        updateRiderPositionOnMap(currentLocation.latitude, currentLocation.longitude, currentLocation.heading || 0);
      }
    };

    if ((window as any).L) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = initMap;
      document.body.appendChild(script);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isLoading]);

  // 4. Update Map Tile on Style Change
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(getTileUrl(currentStyle));
  }, [currentStyle]);

  // 5. Draw Routes & Checkpoint Markers
  const drawRouteAndCheckpoints = () => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    if (fullPolylineCoordsRef.current.length > 0) {
      if (upcomingPolylineRef.current) map.removeLayer(upcomingPolylineRef.current);

      upcomingPolylineRef.current = L.polyline(fullPolylineCoordsRef.current, {
        color: '#0284c7',
        weight: 6,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      map.fitBounds(upcomingPolylineRef.current.getBounds(), { padding: [60, 60] });
    }

    checkpoints.forEach((cp, idx) => {
      const isStart = idx === 0;
      const isFinish = idx === checkpoints.length - 1;
      const isPassed = cp.status === 'passed' || cp.status === 'reached' || (cp as any).is_passed;

      const markerHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-2xl flex items-center justify-center shadow-lg border-2 ${
            isPassed 
              ? 'bg-emerald-600 border-white text-white' 
              : isStart 
                ? 'bg-sky-600 border-white text-white' 
                : isFinish 
                  ? 'bg-rose-600 border-white text-white' 
                  : 'bg-white border-slate-300 text-slate-800'
          }">
            <span class="text-[11px] font-black">${idx + 1}</span>
          </div>
          <div class="absolute -bottom-6 whitespace-nowrap px-2 py-0.5 rounded-lg bg-white/95 border border-sky-100 text-[10px] font-bold text-slate-800 shadow-sm pointer-events-none">
            ${cp.name}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'cp-marker',
        html: markerHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([cp.latitude, cp.longitude], { icon })
        .addTo(map)
        .bindTooltip(`<b>${cp.name}</b><br>${isPassed ? '✓ Sudah dilewati' : 'Belum tercapai'}`);
    });
  };

  // 6. Update Rider Live Marker
  const updateRiderPositionOnMap = (lat: number, lng: number, heading: number) => {
    requestAnimationFrame(() => {
      const L = (window as any).L;
      const map = mapInstanceRef.current;
      if (!L || !map) return;

      const riderPos: [number, number] = [lat, lng];

      const icon = L.divIcon({
        className: 'rider-live-marker',
        html: `
          <div class="relative w-11 h-11 flex items-center justify-center">
            <div class="w-8 h-8 rounded-full bg-sky-600 border-2 border-white shadow-lg flex items-center justify-center transition-transform duration-300" style="transform: rotate(${heading}deg);">
              <svg class="w-4 h-4 text-white -rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 2 4 10-4-2-4 2 4-10z"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLatLng(riderPos);
        riderMarkerRef.current.setIcon(icon);
      } else {
        riderMarkerRef.current = L.marker(riderPos, { icon }).addTo(map);
      }

      if (isCameraLocked || isDrivingMode) {
        map.panTo(riderPos, { animate: true, duration: 0.6 });
      }
    });
  };

  // 7. Live Trains Polling when "Tampilkan Live KA" is toggled
  useEffect(() => {
    if (!showLiveTrains) {
      if (trainLayerGroupRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(trainLayerGroupRef.current);
        trainLayerGroupRef.current = null;
      }
      return;
    }

    let isSubscribed = true;

    const pollLiveTrains = async () => {
      try {
        const res = await fetch('/api/gapeka/live');
        if (!res.ok) return;
        const data = await res.json();
        if (isSubscribed && data.trains) {
          setLiveTrains(data.trains);
        }
      } catch (e) {
        console.error('Error fetching live trains for pemantau:', e);
      }
    };

    pollLiveTrains();
    const interval = setInterval(pollLiveTrains, 2000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [showLiveTrains]);

  // 8. Render Live Train Markers on Pemantau Map
  useEffect(() => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map || !showLiveTrains) return;

    if (!trainLayerGroupRef.current) {
      trainLayerGroupRef.current = L.layerGroup().addTo(map);
    }
    const layerGroup = trainLayerGroupRef.current;
    layerGroup.clearLayers();

    // 1. Draw Real OSM Java Railway Track Polylines in bright orange (#ea580c)
    if (Array.isArray(realWays)) {
      (realWays as [number, number][][]).forEach((wayCoords) => {
        if (wayCoords.length >= 2) {
          L.polyline(wayCoords, {
            color: '#ea580c',
            weight: 2.5,
            opacity: 0.9,
            interactive: false,
          }).addTo(layerGroup);
        }
      });
    }

    // 2. Render Live Train Markers
    liveTrains.forEach((train) => {
      const isStopped = train.status === 'stopped';
      const markerBgClass = isStopped ? 'bg-emerald-500 ring-emerald-300' : 'bg-sky-600 ring-sky-300';

      const iconHtml = `
        <div class="relative flex items-center justify-center cursor-pointer">
          <div class="w-4 h-4 rounded-full flex items-center justify-center shadow-md border border-white ring-1 ${markerBgClass}">
            <svg class="w-2 h-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>
            </svg>
          </div>
          <div class="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-1 rounded bg-slate-900/90 text-white text-[7px] font-bold font-mono shadow-sm pointer-events-none">
            ${train.train_number}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'pemantau-train-marker',
        html: iconHtml,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      L.marker([train.lat, train.lng], { icon: customIcon })
        .addTo(layerGroup)
        .bindTooltip(`<b>${train.name} (${train.train_number})</b><br>${train.activity_label || train.status}`);
    });
  }, [showLiveTrains, liveTrains]);

  const recenterMap = () => {
    if (currentLocation && mapInstanceRef.current) {
      setIsCameraLocked(true);
      mapInstanceRef.current.setView([currentLocation.latitude, currentLocation.longitude], 16, { animate: true });
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center animate-spin">
          <Navigation className="w-6 h-6 text-sky-600" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-slate-900">Menghubungkan ke Sesi Touring...</h2>
          <p className="text-xs text-slate-500 mt-1">Mencari sesi perjalanan {code}</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800 text-center font-sans">
        <div className="max-w-md w-full bg-white border border-sky-100 rounded-3xl p-8 shadow-xl shadow-sky-950/5 space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Sesi Tidak Ditemukan</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{errorMsg}</p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={loadRealSession}
              className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-600/20"
            >
              <RefreshCw className="w-4 h-4" /> Coba Lagi
            </button>
            <button
              onClick={() => router.push('/touring')}
              className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all border border-slate-200"
            >
              Kembali ke Pantau Touring
            </button>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = Math.min(100, Math.max(0, Math.round((session?.route_progress_ratio || 0) * 100)));
  const totalKm = ((session?.total_distance_meters || 0) / 1000).toFixed(1);
  const completedKm = ((parseFloat(totalKm) * progressPercent) / 100).toFixed(1);
  const remainingKm = Math.max(0, parseFloat(totalKm) - parseFloat(completedKm)).toFixed(1);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Top Floating Header Card */}
      <div className="absolute top-4 left-4 right-4 max-w-4xl mx-auto z-[1000] pointer-events-auto flex items-center justify-between gap-3">
        {/* Left: Back + Session Title */}
        <div className="flex items-center gap-2.5 bg-white/95 rounded-2xl border border-sky-100 p-2 shadow-lg backdrop-blur-md">
          <button
            onClick={() => router.push('/touring')}
            className="w-10 h-10 rounded-xl bg-sky-50 hover:bg-sky-100 text-slate-700 flex items-center justify-center transition-colors"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="pr-3">
            <h1 className="text-sm font-bold text-slate-900 leading-tight">
              {session?.title || 'Touring Rider'}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
                Live Tracking • {code}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Active Viewers Badge */}
        <div className="flex items-center gap-2 bg-white/95 rounded-2xl border border-sky-100 px-3.5 py-2.5 shadow-lg backdrop-blur-md">
          <Users className="w-4 h-4 text-sky-600" />
          <span className="text-xs font-bold text-slate-800">
            {activeViewersCount} <span className="font-normal text-slate-500">pemantau</span>
          </span>
        </div>
      </div>

      {/* Right Floating Map Controls */}
      <div className="absolute top-20 right-4 z-[1000] flex flex-col gap-2.5 pointer-events-auto items-end">
        {/* Map Style Selector */}
        <div className="relative">
          <button
            onClick={() => setShowStyleMenu(!showStyleMenu)}
            className="w-12 h-12 rounded-2xl bg-white/95 border border-sky-100 text-slate-700 hover:text-sky-600 flex items-center justify-center shadow-lg transition-all"
            title="Ganti Tampilan Peta"
          >
            <Layers className="w-6 h-6" />
          </button>

          {showStyleMenu && (
            <div className="absolute right-14 top-0 bg-white/95 rounded-2xl border border-sky-100 p-2 shadow-2xl backdrop-blur-xl w-44 space-y-1">
              {(['Default', '3D Light', '3D Dark', 'Satelit', 'Medan'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => {
                    setCurrentStyle(style);
                    setShowStyleMenu(false);
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between ${
                    currentStyle === style
                      ? 'bg-sky-50 text-sky-700 font-black'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {style}
                  {currentStyle === style && <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zoom In & Zoom Out Controls */}
        <div className="flex flex-col bg-white/95 rounded-2xl border border-sky-100 p-1 shadow-lg">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 hover:bg-sky-50 hover:text-sky-600 transition-colors"
            title="Perbesar Peta (+)"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="h-[1px] bg-slate-100 mx-1" />
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 hover:bg-sky-50 hover:text-sky-600 transition-colors"
            title="Perkecil Peta (-)"
          >
            <Minus className="w-5 h-5" />
          </button>
        </div>

        {/* Recenter Camera */}
        <button
          onClick={recenterMap}
          className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-lg transition-all ${
            isCameraLocked
              ? 'bg-sky-600 border-sky-400 text-white shadow-sky-300'
              : 'bg-white/95 border-sky-100 text-slate-600 hover:text-slate-900'
          }`}
          title="Kunci Kamera ke Posisi Rider"
        >
          <Compass className="w-6 h-6" />
        </button>

        {/* Toggle Live KA Overlay */}
        <button
          onClick={() => setShowLiveTrains(!showLiveTrains)}
          className={`h-12 px-3.5 rounded-2xl border flex items-center justify-center gap-2 shadow-lg transition-all ${
            showLiveTrains
              ? 'bg-sky-600 border-sky-400 text-white shadow-sky-300'
              : 'bg-white/95 border-sky-100 text-slate-700 hover:text-sky-600'
          }`}
          title="Tampilkan Jalur Rel Oren & Live Kereta Api di Peta Pemantau"
        >
          <Train className="w-5 h-5" />
          <span className="text-xs font-bold whitespace-nowrap">
            {showLiveTrains ? 'Live KA Aktif' : 'Tampilkan Live KA'}
          </span>
        </button>

        <button
          onClick={() => setIsDrivingMode(!isDrivingMode)}
          className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-lg transition-all ${
            isDrivingMode
              ? 'bg-emerald-600 border-emerald-400 text-white'
              : 'bg-white/95 border-sky-100 text-slate-600 hover:text-slate-900'
          }`}
          title="Mode Berkendara"
        >
          <Car className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Floating Telemetry HUD Card (Clean Light Theme) */}
      <div className="absolute bottom-4 left-4 right-4 max-w-4xl mx-auto z-[1000] pointer-events-auto">
        <div className="rounded-3xl bg-white/95 border border-sky-100 p-5 shadow-2xl backdrop-blur-xl">
          {/* Top Telemetry Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
            {/* Speedometer */}
            <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight leading-none">
                  {currentLocation?.speed_kmh != null ? Math.round(currentLocation.speed_kmh) : 0}
                  <span className="text-[10px] font-sans font-normal text-slate-500 ml-1">km/j</span>
                </div>
                <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 mt-1">Kecepatan GPS</div>
              </div>
            </div>

            {/* Battery Status */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                {currentLocation?.is_charging ? (
                  <BatteryCharging className="w-5 h-5" />
                ) : (
                  <Battery className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight leading-none">
                  {currentLocation?.battery_level != null ? currentLocation.battery_level : (session?.fuel_level || 100)}%
                </div>
                <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 mt-1">
                  {currentLocation?.is_charging ? 'Sedang Di-charge' : 'Baterai HP Rider'}
                </div>
              </div>
            </div>

            {/* Distance Progress */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none">
                  {completedKm} / {totalKm} <span className="text-xs font-normal text-slate-500">km</span>
                </div>
                <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 mt-1">
                  Sisa: {remainingKm} km
                </div>
              </div>
            </div>

            {/* Status / Stopped Alert */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                {session?.status === 'stopped' ? <AlertTriangle className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 truncate leading-none">
                  {session?.status === 'stopped' ? (
                    <span className="text-amber-600">Sedang Berhenti</span>
                  ) : (
                    <span className="text-emerald-600">Sedang Berjalan</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-1">
                  {session?.stopped_location_label || (session?.status === 'stopped' ? 'Berhenti di tepi jalan' : 'Bergerak aktif')}
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Progress Jalur Rute
              </span>
              <span className="text-sky-700 font-mono font-bold">{progressPercent}% Selesai</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
