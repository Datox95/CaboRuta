import type { BasePoint, ClientStop, GeocodePrecision } from '../types/route';
import { LOS_CABOS_BOUNDS, isWithinLosCabosBounds } from '../utils/dataCleaning';

const GEOCODE_CACHE_KEY = 'geocode_cache';
const LEGACY_GEOCODE_CACHE_KEY = 'caboruta_geocode_cache_v1';

interface CachedLocation {
  lat: number;
  lng: number;
  precision: GeocodePrecision;
}

/**
 * Curated Los Cabos colonia centroids (Cabo San Lucas & San José del Cabo)
 * Used as a bounded fallback when street is "SIN NOMBRE" or Nominatim is unreachable/rate-limited.
 */
const LOS_CABOS_COLONIA_CENTROIDS: Array<{ match: string; lat: number; lng: number }> = [
  { match: 'puerto paraiso', lat: 22.88585, lng: -109.91145 },
  { match: 'el medano', lat: 22.8909, lng: -109.9036 },
  { match: 'medano', lat: 22.8909, lng: -109.9036 },
  { match: 'centro', lat: 22.8884, lng: -109.9154 },
  { match: 'pedregal', lat: 22.8812, lng: -109.9212 },
  { match: 'mesa colorada', lat: 22.9178, lng: -109.9395 },
  { match: 'cangrejos', lat: 22.9056, lng: -109.9482 },
  { match: 'las palmas', lat: 22.9094, lng: -109.9278 },
  { match: 'caribe', lat: 22.9142, lng: -109.9315 },
  { match: 'gastelum', lat: 22.9012, lng: -109.9195 },
  { match: 'el tezal', lat: 22.9022, lng: -109.8781 },
  { match: 'tezal', lat: 22.9022, lng: -109.8781 },
  { match: 'brisas del pacifico', lat: 22.9072, lng: -109.9225 },
  { match: 'arcos del sol', lat: 22.9108, lng: -109.9162 },
  { match: 'lomas del sol', lat: 22.9221, lng: -109.9345 },
  { match: 'jacarandas', lat: 22.8974, lng: -109.9167 },
  { match: 'mirador', lat: 22.9125, lng: -109.9242 },
  { match: 'chametla', lat: 23.0539, lng: -109.7042 },
  { match: 'zacatal', lat: 23.0764, lng: -109.7138 },
  { match: 'el zacatal', lat: 23.0764, lng: -109.7138 },
  { match: 'santa rosa', lat: 23.0798, lng: -109.7024 },
  { match: 'san jose viejo', lat: 23.0951, lng: -109.7082 },
  { match: 'vista hermosa', lat: 23.0846, lng: -109.7111 },
  { match: 'guaymitas', lat: 23.0688, lng: -109.7005 },
  { match: 'magisterial', lat: 23.0612, lng: -109.7031 },
  { match: 'rosarito', lat: 23.0504, lng: -109.7095 },
  { match: 'monte real', lat: 23.0725, lng: -109.7212 },
  { match: 'palmilla', lat: 23.0124, lng: -109.7165 },
  { match: 'las veredas', lat: 23.1128, lng: -109.7104 },
  { match: 'santa anita', lat: 23.1065, lng: -109.7185 },
];

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function loadCache(): Record<string, CachedLocation> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(GEOCODE_CACHE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, CachedLocation>;
    const legacy = window.localStorage.getItem(LEGACY_GEOCODE_CACHE_KEY);
    return legacy ? (JSON.parse(legacy) as Record<string, CachedLocation>) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CachedLocation>): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore quota errors
  }
}

async function queryNominatim(
  query: string
): Promise<{ lat: number; lng: number; networkOk: boolean } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);

  try {
    // viewbox = left(minLng),top(maxLat),right(maxLng),bottom(minLat)
    const viewbox = `${LOS_CABOS_BOUNDS.minLng},${LOS_CABOS_BOUNDS.maxLat},${LOS_CABOS_BOUNDS.maxLng},${LOS_CABOS_BOUNDS.minLat}`;
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2` +
      `&bounded=1&viewbox=${encodeURIComponent(viewbox)}` +
      `&countrycodes=mx&limit=1&q=${encodeURIComponent(query)}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;

    const lat = parseFloat(data[0].lat ?? '');
    const lng = parseFloat(data[0].lon ?? '');
    if (!isWithinLosCabosBounds(lat, lng)) {
      return null;
    }
    return { lat, lng, networkOk: true };
  } catch {
    return { lat: NaN, lng: NaN, networkOk: false };
  } finally {
    clearTimeout(timer);
  }
}

function resolveColoniaFallback(stop: ClientStop): CachedLocation {
  const colNorm = stripAccents(stop.colonia);
  const cityNorm = stripAccents(stop.ciudad);

  // Special handling for Centro in San José del Cabo vs Cabo San Lucas
  if (colNorm === 'centro' && cityNorm.includes('san jose')) {
    return {
      lat: 23.0623 + ((stop.originalOrder % 5) - 2) * 0.0006,
      lng: -109.6968 + (((stop.originalOrder * 3) % 5) - 2) * 0.0006,
      precision: 'colonia',
    };
  }

  for (const entry of LOS_CABOS_COLONIA_CENTROIDS) {
    if (colNorm.includes(entry.match) || entry.match.includes(colNorm)) {
      // Tiny deterministic offset so multiple SIN NOMBRE stops in the same colonia stay clickable
      const latOffset = ((stop.originalOrder % 5) - 2) * 0.0007;
      const lngOffset = (((stop.originalOrder * 7) % 5) - 2) * 0.0007;
      return {
        lat: entry.lat + latOffset,
        lng: entry.lng + lngOffset,
        precision: stop.isSinNombre ? 'colonia' : 'fallback',
      };
    }
  }

  // City-level fallback within Los Cabos
  const isSjc = stop.zone === 'sjc';
  const baseLat = isSjc ? 23.0635 : 22.8935;
  const baseLng = isSjc ? -109.7015 : -109.9185;
  return {
    lat: baseLat + ((stop.originalOrder % 7) - 3) * 0.0012,
    lng: baseLng + (((stop.originalOrder * 3) % 7) - 3) * 0.0012,
    precision: 'fallback',
  };
}

export function cacheStopCoordinates(stop: ClientStop, lat: number, lng: number, precision: GeocodePrecision): void {
  if (!isWithinLosCabosBounds(lat, lng)) return;
  const cache = loadCache();
  const payload: CachedLocation = { lat, lng, precision };
  const addrKey = stop.cleanedAddress.toLowerCase();
  const queryKey = stop.searchQueries[0]?.toLowerCase();
  if (addrKey) cache[addrKey] = payload;
  if (queryKey) cache[queryKey] = payload;
  saveCache(cache);
}

export async function geocodeBasePoint(addressLabel: string): Promise<BasePoint> {
  const cleanLabel = addressLabel.trim();
  if (/puerto paraiso/i.test(cleanLabel)) {
    return {
      label: cleanLabel,
      lat: 22.88585,
      lng: -109.91145,
    };
  }

  const cache = loadCache();
  const cacheKey = `base:${cleanLabel.toLowerCase()}`;
  if (cache[cacheKey] && isWithinLosCabosBounds(cache[cacheKey].lat, cache[cacheKey].lng)) {
    return { label: cleanLabel, lat: cache[cacheKey].lat, lng: cache[cacheKey].lng };
  }

  const hit = await queryNominatim(`${cleanLabel}, Los Cabos, Baja California Sur, México`);
  if (hit && hit.networkOk && isWithinLosCabosBounds(hit.lat, hit.lng)) {
    cache[cacheKey] = { lat: hit.lat, lng: hit.lng, precision: 'exact' };
    saveCache(cache);
    return { label: cleanLabel, lat: hit.lat, lng: hit.lng };
  }

  // Default Plaza Puerto Paraíso coordinates if Nominatim fails
  return {
    label: cleanLabel,
    lat: 22.88585,
    lng: -109.91145,
  };
}

export async function geocodeStopsBatch(
  stops: ClientStop[],
  onProgress?: (completed: number, total: number) => void
): Promise<ClientStop[]> {
  const cache = loadCache();
  const updated: ClientStop[] = [];
  let nominatimReachable = true;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const queryKey = stop.searchQueries[0]?.toLowerCase() || stop.cleanedAddress.toLowerCase();
    const addrKey = stop.cleanedAddress.toLowerCase();

    // Skip if already geocoded or manually adjusted by dragging pin
    if (stop.lat !== null && stop.lng !== null && isWithinLosCabosBounds(stop.lat, stop.lng)) {
      cache[queryKey] = { lat: stop.lat, lng: stop.lng, precision: stop.geocodePrecision ?? 'exact' };
      cache[addrKey] = cache[queryKey];
      updated.push(stop);
      onProgress?.(i + 1, stops.length);
      continue;
    }

    const cachedHit = cache[addrKey] || cache[queryKey];
    if (cachedHit && isWithinLosCabosBounds(cachedHit.lat, cachedHit.lng)) {
      updated.push({
        ...stop,
        lat: cachedHit.lat,
        lng: cachedHit.lng,
        geocodePrecision: cachedHit.precision,
      });
      onProgress?.(i + 1, stops.length);
      continue;
    }

    let resolved: CachedLocation | null = null;
    if (nominatimReachable) {
      const maxQueries = Math.min(2, stop.searchQueries.length);
      for (let qIdx = 0; qIdx < maxQueries; qIdx++) {
        const q = stop.searchQueries[qIdx];
        const hit = await queryNominatim(q);
        if (hit && !hit.networkOk) {
          nominatimReachable = false;
          break;
        }
        if (hit && hit.networkOk && isWithinLosCabosBounds(hit.lat, hit.lng)) {
          const precision: GeocodePrecision =
            stop.isSinNombre || qIdx >= 1 ? 'colonia' : 'exact';
          resolved = { lat: hit.lat, lng: hit.lng, precision };
          break;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    if (!resolved) {
      resolved = resolveColoniaFallback(stop);
    }

    cache[queryKey] = resolved;
    cache[addrKey] = resolved;
    updated.push({
      ...stop,
      lat: resolved.lat,
      lng: resolved.lng,
      geocodePrecision: resolved.precision,
    });
    onProgress?.(i + 1, stops.length);

    if (nominatimReachable && i < stops.length - 1) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  saveCache(cache);
  return updated;
}
