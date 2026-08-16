// Railway Track Graph & Path-Finding Engine
// Trains follow the actual connected OSM railway track (orange lines)
// Uses A* pathfinding between station pairs, cached for performance

import realWays from './real_osm_railway_tracks.json';

export interface Point2D {
  lat: number;
  lng: number;
}

// ─── Track Point Storage ─────────────────────────────────────────
interface TrackNode {
  lat: number;
  lng: number;
  neighbors: number[]; // indices of connected track nodes
}

const trackNodes: TrackNode[] = [];
const spatialGrid = new Map<string, number[]>(); // cell -> node indices

// Grid cell resolution: floor(coord * 40) → ~2.8km cells
function getCell(lat: number, lng: number): string {
  return `${Math.floor(lat * 40)}_${Math.floor(lng * 40)}`;
}

function addToGrid(lat: number, lng: number, idx: number) {
  const cell = getCell(lat, lng);
  if (!spatialGrid.has(cell)) spatialGrid.set(cell, []);
  spatialGrid.get(cell)!.push(idx);
}

// ─── Haversine Distance (meters) ────────────────────────────────
function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Cheap squared-degree distance for comparisons (no sqrt, no trig)
function sqDegDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  return dLat * dLat + dLng * dLng;
}

// ─── Build Graph from OSM Ways ──────────────────────────────────
// Each way is a polyline of [lat, lng] points. We deduplicate nearby points
// and create edges along each way. Then we connect way endpoints that are
// close together (< 150m) to form a connected graph.

const MERGE_THRESHOLD_SQ = 0.00015 * 0.00015; // ~15m in degrees squared
const ENDPOINT_CONNECT_DIST = 250; // meters (increased for better connectivity)

// Map for fast spatial dedup: cell -> [{ idx, lat, lng }]
const dedupGrid = new Map<string, { idx: number; lat: number; lng: number }[]>();

function findOrCreateNode(lat: number, lng: number): number {
  const cLat = Math.floor(lat * 40);
  const cLng = Math.floor(lng * 40);

  // Search 3x3 neighborhood for an existing very close node
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const cell = `${cLat + dx}_${cLng + dy}`;
      const entries = dedupGrid.get(cell);
      if (!entries) continue;
      for (const e of entries) {
        if (sqDegDist(e.lat, e.lng, lat, lng) < MERGE_THRESHOLD_SQ) {
          return e.idx;
        }
      }
    }
  }

  // Create new node
  const idx = trackNodes.length;
  trackNodes.push({ lat, lng, neighbors: [] });
  addToGrid(lat, lng, idx);

  const cell = getCell(lat, lng);
  if (!dedupGrid.has(cell)) dedupGrid.set(cell, []);
  dedupGrid.get(cell)!.push({ idx, lat, lng });

  return idx;
}

function addEdge(a: number, b: number) {
  if (a === b) return;
  if (!trackNodes[a].neighbors.includes(b)) trackNodes[a].neighbors.push(b);
  if (!trackNodes[b].neighbors.includes(a)) trackNodes[b].neighbors.push(a);
}

// Store way endpoints for inter-way connection
const wayEndpoints: number[] = [];

try {
  const ways = realWays as [number, number][][];

  // Phase 1: Create nodes and intra-way edges
  for (const w of ways) {
    if (w.length < 2) continue;

    let prevIdx = -1;
    for (let i = 0; i < w.length; i++) {
      const nodeIdx = findOrCreateNode(w[i][0], w[i][1]);
      if (prevIdx >= 0) {
        addEdge(prevIdx, nodeIdx);
      }
      if (i === 0 || i === w.length - 1) {
        wayEndpoints.push(nodeIdx);
      }
      prevIdx = nodeIdx;
    }
  }

  // Phase 2: Connect nearby way endpoints (different ways that should be joined)
  const epSet = new Set(wayEndpoints);
  const endpointArr = Array.from(epSet);

  for (let i = 0; i < endpointArr.length; i++) {
    const nodeA = trackNodes[endpointArr[i]];
    const cLat = Math.floor(nodeA.lat * 40);
    const cLng = Math.floor(nodeA.lng * 40);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = `${cLat + dx}_${cLng + dy}`;
        const indices = spatialGrid.get(cell);
        if (!indices) continue;

        for (const j of indices) {
          if (j === endpointArr[i]) continue;
          if (!epSet.has(j)) continue; // only connect endpoints
          const nodeB = trackNodes[j];
          const dist = haversineDist(nodeA.lat, nodeA.lng, nodeB.lat, nodeB.lng);
          if (dist < ENDPOINT_CONNECT_DIST) {
            addEdge(endpointArr[i], j);
          }
        }
      }
    }
  }

  console.log(`[Railway Graph] Built: ${trackNodes.length} nodes, ${wayEndpoints.length} endpoints`);
} catch (e) {
  console.error('Error building railway track graph:', e);
}

// ─── Snap to Nearest Track Node ─────────────────────────────────
export function snapToNearestRailTrack(lat: number, lng: number): [number, number] {
  const cLat = Math.floor(lat * 40);
  const cLng = Math.floor(lng * 40);
  let bestDist = Infinity;
  let bestPt: TrackNode | null = null;

  // Search 5x5 neighborhood for wider coverage
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const cell = `${cLat + dx}_${cLng + dy}`;
      const indices = spatialGrid.get(cell);
      if (!indices) continue;
      for (const i of indices) {
        const pt = trackNodes[i];
        const d = sqDegDist(pt.lat, pt.lng, lat, lng);
        if (d < bestDist) {
          bestDist = d;
          bestPt = pt;
        }
      }
    }
  }

  if (bestPt && Math.sqrt(bestDist) < 0.3) {
    return [bestPt.lat, bestPt.lng];
  }
  return [lat, lng];
}

// Find index of nearest track node
function findNearestNodeIdx(lat: number, lng: number): number {
  const cLat = Math.floor(lat * 40);
  const cLng = Math.floor(lng * 40);
  let bestDist = Infinity;
  let bestIdx = -1;

  // Search progressively wider if nothing in 3x3
  for (let radius = 1; radius <= 5; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const cell = `${cLat + dx}_${cLng + dy}`;
        const indices = spatialGrid.get(cell);
        if (!indices) continue;
        for (const i of indices) {
          const pt = trackNodes[i];
          const d = sqDegDist(pt.lat, pt.lng, lat, lng);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
      }
    }
    if (bestIdx >= 0) break;
  }

  return bestIdx;
}

// ─── A* Pathfinding Along Railway Graph ─────────────────────────
// Finds the shortest connected path of track nodes from station A to B

const pathCache = new Map<string, [number, number][]>();

function pathCacheKey(latA: number, lngA: number, latB: number, lngB: number): string {
  // Round to 4 decimal places for cache key stability
  return `${latA.toFixed(4)},${lngA.toFixed(4)}->${latB.toFixed(4)},${lngB.toFixed(4)}`;
}

export function findTrackPath(
  stationA: [number, number],
  stationB: [number, number]
): [number, number][] {
  const key = pathCacheKey(stationA[0], stationA[1], stationB[0], stationB[1]);
  const cached = pathCache.get(key);
  if (cached) return cached;

  const startIdx = findNearestNodeIdx(stationA[0], stationA[1]);
  const goalIdx = findNearestNodeIdx(stationB[0], stationB[1]);

  if (startIdx < 0 || goalIdx < 0) {
    // Fallback: straight line with snap
    const fallback: [number, number][] = [
      snapToNearestRailTrack(stationA[0], stationA[1]),
      snapToNearestRailTrack(stationB[0], stationB[1])
    ];
    pathCache.set(key, fallback);
    return fallback;
  }

  if (startIdx === goalIdx) {
    const pt = trackNodes[startIdx];
    const result: [number, number][] = [[pt.lat, pt.lng]];
    pathCache.set(key, result);
    return result;
  }

  // A* search
  const goalNode = trackNodes[goalIdx];
  const MAX_ITERATIONS = 25000; // safety limit (increased for longer routes)

  // Priority queue using a simple binary heap
  const openSet = new MinHeap();
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();

  gScore.set(startIdx, 0);
  const startH = haversineDist(trackNodes[startIdx].lat, trackNodes[startIdx].lng, goalNode.lat, goalNode.lng);
  openSet.push(startIdx, startH);

  let iterations = 0;
  let found = false;

  while (openSet.size() > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const current = openSet.pop()!;

    if (current === goalIdx) {
      found = true;
      break;
    }

    if (closed.has(current)) continue;
    closed.add(current);

    const currentNode = trackNodes[current];
    const currentG = gScore.get(current)!;

    for (const neighborIdx of currentNode.neighbors) {
      if (closed.has(neighborIdx)) continue;

      const neighborNode = trackNodes[neighborIdx];
      const edgeDist = haversineDist(currentNode.lat, currentNode.lng, neighborNode.lat, neighborNode.lng);
      const tentativeG = currentG + edgeDist;

      const prevG = gScore.get(neighborIdx);
      if (prevG !== undefined && tentativeG >= prevG) continue;

      gScore.set(neighborIdx, tentativeG);
      cameFrom.set(neighborIdx, current);

      const h = haversineDist(neighborNode.lat, neighborNode.lng, goalNode.lat, goalNode.lng);
      openSet.push(neighborIdx, tentativeG + h);
    }
  }

  if (found) {
    // Reconstruct path
    const pathIndices: number[] = [];
    let cur = goalIdx;
    while (cur !== undefined && cameFrom.has(cur)) {
      pathIndices.push(cur);
      cur = cameFrom.get(cur)!;
    }
    pathIndices.push(startIdx);
    pathIndices.reverse();

    // Simplify: remove points that are too close together (< 50m) to reduce memory
    const simplifiedPath: [number, number][] = [];
    let lastAdded: [number, number] | null = null;
    for (const idx of pathIndices) {
      const n = trackNodes[idx];
      const pt: [number, number] = [n.lat, n.lng];
      if (!lastAdded || haversineDist(lastAdded[0], lastAdded[1], pt[0], pt[1]) > 50 || idx === pathIndices[pathIndices.length - 1]) {
        simplifiedPath.push(pt);
        lastAdded = pt;
      }
    }

    pathCache.set(key, simplifiedPath);
    return simplifiedPath;
  }

  // Pathfinding failed — fallback: create densely-snapped intermediate waypoints
  // Instead of a straight line, generate many intermediate points and snap each
  // to the nearest track node. This makes the train follow nearby tracks.
  const snapA = snapToNearestRailTrack(stationA[0], stationA[1]);
  const snapB = snapToNearestRailTrack(stationB[0], stationB[1]);
  const dist = haversineDist(snapA[0], snapA[1], snapB[0], snapB[1]);
  // More waypoints for longer distances (1 per ~500m, min 10, max 60)
  const numSteps = Math.max(10, Math.min(60, Math.round(dist / 500)));
  const fallback: [number, number][] = [snapA];

  for (let s = 1; s < numSteps; s++) {
    const t = s / numSteps;
    const iLat = snapA[0] + (snapB[0] - snapA[0]) * t;
    const iLng = snapA[1] + (snapB[1] - snapA[1]) * t;
    const snapped = snapToNearestRailTrack(iLat, iLng);
    // Only add if meaningfully different from last point
    const last = fallback[fallback.length - 1];
    if (sqDegDist(snapped[0], snapped[1], last[0], last[1]) > 0.00001) {
      fallback.push(snapped);
    }
  }

  fallback.push(snapB);
  pathCache.set(key, fallback);
  return fallback;
}

// ─── Get Position Along Path ────────────────────────────────────
// Given a path (array of [lat,lng]) and a ratio (0-1), compute the
// exact interpolated position along that path.

export function getPositionAlongPath(
  path: [number, number][],
  ratio: number
): [number, number] {
  if (!path || path.length === 0) return [-6.1767, 106.8306];
  if (path.length === 1 || ratio <= 0) return path[0];
  if (ratio >= 1) return path[path.length - 1];

  // Compute cumulative distances
  const cumDist: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    const segLen = haversineDist(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
    cumDist.push(cumDist[i - 1] + segLen);
  }

  const totalDist = cumDist[cumDist.length - 1];
  if (totalDist < 1) return path[0]; // < 1 meter, just return start

  const targetDist = ratio * totalDist;

  // Binary search for segment
  let lo = 0, hi = path.length - 2;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumDist[mid + 1] < targetDist) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  const segStart = cumDist[lo];
  const segEnd = cumDist[lo + 1];
  const segLen = segEnd - segStart;
  const segRatio = segLen > 0 ? (targetDist - segStart) / segLen : 0;

  const lat = path[lo][0] + (path[lo + 1][0] - path[lo][0]) * segRatio;
  const lng = path[lo][1] + (path[lo + 1][1] - path[lo][1]) * segRatio;

  return [lat, lng];
}

// ─── Build Full Train Route Path & Exact Station Ratios ─────────
// Builds one continuous path along the track and records exact station vertex indices
export function buildTrainRoutePathAndRatios(
  stationCoords: [number, number][]
): { fullPath: [number, number][]; distanceRatios: number[] } {
  if (stationCoords.length === 0) return { fullPath: [], distanceRatios: [] };
  if (stationCoords.length === 1) return { fullPath: stationCoords, distanceRatios: [0] };

  const fullPath: [number, number][] = [];
  const stationIndices: number[] = [0];

  for (let i = 0; i < stationCoords.length - 1; i++) {
    const segPath = findTrackPath(stationCoords[i], stationCoords[i + 1]);
    if (i === 0) {
      fullPath.push(...segPath);
    } else {
      // Skip first point of segment to avoid duplication
      fullPath.push(...segPath.slice(1));
    }
    stationIndices.push(fullPath.length - 1);
  }

  // Compute cumulative distances along fullPath
  let totalDist = 0;
  const cumPathDist: number[] = [0];
  for (let i = 1; i < fullPath.length; i++) {
    totalDist += haversineDist(fullPath[i - 1][0], fullPath[i - 1][1], fullPath[i][0], fullPath[i][1]);
    cumPathDist.push(totalDist);
  }

  const distanceRatios: number[] = [];
  if (totalDist > 0) {
    for (const idx of stationIndices) {
      distanceRatios.push(cumPathDist[idx] / totalDist);
    }
  } else {
    for (let i = 0; i < stationCoords.length; i++) {
      distanceRatios.push(i / (stationCoords.length - 1));
    }
  }

  distanceRatios[0] = 0;
  distanceRatios[distanceRatios.length - 1] = 1;
  for (let i = 1; i < distanceRatios.length - 1; i++) {
    if (distanceRatios[i] <= distanceRatios[i - 1]) {
      distanceRatios[i] = distanceRatios[i - 1] + 0.0001;
    }
  }

  return { fullPath, distanceRatios };
}

export function buildTrainRoutePath(
  stationCoords: [number, number][]
): [number, number][] {
  return buildTrainRoutePathAndRatios(stationCoords).fullPath;
}

export function computeStationDistanceRatios(
  stationCoords: [number, number][],
  fullPath: [number, number][]
): number[] {
  return buildTrainRoutePathAndRatios(stationCoords).distanceRatios;
}

// ─── Legacy Compatibility ───────────────────────────────────────
// Keep getExactRailwayPosition for any code that still uses it,
// but now it properly uses pathfinding

export function getExactRailwayPosition(
  pA: [number, number],
  pB: [number, number],
  ratio: number
): [number, number] {
  const path = findTrackPath(pA, pB);
  return getPositionAlongPath(path, ratio);
}

// ─── MinHeap for A* ─────────────────────────────────────────────

class MinHeap {
  private heap: { idx: number; priority: number }[] = [];

  push(idx: number, priority: number) {
    this.heap.push({ idx, priority });
    this._bubbleUp(this.heap.length - 1);
  }

  pop(): number | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top.idx;
  }

  size(): number {
    return this.heap.length;
  }

  private _bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].priority <= this.heap[i].priority) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private _sinkDown(i: number) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.heap[l].priority < this.heap[smallest].priority) smallest = l;
      if (r < n && this.heap[r].priority < this.heap[smallest].priority) smallest = r;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

export { realWays };
