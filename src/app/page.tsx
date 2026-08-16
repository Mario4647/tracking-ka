'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Layers, 
  Clock, 
  X, 
  Train, 
  Check, 
  Plus, 
  Minus, 
  MapPin, 
  Eye, 
  RotateCcw, 
  Navigation, 
  User, 
  LogOut, 
  Key, 
  Lock, 
  UserPlus, 
  AlertCircle,
  Table as TableIcon,
  LayoutGrid,
  ChevronUp,
  ChevronDown,
  ArrowRight
} from 'lucide-react';
import { MAPBOX_ACCESS_TOKEN } from '@/lib/supabase';
import { computeLiveTrains, LiveTrain, TrainScheduleStep } from '@/lib/gapeka_engine';
import { realWays } from '@/lib/spline_utils';
import { authService } from '@/lib/auth_service';
import { TouringUser } from '@/lib/types';

// Live position poll interval (ms). Also drives the marker glide-animation
// duration below, so the animation always finishes exactly as the next
// server update arrives - no snapping, no drift.
const POLL_INTERVAL_MS = 250;

export default function LiveTrackingKeretaPage() {
  const router = useRouter();

  // ─── Authentication State (Mandatory Login Gate) ───────────────────
  const [currentUser, setCurrentUser] = useState<TouringUser | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState<string>('');
  const [authPin, setAuthPin] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // ─── Live Train Tracking State ──────────────────────────────────────
  const [currentTimeWib, setCurrentTimeWib] = useState<string>('');
  const [liveTrains, setLiveTrains] = useState<LiveTrain[]>([]);
  const [selectedTrainNo, setSelectedTrainNo] = useState<string | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [currentStyle, setCurrentStyle] = useState<'Default' | '3D Light' | '3D Dark' | 'Satelit'>('Default');
  const [showStyleMenu, setShowStyleMenu] = useState<boolean>(false);
  const [activeTabDrawer, setActiveTabDrawer] = useState<'info' | 'schedule'>('info');
  const [trainViewMode, setTrainViewMode] = useState<'table' | 'cards'>('table');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Derive active selected train in real-time from liveTrains (updates every second without refresh)
  const selectedTrain = useMemo(() => {
    if (!selectedTrainNo) return null;
    return liveTrains.find(t => t.train_number === selectedTrainNo) || null;
  }, [liveTrains, selectedTrainNo]);

  // Pagination for train list sidebar (50 items per page)
  const [listPage, setListPage] = useState<number>(0);
  const LIST_PAGE_SIZE = 50;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const trainMarkersRef = useRef<Record<string, any>>({});
  const routeLayersRef = useRef<any[]>([]);
  const stationMarkersRef = useRef<any[]>([]);
  const lastFlownTrainNoRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const backendDataRef = useRef<{ trains: any[]; schedules: Record<string, TrainScheduleStep[]>; stations: Record<string, any> } | null>(null);

  // ─── Auth Initialization & Persistence Check ───────────────────────
  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    setAuthChecking(false);

    const handleAuthChange = () => {
      setCurrentUser(authService.getCurrentUser());
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        const res = await authService.login(authUsername, authPin);
        if (!res.success) {
          setAuthError(res.error || 'Gagal login');
        } else {
          setCurrentUser(res.user || null);
          setAuthUsername('');
          setAuthPin('');
        }
      } else {
        const res = await authService.register(authUsername, authPin);
        if (!res.success) {
          setAuthError(res.error || 'Gagal mendaftar');
        } else {
          setCurrentUser(res.user || null);
          setAuthUsername('');
          setAuthPin('');
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Terjadi kesalahan');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
  };

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
      default:
        return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    }
  };

  // Helper to check if a train is a Kereta Lokal / Commuter / Perkotaan
  const isTrainLokal = (train: { category?: string; name?: string; train_class?: string }) => {
    const cat = (train.category || '').toLowerCase();
    const name = (train.name || '').toLowerCase();
    const cls = (train.train_class || '').toLowerCase();
    return (
      cat.includes('lokal') ||
      cat.includes('perkotaan') ||
      cat.includes('komuter') ||
      cat.includes('commuter') ||
      cls.includes('lokal') ||
      cls.includes('komuter') ||
      name.includes('lokal') ||
      name.includes('commuter') ||
      name.includes('prameks') ||
      name.includes('walahar') ||
      name.includes('jatiluhur') ||
      name.includes('dhoho') ||
      name.includes('penataran') ||
      name.includes('tumapel') ||
      name.includes('kedung') ||
      name.includes('blora') ||
      name.includes('pandanwangi') ||
      name.includes('siliwangi') ||
      name.includes('batara kresna') ||
      name.includes('kualastanam') ||
      name.includes('cut meutia') ||
      name.includes('siantar')
    );
  };

  // Helper to check if a train is a Kereta Barang
  const isTrainBarang = (train: { category?: string; name?: string; train_class?: string }) => {
    const cat = (train.category || '').toLowerCase();
    const name = (train.name || '').toLowerCase();
    const cls = (train.train_class || '').toLowerCase();
    return (
      cat.includes('barang') ||
      cat.includes('petikemas') ||
      cat.includes('semen') ||
      cat.includes('parcel') ||
      cat.includes('cargo') ||
      cat.includes('bbm') ||
      cls.includes('barang') ||
      name.includes('barang') ||
      name.includes('petikemas') ||
      name.includes('semen') ||
      name.includes('parcel') ||
      name.includes('bontang') ||
      name.includes('kontainer') ||
      name.includes('kargo')
    );
  };

  // Filter categories matching
  const filterTrainCategory = (train: LiveTrain, cat: string) => {
    if (cat === 'Semua') return true;
    const tCat = (train.category || '').toLowerCase();
    const tName = (train.name || '').toLowerCase();

    if (cat === 'KA Antarkota') {
      return (
        !isTrainLokal(train) &&
        !isTrainBarang(train) &&
        !tCat.includes('aglomerasi')
      );
    }
    if (cat === 'Commuter Line' || cat === 'KA Lokal') {
      return isTrainLokal(train);
    }
    if (cat === 'Aglomerasi') {
      return (
        tCat.includes('aglomerasi') ||
        ['kaligung', 'kamandaka', 'joglosemarkerto', 'banyubiru', 'baturraden'].some(n => tName.includes(n))
      );
    }
    if (cat === 'KA Barang') {
      return isTrainBarang(train);
    }
    return true;
  };

  // Load Leaflet and initialize map once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;

    const setupMap = async () => {
      try {
        const leafletModule = await import('leaflet');
        const L = leafletModule.default || leafletModule;
        (window as any).L = L;

        if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;

        const map = L.map(mapContainerRef.current, {
          center: [-7.25, 110.4], // Center over Java Railway Network
          zoom: 8,
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true,
          fadeAnimation: true,
          zoomAnimation: true,
          markerZoomAnimation: true,
          wheelDebounceTime: 40,
        });

        // 1. Create a dedicated top pane for Railway Tracks (above base tiles)
        map.createPane('railwayPane');
        const rPane = map.getPane('railwayPane');
        if (rPane) {
          rPane.style.zIndex = '450';
        }

        const token = MAPBOX_ACCESS_TOKEN;
        const isMapbox = token && token.startsWith('pk.');

        // 2. Base tile layer (underneath in default pane)
        tileLayerRef.current = L.tileLayer(getTileUrl('Default'), {
          maxZoom: 19,
          subdomains: 'abcd',
          tileSize: isMapbox ? 512 : 256,
          zoomOffset: isMapbox ? -1 : 0,
          updateWhenIdle: false,
          updateWhenZooming: false,
        }).addTo(map);

        // 3. Render real OSM Java railway track vector polylines in bright orange (#ea580c)
        // PERF FIX: previously created one L.polyline() PER way (7,350 separate layer
        // objects, 48k+ points total) which is extremely expensive to set up and to
        // reproject on every pan/zoom on mobile. Leaflet's L.polyline() natively accepts
        // an array of line arrays (multi-polyline) and renders it as ONE layer/ONE canvas
        // path instead of thousands of individual layers - same visual result, a fraction
        // of the render cost.
        if (Array.isArray(realWays)) {
          const validWays = (realWays as [number, number][][]).filter(w => w.length >= 2);
          L.polyline(validWays, {
            color: '#ea580c',
            weight: 2.5,
            opacity: 0.9,
            pane: 'railwayPane',
            interactive: false,
          }).addTo(map);
        }

        // 4. Also layer OpenRailwayMap infrastructure tiles in railwayPane for high zoom details
        // PERF FIX: added minZoom so this third-party overlay only loads tiles once the user
        // has zoomed into a specific area, instead of doubling every tile request from the
        // initial whole-Java view (zoom 8) where the extra detail isn't even visible/useful.
        L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
          maxZoom: 19,
          minZoom: 12,
          opacity: 0.85,
          pane: 'railwayPane',
          updateWhenIdle: false,
          updateWhenZooming: false,
        }).addTo(map);

        mapInstanceRef.current = map;

        // PERF/SMOOTHNESS FIX: instead of polling faster, run a single continuous
        // rAF loop that interpolates each train marker from its last displayed
        // position toward its latest fetched target position over the polling
        // window. This runs at the browser's native repaint rate (~60fps) without
        // increasing fetch/network/state-update load at all - the server is still
        // only queried every 1.5s, but the visual motion is smooth in between.
        const animateMarkers = () => {
          const now = performance.now();
          Object.values(trainMarkersRef.current).forEach((marker: any) => {
            if (!marker._animTarget) return;
            const elapsed = now - marker._animStart;
            const t = Math.min(1, elapsed / marker._animDuration);
            // ease-out so motion settles smoothly instead of a linear robotic glide
            const eased = 1 - Math.pow(1 - t, 2);
            const fromLat = marker._animFrom.lat;
            const fromLng = marker._animFrom.lng;
            const toLat = marker._animTarget.lat;
            const toLng = marker._animTarget.lng;
            const lat = fromLat + (toLat - fromLat) * eased;
            const lng = fromLng + (toLng - fromLng) * eased;
            marker.setLatLng([lat, lng]);
            if (t >= 1) {
              marker._animTarget = null;
            }
          });
          animationFrameRef.current = requestAnimationFrame(animateMarkers);
        };
        animationFrameRef.current = requestAnimationFrame(animateMarkers);

        setTimeout(() => {
          if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
        }, 350);
      } catch (e) {
        console.error('Leaflet load error:', e);
      }
    };

    setupMap();

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer on Style Change
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current || !tileLayerRef.current) return;
    const token = MAPBOX_ACCESS_TOKEN;
    const isMapbox = token && token.startsWith('pk.');
    
    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(getTileUrl(currentStyle), {
      maxZoom: 19,
      subdomains: 'abcd',
      tileSize: isMapbox ? 512 : 256,
      zoomOffset: isMapbox ? -1 : 0,
      updateWhenIdle: false,
      updateWhenZooming: false,
    }).addTo(mapInstanceRef.current);
  }, [currentStyle]);

  // High-performance Server-Side Live Train Polling
  const fetchLiveTrains = async () => {
    try {
      const res = await fetch('/api/gapeka/live');
      if (!res.ok) return;
      const data = await res.json();
      if (data.trains) {
        setLiveTrains(data.trains);
      }
      if (data.wibTime) {
        setCurrentTimeWib(data.wibTime);
      }
    } catch (err) {
      console.error('Error loading live trains from server:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveTrains();
    const interval = setInterval(fetchLiveTrains, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Smooth 1-second local WIB clock ticker
  useEffect(() => {
    const tickClock = () => {
      const now = new Date();
      const wibStr = now.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      setCurrentTimeWib(wibStr);
    };
    const clockTimer = setInterval(tickClock, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Map Markers Rendering (Compact & Small with Train Icon, dynamically updated every second)
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const visibleTrains = liveTrains.filter(t => filterTrainCategory(t, selectedCategory));
    const activeNumbers = new Set(visibleTrains.map(t => t.train_number));

    // Remove markers not active
    Object.keys(trainMarkersRef.current).forEach(trainNo => {
      if (!activeNumbers.has(trainNo)) {
        map.removeLayer(trainMarkersRef.current[trainNo]);
        delete trainMarkersRef.current[trainNo];
      }
    });

    // Create or update markers
    visibleTrains.forEach(train => {
      const isLokal = isTrainLokal(train);
      const isBarang = isTrainBarang(train);
      const isSelected = selectedTrainNo === train.train_number;
      const isStopped = train.status === 'stopped';

      // Dynamic Color Scheme:
      // 1. All stopped trains -> GREEN (bg-emerald-500)
      // 2. Freight / Barang -> RED (bg-rose-600)
      // 3. Local / Commuter -> YELLOW / AMBER (bg-amber-500)
      // 4. Passenger / Antarkota -> BLUE (bg-sky-600)
      let markerBgClass = 'bg-sky-600 border-white ring-1 ring-sky-300';
      let badgeBgClass = 'bg-slate-900/90 border border-slate-700 text-white';

      if (isStopped) {
        markerBgClass = isSelected
          ? 'bg-emerald-600 border-white ring-2 ring-emerald-300 scale-125 z-50'
          : 'bg-emerald-500 border-white ring-1 ring-emerald-300';
        badgeBgClass = 'bg-emerald-950/90 border border-emerald-600 text-emerald-200';
      } else if (isBarang) {
        markerBgClass = isSelected
          ? 'bg-rose-600 border-white ring-2 ring-rose-400 scale-125 z-50'
          : 'bg-rose-600 border-white ring-1 ring-rose-300';
        badgeBgClass = 'bg-rose-950/90 border border-rose-600 text-rose-200';
      } else if (isLokal) {
        markerBgClass = isSelected
          ? 'bg-amber-600 border-white ring-2 ring-yellow-400 scale-125 z-50'
          : 'bg-amber-500 border-white ring-1 ring-amber-300';
        badgeBgClass = 'bg-amber-950/90 border border-amber-600 text-amber-200';
      } else {
        markerBgClass = isSelected
          ? 'bg-sky-700 border-white ring-2 ring-sky-400 scale-125 z-50'
          : 'bg-sky-600 border-white ring-1 ring-sky-300';
        badgeBgClass = 'bg-slate-900/90 border border-slate-700 text-white';
      }

      const iconHtml = `
        <div class="relative flex items-center justify-center cursor-pointer transition-transform hover:scale-125">
          <div class="w-5 h-5 rounded-full flex items-center justify-center shadow-md border ${markerBgClass}">
            <svg class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>
            </svg>
          </div>
          <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-1 py-0.2 rounded ${badgeBgClass} text-[8px] font-bold font-mono shadow-sm pointer-events-none">
            ${train.train_number}
          </div>
        </div>
      `;

      // PERF FIX: this signature only changes when the marker's *appearance* should
      // change (selection, stopped status, category-derived color). Position updates
      // alone no longer trigger a rebuilt divIcon.
      const iconSignature = `${markerBgClass}|${badgeBgClass}|${train.train_number}`;

      if (trainMarkersRef.current[train.train_number]) {
        const marker = trainMarkersRef.current[train.train_number];
        // SMOOTHNESS FIX: don't snap position instantly - set an animation
        // target and let the rAF loop (see map init effect) glide the marker
        // there over the polling window. "_animFrom" is the marker's CURRENT
        // displayed position (not the previous target), so overlapping/rapid
        // updates never cause a jump, only a redirected glide.
        const currentPos = marker.getLatLng();
        marker._animFrom = { lat: currentPos.lat, lng: currentPos.lng };
        marker._animTarget = { lat: train.lat, lng: train.lng };
        marker._animStart = performance.now();
        marker._animDuration = POLL_INTERVAL_MS;
        // PERF FIX: previously called marker.setIcon() unconditionally on every
        // ~1.5s poll for every visible train, which rebuilds the HTML/SVG string
        // and swaps the DOM element even when nothing visual changed. Now it only
        // rebuilds the icon when the signature actually differs.
        if (marker._iconSignature !== iconSignature) {
          const customIcon = L.divIcon({
            className: 'custom-train-marker',
            html: iconHtml,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });
          marker.setIcon(customIcon);
          marker._iconSignature = iconSignature;
        }
      } else {
        const customIcon = L.divIcon({
          className: 'custom-train-marker',
          html: iconHtml,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        const marker = L.marker([train.lat, train.lng], { icon: customIcon }).addTo(map);
        marker._iconSignature = iconSignature;
        marker.on('click', () => {
          setSelectedTrainNo(train.train_number);
          setShowMobileSidebar(false);
        });
        trainMarkersRef.current[train.train_number] = marker;
      }
    });
  }, [liveTrains, selectedTrainNo, selectedCategory]);

  // Handle Selected Train Detail Route & Stations (Draws once per newly selected train)
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear old route & station markers
    routeLayersRef.current.forEach(l => map.removeLayer(l));
    routeLayersRef.current = [];
    stationMarkersRef.current.forEach(m => map.removeLayer(m));
    stationMarkersRef.current = [];

    if (!selectedTrain) {
      lastFlownTrainNoRef.current = null;
      return;
    }

    const isLokal = isTrainLokal(selectedTrain);
    const isBarang = isTrainBarang(selectedTrain);
    const isStopped = selectedTrain.status === 'stopped';

    const terminalColor = isStopped
      ? 'bg-emerald-600 border-white'
      : isBarang
        ? 'bg-rose-600 border-white'
        : isLokal
          ? 'bg-amber-600 border-white'
          : 'bg-sky-700 border-white';

    const regularColor = isStopped
      ? 'bg-emerald-500 border-white'
      : isBarang
        ? 'bg-rose-500 border-white'
        : isLokal
          ? 'bg-amber-500 border-white'
          : 'bg-sky-500 border-white';

    // Draw station points along route
    const trainSchedules = selectedTrain.schedules || [];
    if (trainSchedules.length > 0 && backendDataRef.current) {
      const { stations } = backendDataRef.current;
      trainSchedules.forEach((st: TrainScheduleStep) => {
        const stGeo = stations[st.code];
        if (stGeo && stGeo.latitude && stGeo.longitude) {
          const isLs = st.arr === 'Ls' || st.arr === 'ls';
          const isTerminal = st.order === 1 || st.order === trainSchedules.length;

          const stMarkerHtml = `
            <div class="flex items-center justify-center">
              <div class="w-2.5 h-2.5 rounded-full border ${
                isTerminal 
                  ? terminalColor 
                  : isLs 
                    ? 'bg-slate-400 border-white opacity-70' 
                    : regularColor
              } shadow-sm"></div>
            </div>
          `;

          const stIcon = L.divIcon({
            className: 'st-marker',
            html: stMarkerHtml,
            iconSize: [10, 10],
            iconAnchor: [5, 5]
          });

          const m = L.marker([stGeo.latitude, stGeo.longitude], { icon: stIcon })
            .addTo(map)
            .bindTooltip(`<b>${st.name}</b> (${st.code})<br>Datang: ${st.arr} | Berangkat: ${st.dep}`, {
              direction: 'top',
              offset: [0, -4],
              className: 'station-tooltip'
            });

          stationMarkersRef.current.push(m);
        }
      });
    }

    // Smoothly fly to selected train on new selection
    if (lastFlownTrainNoRef.current !== selectedTrain.train_number) {
      lastFlownTrainNoRef.current = selectedTrain.train_number;
      map.flyTo([selectedTrain.lat, selectedTrain.lng], 11, {
        duration: 1.2,
        easeLinearity: 0.25
      });
    }
  }, [selectedTrainNo]);

  // Sidebar Filtered & Sorted Trains List (numeric sort)
  const filteredSidebarTrains = liveTrains.filter(t => {
    if (!filterTrainCategory(t, selectedCategory)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.train_number.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.origin_name.toLowerCase().includes(q) ||
      t.destination_name.toLowerCase().includes(q)
    );
  });

  const sortedSidebarTrains = [...filteredSidebarTrains].sort((a, b) => {
    const aNum = parseInt(String(a.train_number).replace(/\D/g, ''), 10) || 0;
    const bNum = parseInt(String(b.train_number).replace(/\D/g, ''), 10) || 0;
    return aNum - bNum;
  });

  const totalPages = Math.ceil(sortedSidebarTrains.length / LIST_PAGE_SIZE);
  const paginatedTrains = sortedSidebarTrains.slice(
    listPage * LIST_PAGE_SIZE,
    (listPage + 1) * LIST_PAGE_SIZE
  );

  useEffect(() => {
    setListPage(0);
  }, [searchQuery, selectedCategory]);

  const activeRunningCount = liveTrains.filter(t => t.status === 'running' || t.status === 'stopped').length;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#eef2f6] text-slate-800 flex flex-col font-sans select-none">
      {/* ─── Top Main Navigation Bar (Ultra-Clean & Responsive) ─ */}
      <header className="absolute top-2.5 sm:top-4 left-2.5 sm:left-4 right-2.5 sm:right-4 z-30 flex items-center justify-between pointer-events-none gap-2">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-2 p-1.5 sm:p-2 bg-white/95 backdrop-blur-xl border border-sky-100 rounded-2xl shadow-xl shadow-sky-950/5 pointer-events-auto">
          {/* Left: App Logo & Live WIB Clock */}
          <div className="flex items-center gap-2 sm:gap-3 pl-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-700 flex items-center justify-center shadow-md shadow-sky-600/20 shrink-0 text-white">
              <Train className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xs sm:text-sm tracking-tight text-slate-900 leading-none">
                  Radar KA
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[8px] sm:text-[9px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                  GAPEKA
                </span>
              </div>
              <div className="text-[10px] sm:text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>{currentTimeWib || '12:00:00'} WIB</span>
                <span className="text-slate-300">•</span>
                <span className="text-sky-700 font-bold font-sans">{activeRunningCount} KA Aktif</span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Pantau Touring Navigation */}
            <button
              onClick={() => router.push('/touring')}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-[11px] sm:text-xs font-bold text-white transition-all shadow-md shadow-sky-600/20 shrink-0 active:scale-95"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pantau Touring</span>
              <span className="sm:hidden">Touring</span>
            </button>

            {/* Map Style Selector */}
            <div className="relative">
              <button
                onClick={() => setShowStyleMenu(!showStyleMenu)}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-all shadow-sm"
                title="Ganti Tampilan Peta"
              >
                <Layers className="w-4 h-4" />
              </button>

              {showStyleMenu && (
                <div className="absolute right-0 top-12 w-44 bg-white border border-sky-100 rounded-2xl p-1.5 shadow-2xl z-50 space-y-0.5">
                  {(['Default', '3D Light', '3D Dark', 'Satelit'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => {
                        setCurrentStyle(style);
                        setShowStyleMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                        currentStyle === style ? 'bg-sky-50 text-sky-700 font-black' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{style}</span>
                      {currentStyle === style && <Check className="w-3.5 h-3.5 text-sky-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User Profile / Logout */}
            {currentUser && (
              <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
                <div className="hidden md:flex items-center gap-1 text-xs text-sky-800 font-semibold px-2">
                  <User className="w-3.5 h-3.5 text-sky-600" />
                  <span className="max-w-[90px] truncate">@{currentUser.username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all shadow-sm"
                  title="Keluar"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Map Canvas ──────────────────────────────────────────────── */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0 bg-[#eef2f6]" />

      {/* ─── Map Zoom & Controls HUD (+ and - Buttons) ───────────────── */}
      <div className="absolute right-3 sm:right-4 bottom-20 sm:bottom-6 z-20 flex flex-col gap-1.5 pointer-events-auto">
        <div className="flex flex-col bg-white/95 rounded-2xl border border-sky-100 p-1 shadow-xl backdrop-blur-xl">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 hover:bg-sky-50 hover:text-sky-600 transition-colors active:scale-95"
            title="Zoom In (+)"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="h-[1px] bg-slate-100 mx-1" />
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 hover:bg-sky-50 hover:text-sky-600 transition-colors active:scale-95"
            title="Zoom Out (-)"
          >
            <Minus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ─── Bottom Floating Toggle Pill (Always Accessible on Mobile & Desktop) ── */}
      {!showMobileSidebar && (
        <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="flex items-center gap-2.5 px-5 py-3 rounded-full font-extrabold text-xs sm:text-sm shadow-2xl transition-all active:scale-95 border border-slate-700/80 bg-slate-900/95 hover:bg-slate-800 text-white shadow-slate-950/40 backdrop-blur-xl group"
          >
            <TableIcon className="w-4 h-4 text-sky-400 group-hover:rotate-12 transition-transform" />
            <span>Buka Tabel Kereta ({activeRunningCount} Aktif)</span>
            <ChevronUp className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}

      {/* ─── Collapsible Train Table & List Modal / Bottom Sheet ───────── */}
      {showMobileSidebar && (
        <div className="fixed sm:absolute z-40 inset-x-0 bottom-0 top-14 sm:inset-x-auto sm:top-20 sm:left-4 sm:bottom-6 sm:w-[540px] sm:max-w-[90vw] flex flex-col bg-white/98 sm:rounded-3xl rounded-t-[28px] border-t sm:border border-slate-200 shadow-2xl shadow-slate-950/30 backdrop-blur-2xl overflow-hidden pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom duration-200">
          {/* Mobile Drag Indicator Bar */}
          <div className="sm:hidden w-12 h-1 bg-slate-300 rounded-full mx-auto my-2" />

          {/* Header Bar */}
          <div className="px-4 py-3 border-b border-slate-200 bg-sky-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
                <Train className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight">
                  Daftar Live Kereta Api
                </h3>
                <span className="text-[10px] text-slate-500 font-medium">
                  {filteredSidebarTrains.length} Kereta Beroperasi Sesuai GAPEKA 2025
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Toggle: Cards vs Table */}
              <div className="flex bg-slate-200/80 p-0.5 rounded-xl">
                <button
                  onClick={() => setTrainViewMode('cards')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                    trainViewMode === 'cards' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600'
                  }`}
                  title="Tampilan Kartu"
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>Kartu</span>
                </button>
                <button
                  onClick={() => setTrainViewMode('table')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                    trainViewMode === 'table' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600'
                  }`}
                  title="Tampilan Tabel"
                >
                  <TableIcon className="w-3 h-3" />
                  <span>Tabel</span>
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
                title="Tutup Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search & Filter Header */}
          <div className="p-3 border-b border-slate-200 space-y-2 bg-white">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari No. KA, Nama Kereta, Rute..."
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 transition-all font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {['Semua', 'KA Antarkota', 'Commuter Line', 'Aglomerasi', 'KA Barang'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto bg-slate-50/50 p-2.5">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-2">
                <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium">Memuat Data GAPEKA...</span>
              </div>
            ) : paginatedTrains.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs text-center p-4">
                <Train className="w-8 h-8 opacity-30 mb-2 text-slate-400" />
                <span>Tidak ada kereta yang cocok dengan filter saat ini.</span>
              </div>
            ) : trainViewMode === 'cards' ? (
              /* ── CARDS VIEW (Clean & Mobile-Friendly) ── */
              <div className="space-y-2">
                {paginatedTrains.map((train) => {
                  const isStopped = train.status === 'stopped';
                  const isRunning = train.status === 'running';
                  const isBarang = isTrainBarang(train);
                  const isSelected = selectedTrainNo === train.train_number;

                  const statusBadgeClass = isStopped
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : isRunning
                      ? isBarang
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-sky-100 text-sky-800 border-sky-300'
                      : 'bg-slate-200 text-slate-600 border-slate-300';

                  return (
                    <div
                      key={train.train_number}
                      onClick={() => {
                        setSelectedTrainNo(train.train_number);
                        if (mapInstanceRef.current && train.lat && train.lng) {
                          mapInstanceRef.current.flyTo([train.lat, train.lng], 14, { animate: true });
                        }
                        if (window.innerWidth < 640) {
                          setShowMobileSidebar(false);
                        }
                      }}
                      className={`p-3 rounded-2xl bg-white border transition-all cursor-pointer shadow-sm hover:shadow-md ${
                        isSelected
                          ? 'border-sky-500 ring-2 ring-sky-300/50 bg-sky-50/40'
                          : 'border-slate-200 hover:border-sky-300'
                      }`}
                    >
                      {/* Top Row: KA No, Name, Status Badge */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-2 py-0.5 rounded-lg font-mono text-[11px] font-black bg-slate-900 text-white shrink-0">
                            {train.train_number}
                          </span>
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                            {train.name}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${statusBadgeClass}`}>
                          {isStopped ? 'Berhenti' : isRunning ? `${train.speed_kmh} km/j` : 'Standby'}
                        </span>
                      </div>

                      {/* Route Row */}
                      <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium py-1 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-semibold text-slate-800">{train.origin_name || '-'}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-800">{train.destination_name || '-'}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {train.departure_time} - {train.arrival_time}
                        </span>
                      </div>

                      {/* Activity Label Row */}
                      {train.activity_label && (
                        <div className="mt-1 text-[10px] text-sky-700 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span className="truncate">{train.activity_label}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── TABLE VIEW (Full Table) ───────────── */
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[480px]">
                    <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">No & Nama KA</th>
                        <th className="py-2.5 px-2">Rute</th>
                        <th className="py-2.5 px-2">Status</th>
                        <th className="py-2.5 px-2 text-right">Kecepatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedTrains.map((train) => {
                        const isStopped = train.status === 'stopped';
                        const isRunning = train.status === 'running';
                        const isSelected = selectedTrainNo === train.train_number;

                        return (
                          <tr
                            key={train.train_number}
                            onClick={() => {
                              setSelectedTrainNo(train.train_number);
                              if (mapInstanceRef.current && train.lat && train.lng) {
                                mapInstanceRef.current.flyTo([train.lat, train.lng], 13, { animate: true });
                              }
                              if (window.innerWidth < 640) {
                                setShowMobileSidebar(false);
                              }
                            }}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-sky-100/70 font-semibold' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-black bg-slate-900 text-white">
                                  {train.train_number}
                                </span>
                                <span className="font-bold text-slate-900 truncate max-w-[140px]">
                                  {train.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-[10px] text-slate-600">
                              <div className="flex items-center gap-1">
                                <span className="truncate max-w-[60px]">{train.origin_name || '-'}</span>
                                <ArrowRight className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[60px]">{train.destination_name || '-'}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                isStopped
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : isRunning
                                    ? 'bg-sky-100 text-sky-800 border-sky-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                {isStopped ? 'Berhenti' : isRunning ? 'Berjalan' : 'Standby'}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-800">
                              {train.speed_kmh} <span className="text-[9px] font-normal text-slate-500">km/j</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Selected Train Detail Modal / Drawer (Responsive Bottom Sheet on Mobile) ── */}
      {selectedTrain && (
        <div className="fixed sm:absolute z-50 sm:z-30 inset-x-2 bottom-4 sm:inset-x-auto sm:top-20 sm:right-4 sm:bottom-6 sm:w-96 max-h-[80vh] sm:max-h-none flex flex-col bg-[#f8fafc]/95 border border-slate-300/80 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-right-4 duration-200">
          {/* Header */}
          <div className={`p-3.5 border-b border-slate-200 flex items-center justify-between ${
            selectedTrain.status === 'stopped'
              ? 'bg-emerald-100/70'
              : isTrainBarang(selectedTrain)
                ? 'bg-rose-100/70'
                : isTrainLokal(selectedTrain)
                  ? 'bg-amber-100/70'
                  : 'bg-sky-100/60'
          }`}>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-mono font-black text-xs px-2 py-0.5 rounded text-white ${
                  selectedTrain.status === 'stopped'
                    ? 'bg-emerald-600'
                    : isTrainBarang(selectedTrain)
                      ? 'bg-rose-600'
                      : isTrainLokal(selectedTrain)
                        ? 'bg-amber-600'
                        : 'bg-sky-700'
                }`}>
                  KA {selectedTrain.train_number}
                </span>
                <span className="font-extrabold text-sm text-slate-900 truncate max-w-[170px]">
                  {selectedTrain.name}
                </span>
              </div>
              <div className="text-[10px] text-slate-600 mt-0.5">
                {selectedTrain.train_class} • {selectedTrain.category}
              </div>
            </div>

            <button
              onClick={() => setSelectedTrainNo(null)}
              className="p-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-slate-900 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-100/50 p-1">
            <button
              onClick={() => setActiveTabDrawer('info')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTabDrawer === 'info' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setActiveTabDrawer('schedule')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTabDrawer === 'schedule' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Jadwal
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-white">
            {activeTabDrawer === 'info' ? (
              <div className="space-y-3.5">
                {/* Speed Card (Real-Time Live Updating) */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Kecepatan Saat Ini</div>
                    <div className={`text-2xl font-black font-mono mt-0.5 ${
                      selectedTrain.status === 'stopped'
                        ? 'text-emerald-700'
                        : isTrainBarang(selectedTrain)
                          ? 'text-rose-700'
                          : isTrainLokal(selectedTrain)
                            ? 'text-amber-700'
                            : 'text-sky-800'
                    }`}>
                      {selectedTrain.speed_kmh} <span className="text-xs font-normal text-slate-500">km/jam</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Status Perjalanan</div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase mt-0.5 ${
                        selectedTrain.status === 'stopped'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : selectedTrain.status === 'running'
                            ? (isTrainBarang(selectedTrain) ? 'bg-rose-100 text-rose-800 border border-rose-200' : isTrainLokal(selectedTrain) ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-sky-100 text-sky-800 border border-sky-200')
                            : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {selectedTrain.status === 'running' ? 'Berjalan' : selectedTrain.status === 'stopped' ? 'Berhenti' : 'Belum Jalan'}
                    </span>
                  </div>
                </div>

                {/* Progress Bar (Real-Time Live Updating) */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-500">Progres Rute</span>
                    <span className={`font-mono font-bold ${
                      selectedTrain.status === 'stopped'
                        ? 'text-emerald-700'
                        : isTrainBarang(selectedTrain)
                          ? 'text-rose-700'
                          : isTrainLokal(selectedTrain)
                            ? 'text-amber-700'
                            : 'text-sky-800'
                    }`}>{selectedTrain.progress_percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        selectedTrain.status === 'stopped'
                          ? 'bg-gradient-to-r from-emerald-500 to-green-600'
                          : isTrainBarang(selectedTrain)
                            ? 'bg-gradient-to-r from-rose-500 to-red-600'
                            : isTrainLokal(selectedTrain)
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-500'
                              : 'bg-gradient-to-r from-sky-600 to-emerald-600'
                      }`}
                      style={{ width: `${selectedTrain.progress_percent}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-600 flex justify-between pt-0.5 font-medium">
                    <span>{selectedTrain.origin_name} ({selectedTrain.departure_time})</span>
                    <span>{selectedTrain.destination_name} ({selectedTrain.arrival_time})</span>
                  </div>
                </div>

                {/* Live Activity Label (Real-Time Live Updating) */}
                <div className={`p-3 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
                  selectedTrain.status === 'stopped'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : isTrainBarang(selectedTrain)
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : isTrainLokal(selectedTrain)
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-sky-50 border-sky-200 text-sky-900'
                }`}>
                  <Clock className={`w-4 h-4 shrink-0 ${
                    selectedTrain.status === 'stopped'
                      ? 'text-emerald-700'
                      : isTrainBarang(selectedTrain)
                        ? 'text-rose-700'
                        : isTrainLokal(selectedTrain)
                          ? 'text-amber-700'
                          : 'text-sky-700'
                  }`} />
                  <span>{selectedTrain.activity_label}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedTrain.schedules?.map((st: TrainScheduleStep, sIdx: number, arr: TrainScheduleStep[]) => {
                  const isLs = st.arr === 'Ls' || st.arr === 'ls';
                  const isTerminal = st.order === 1 || sIdx === arr.length - 1;

                  return (
                    <div key={sIdx} className="flex items-start gap-3 relative z-10">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                        isTerminal 
                          ? 'bg-sky-700 text-white border-white shadow-sm' 
                          : isLs 
                            ? 'bg-slate-100 text-slate-400 border-slate-300' 
                            : 'bg-white text-sky-800 border-sky-300 shadow-sm'
                      }`}>
                        {st.order}
                      </div>
                      <div className="flex-1 min-w-0 bg-slate-50 border border-slate-200/80 rounded-xl p-2 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span className="truncate">{st.name}</span>
                          <span className="font-mono text-[10px] text-slate-500">{st.code}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-3">
                          <span>Datang: <strong className="font-mono text-slate-700">{st.arr}</strong></span>
                          <span>Berangkat: <strong className="font-mono text-slate-700">{st.dep}</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Mandatory Auth Modal Gate ─────────────────────────────────── */}
      {!currentUser && !authChecking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="max-w-md w-full bg-[#f8fafc] border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-700 flex items-center justify-center shadow-lg shadow-sky-600/30 mx-auto">
                <Train className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                {authMode === 'login' ? 'Login ke Radar KA' : 'Daftar Akun Baru'}
              </h2>
              <p className="text-xs text-slate-500">
                {authMode === 'login'
                  ? 'Silakan masukkan Username dan PIN Anda untuk mengakses peta real-time.'
                  : 'Buat Username dan tentukan PIN angka Anda sendiri untuk akses penuh.'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    placeholder="Masukkan username"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                  <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  PIN Akses (4-6 Digit Angka)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={8}
                    value={authPin}
                    onChange={(e) => setAuthPin(e.target.value)}
                    placeholder="••••"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                  <Key className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-sm tracking-wide shadow-lg shadow-sky-700/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {authLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : authMode === 'login' ? (
                  <>
                    <Key className="w-4 h-4" />
                    <span>Masuk ke Radar KA</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Daftar & Masuk</span>
                  </>
                )}
              </button>
            </form>

            {/* Toggle Mode Login <-> Register */}
            <div className="text-center pt-2 border-t border-slate-200">
              {authMode === 'login' ? (
                <p className="text-xs text-slate-500">
                  Belum punya akun?{' '}
                  <button
                    onClick={() => {
                      setAuthMode('register');
                      setAuthError('');
                    }}
                    className="text-sky-700 font-bold hover:underline"
                  >
                    Daftar Sekarang
                  </button>
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Sudah memiliki akun?{' '}
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError('');
                    }}
                    className="text-sky-700 font-bold hover:underline"
                  >
                    Masuk ke Akun
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
