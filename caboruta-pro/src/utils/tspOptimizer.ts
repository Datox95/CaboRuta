import type { BasePoint, ClientStop, RouteMetrics } from '../types/route';

const EARTH_RADIUS_KM = 6371;
// Average urban road factor in Los Cabos relative to straight-line distance
const ROAD_TORTUOSITY_FACTOR = 1.32;
// Average urban collection speed in Los Cabos (km/h) + 5 min average stop dwell time
const AVG_DRIVING_SPEED_KMH = 34;
const STOP_DWELL_MINUTES = 5;
// Fuel consumption benchmark for field collection vehicle (10 km/L, $24.50 MXN/L)
const KM_PER_LITER = 10;
const FUEL_PRICE_MXN_PER_LITER = 24.5;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Builds an NxN distance matrix (km) where index 0 is BasePoint and 1..N are stops.
 */
export function buildHaversineMatrix(base: BasePoint, stops: Array<{ lat: number; lng: number }>): number[][] {
  const nodes = [{ lat: base.lat, lng: base.lng }, ...stops];
  const n = nodes.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = haversineKm(nodes[i].lat, nodes[i].lng, nodes[j].lat, nodes[j].lng) * ROAD_TORTUOSITY_FACTOR;
      matrix[i][j] = dist;
      matrix[j][i] = dist;
    }
  }
  return matrix;
}

export function calculateTourDistance(tourIndices: number[], matrix: number[][], returnToBase = true): number {
  if (tourIndices.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < tourIndices.length - 1; i++) {
    total += matrix[tourIndices[i]][tourIndices[i + 1]];
  }
  if (returnToBase && tourIndices.length > 1) {
    total += matrix[tourIndices[tourIndices.length - 1]][tourIndices[0]];
  }
  return total;
}

/**
 * Solves TSP starting and ending at node 0 (BasePoint) using Nearest Neighbor + 2-opt local improvement.
 * Returns ordered stop indices (1..N in the matrix, mapped back to 0..stops.length-1).
 */
export function solveTspNearestNeighbor2Opt(matrix: number[][], returnToBase = true): number[] {
  const n = matrix.length;
  if (n <= 1) return [];
  if (n === 2) return [0]; // only 1 stop

  // Step 1: Nearest Neighbor starting at node 0 (depot)
  const visited = new Set<number>([0]);
  const tour: number[] = [0];
  let current = 0;

  while (visited.size < n) {
    let bestNext = -1;
    let bestDist = Infinity;
    for (let candidate = 1; candidate < n; candidate++) {
      if (!visited.has(candidate) && matrix[current][candidate] < bestDist) {
        bestDist = matrix[current][candidate];
        bestNext = candidate;
      }
    }
    if (bestNext === -1) break;
    visited.add(bestNext);
    tour.push(bestNext);
    current = bestNext;
  }

  // Step 2: 2-opt iterative improvement (keeping node 0 fixed as start)
  let improved = true;
  let iterations = 0;
  const maxIterations = 250;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < tour.length - 1; i++) {
      for (let k = i + 1; k < tour.length; k++) {
        const a = tour[i - 1];
        const b = tour[i];
        const c = tour[k];
        const d = k + 1 < tour.length ? tour[k + 1] : returnToBase ? tour[0] : -1;

        const currentEdges = matrix[a][b] + (d !== -1 ? matrix[c][d] : 0);
        const swappedEdges = matrix[a][c] + (d !== -1 ? matrix[b][d] : 0);

        if (swappedEdges + 1e-6 < currentEdges) {
          // Reverse segment [i..k]
          let left = i;
          let right = k;
          while (left < right) {
            const tmp = tour[left];
            tour[left] = tour[right];
            tour[right] = tmp;
            left++;
            right--;
          }
          improved = true;
        }
      }
    }
  }

  // Return 0-based stop indices (excluding depot 0)
  return tour.slice(1).map((nodeIdx) => nodeIdx - 1);
}

/**
 * Assigns block indices if the user wants to split a large route into manageable daily/shift blocks.
 */
export function assignRouteBlocks(stops: ClientStop[], blockSize: number | null): ClientStop[] {
  if (!blockSize || blockSize <= 0) {
    return stops.map((stop, idx) => ({
      ...stop,
      visitOrder: idx + 1,
      blockIndex: 1,
    }));
  }

  return stops.map((stop, idx) => ({
    ...stop,
    visitOrder: idx + 1,
    blockIndex: Math.floor(idx / blockSize) + 1,
  }));
}

export function computeRouteMetrics(params: {
  allStops: ClientStop[];
  base: BasePoint;
  orderedStops: ClientStop[];
  osrmDistanceKm?: number | null;
  osrmDurationMin?: number | null;
}): RouteMetrics {
  const { allStops, base, orderedStops, osrmDistanceKm, osrmDurationMin } = params;

  const geocodedStops = orderedStops.filter(
    (s): s is ClientStop & { lat: number; lng: number } => s.lat !== null && s.lng !== null
  );

  let totalDistanceKm = 0;
  let unoptimizedDistanceKm = 0;

  if (geocodedStops.length > 0) {
    const orderedMatrix = buildHaversineMatrix(base, geocodedStops);
    const seqTour = [0, ...geocodedStops.map((_, i) => i + 1)];
    const estimatedOrderedKm = calculateTourDistance(seqTour, orderedMatrix, true);

    totalDistanceKm = osrmDistanceKm && osrmDistanceKm > 0 ? osrmDistanceKm : estimatedOrderedKm;

    // Naive baseline using original Excel order
    const originalSorted = [...geocodedStops].sort((a, b) => a.originalOrder - b.originalOrder);
    const origMatrix = buildHaversineMatrix(base, originalSorted);
    const origTour = [0, ...originalSorted.map((_, i) => i + 1)];
    const naiveEstimatedKm = calculateTourDistance(origTour, origMatrix, true);

    // Ensure unoptimized baseline reflects real road ratio if OSRM was used
    const ratio = estimatedOrderedKm > 0 ? totalDistanceKm / estimatedOrderedKm : 1;
    unoptimizedDistanceKm = Math.max(totalDistanceKm, naiveEstimatedKm * ratio);
  }

  const distanceSavedKm = Math.max(0, unoptimizedDistanceKm - totalDistanceKm);
  const drivingMinutes =
    osrmDurationMin && osrmDurationMin > 0
      ? osrmDurationMin
      : (totalDistanceKm / AVG_DRIVING_SPEED_KMH) * 60;
  const estimatedMinutes = Math.round(drivingMinutes + geocodedStops.length * STOP_DWELL_MINUTES);

  const fuelSavedLiters = distanceSavedKm / KM_PER_LITER;
  const fuelSavedMxn = fuelSavedLiters * FUEL_PRICE_MXN_PER_LITER;

  const collectedCount = allStops.filter((s) => s.status === 'collected').length;
  const promiseCount = allStops.filter((s) => s.status === 'promise').length;
  const notFoundCount = allStops.filter((s) => s.status === 'not_found').length;
  const pendingCount = allStops.filter((s) => s.status === 'pending').length;

  return {
    totalClients: allStops.length,
    geocodedCount: allStops.filter((s) => s.lat !== null && s.lng !== null).length,
    totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
    unoptimizedDistanceKm: Number(unoptimizedDistanceKm.toFixed(1)),
    distanceSavedKm: Number(distanceSavedKm.toFixed(1)),
    estimatedMinutes,
    fuelSavedLiters: Number(fuelSavedLiters.toFixed(1)),
    fuelSavedMxn: Math.round(fuelSavedMxn),
    collectedCount,
    promiseCount,
    notFoundCount,
    pendingCount,
  };
}
