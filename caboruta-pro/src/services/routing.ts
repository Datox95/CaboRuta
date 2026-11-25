import type { BasePoint, ClientStop, RouteGeometry } from '../types/route';

const OSRM_BASE_URL = 'https://router.project-osrm.org';

/**
 * Fetches an NxN real road distance matrix (in km) from OSRM Table API.
 * Returns null on timeout or error so the optimizer can cleanly fall back to Haversine.
 */
export async function fetchOsrmDistanceMatrix(
  points: Array<{ lat: number; lng: number }>
): Promise<number[][] | null> {
  if (points.length < 2 || points.length > 45) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const coordsStr = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const url = `${OSRM_BASE_URL}/table/v1/driving/${coordsStr}?annotations=distance`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      code?: string;
      distances?: Array<Array<number | null>>;
    };
    if (data.code !== 'Ok' || !Array.isArray(data.distances)) return null;

    // Convert meters -> km and guard against null cells
    return data.distances.map((row, i) =>
      row.map((val, j) => {
        if (i === j) return 0;
        if (typeof val === 'number' && Number.isFinite(val)) return val / 1000;
        return 9999;
      })
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface OsrmRouteResult {
  geometry: RouteGeometry;
  distanceKm: number | null;
  durationMinutes: number | null;
}

/**
 * Fetches the street-following route polyline, real road distance, and driving time via OSRM Route API.
 * Starts at BasePoint, visits orderedStops in sequence, and returns to BasePoint.
 */
export async function fetchOsrmRoute(
  base: BasePoint,
  orderedStops: ClientStop[]
): Promise<OsrmRouteResult> {
  const validStops = orderedStops.filter(
    (s): s is ClientStop & { lat: number; lng: number } => s.lat !== null && s.lng !== null
  );

  if (validStops.length === 0) {
    return {
      geometry: { coordinates: [], source: 'fallback' },
      distanceKm: 0,
      durationMinutes: 0,
    };
  }

  const waypoints: Array<{ lat: number; lng: number }> = [
    { lat: base.lat, lng: base.lng },
    ...validStops.map((s) => ({ lat: s.lat, lng: s.lng })),
    { lat: base.lat, lng: base.lng },
  ];

  const fallbackResult: OsrmRouteResult = {
    geometry: {
      coordinates: waypoints.map((p) => [p.lat, p.lng]),
      source: 'fallback',
    },
    distanceKm: null,
    durationMinutes: null,
  };

  // OSRM public URL stays reasonable under ~60 waypoints
  if (waypoints.length > 60) {
    return fallbackResult;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const coordsStr = waypoints.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const url = `${OSRM_BASE_URL}/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return fallbackResult;

    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates?: Array<[number, number]> };
      }>;
    };

    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route?.geometry?.coordinates?.length) {
      return fallbackResult;
    }

    const leafletCoords: [number, number][] = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    return {
      geometry: {
        coordinates: leafletCoords,
        source: 'osrm',
      },
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
    };
  } catch {
    return fallbackResult;
  } finally {
    clearTimeout(timer);
  }
}
