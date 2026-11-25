import type { BasePoint, ClientStop, GeocodePrecision, VisitStatus } from '../types/route';
import {
  buildGeocodeQueries,
  classifyZone,
  cleanCiudad,
  cleanEstado,
  isSinNombreStreet,
  isWithinLosCabosBounds,
  normalizeMexicanPhone,
} from './dataCleaning';

declare global {
  interface Window {
    LZString?: {
      compressToEncodedURIComponent: (input: string) => string;
      decompressFromEncodedURIComponent: (compressed: string) => string | null;
    };
  }
}

type CompactStopTuple = [
  string, // 0: acreditado
  string, // 1: calle
  string, // 2: numeroExterior
  string, // 3: numeroInterior
  string, // 4: colonia
  string, // 5: ciudad
  string, // 6: codigoPostal
  string, // 7: telefono
  number | null, // 8: lat
  number | null, // 9: lng
  VisitStatus, // 10: status
  string, // 11: notes
  number | null, // 12: visitOrder
  number, // 13: blockIndex
  GeocodePrecision | null, // 14: geocodePrecision
];

interface CompactRoutePayload {
  v: 1;
  b: [string, number, number]; // [label, lat, lng]
  o: 0 | 1; // isOptimized
  s: CompactStopTuple[];
}

export interface RouteTransferState {
  basePoint: BasePoint;
  stops: ClientStop[];
  isOptimized: boolean;
  exportedAt?: string;
}

function encodeUtf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64UrlToUtf8(b64Url: string): string {
  const padded = b64Url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64Url.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function toCompactPayload(state: RouteTransferState): CompactRoutePayload {
  return {
    v: 1,
    b: [state.basePoint.label, Number(state.basePoint.lat.toFixed(6)), Number(state.basePoint.lng.toFixed(6))],
    o: state.isOptimized ? 1 : 0,
    s: state.stops.map((stop) => [
      stop.acreditado,
      stop.calle,
      stop.numeroExterior,
      stop.numeroInterior,
      stop.colonia,
      stop.ciudad,
      stop.codigoPostal,
      stop.telefono,
      stop.lat !== null ? Number(stop.lat.toFixed(6)) : null,
      stop.lng !== null ? Number(stop.lng.toFixed(6)) : null,
      stop.status,
      stop.notes,
      stop.visitOrder,
      stop.blockIndex,
      stop.geocodePrecision,
    ]),
  };
}

function fromCompactPayload(payload: CompactRoutePayload): RouteTransferState {
  const basePoint: BasePoint = {
    label: payload.b[0],
    lat: payload.b[1],
    lng: payload.b[2],
  };

  const stops: ClientStop[] = payload.s.map((t, idx) => {
    const acreditado = t[0] || `Cliente #${idx + 1}`;
    const calleDisplay = t[1] || 'SIN NOMBRE';
    const numeroExterior = t[2] || '';
    const numeroInterior = t[3] || '';
    const colonia = t[4] || 'Centro';
    const ciudad = cleanCiudad(t[5] || '', colonia, t[6] || '');
    const codigoPostal = t[6] || '';
    const estado = cleanEstado('Baja California Sur');
    const phoneInfo = normalizeMexicanPhone(t[7]);
    const sinNombre = isSinNombreStreet(calleDisplay) || /sin\s+nombre/i.test(calleDisplay);
    const rawCalle = sinNombre ? 'SIN NOMBRE' : calleDisplay;

    const numExtClean =
      numeroExterior && !/^s\/?n$/i.test(numeroExterior)
        ? ` #${numeroExterior}`
        : numeroExterior
        ? ' S/N'
        : '';
    const numIntClean = numeroInterior ? ` Int. ${numeroInterior}` : '';
    const cleanedAddress = [
      sinNombre ? `Col. ${colonia}` : `${rawCalle}${numExtClean}${numIntClean}`,
      !sinNombre && colonia ? `Col. ${colonia}` : '',
      ciudad,
      codigoPostal ? `C.P. ${codigoPostal}` : '',
      estado,
    ]
      .filter(Boolean)
      .join(', ');

    const lat = typeof t[8] === 'number' && isWithinLosCabosBounds(t[8], t[9] ?? NaN) ? t[8] : null;
    const lng = typeof t[9] === 'number' && isWithinLosCabosBounds(lat ?? NaN, t[9]) ? t[9] : null;

    return {
      id: `stop-rx-${idx + 1}-${Date.now().toString(36)}`,
      originalOrder: idx + 1,
      visitOrder: t[12] ?? idx + 1,
      blockIndex: t[13] || 1,
      acreditado,
      calle: calleDisplay,
      numeroExterior,
      numeroInterior,
      colonia,
      municipio: 'Los Cabos',
      ciudad,
      estado,
      codigoPostal,
      telefono: phoneInfo.display,
      telefonoNormalizado: phoneInfo.whatsappDigits,
      isSinNombre: sinNombre,
      cleanedAddress,
      searchQueries: buildGeocodeQueries({
        calle: rawCalle,
        numeroExterior,
        colonia,
        ciudad,
        codigoPostal,
        isSinNombre: sinNombre,
      }),
      zone: classifyZone(ciudad, colonia, codigoPostal),
      lat,
      lng,
      geocodePrecision: t[14] ?? (lat !== null ? 'exact' : null),
      status: t[10] || 'pending',
      statusUpdatedAt: null,
      notes: t[11] || '',
      rawRow: {
        Acreditado: acreditado,
        Calle: calleDisplay,
        'Numero Exterior': numeroExterior,
        'Numero Interior': numeroInterior,
        Colonia: colonia,
        Municipio: 'Los Cabos',
        Ciudad: ciudad,
        Estado: estado,
        'Codigo Postal': codigoPostal,
        Teléfono: phoneInfo.display,
      },
    };
  });

  return {
    basePoint,
    stops,
    isOptimized: payload.o === 1,
  };
}

/**
 * Compresses the active route into a URL-safe string using LZString (when CDN loaded)
 * with a deterministic UTF-8 Base64URL fallback.
 */
export function encodeRouteToHashParam(state: RouteTransferState): string {
  const json = JSON.stringify(toCompactPayload(state));
  if (typeof window !== 'undefined' && window.LZString?.compressToEncodedURIComponent) {
    return `lz.${window.LZString.compressToEncodedURIComponent(json)}`;
  }
  return `b64.${encodeUtf8ToBase64Url(json)}`;
}

/**
 * Decodes a `#ruta=...` URL hash back into BasePoint + ClientStop[].
 */
export function decodeRouteFromHash(hashOrParam: string): RouteTransferState | null {
  try {
    const trimmed = hashOrParam.trim();
    if (!trimmed) return null;

    let token = trimmed;
    if (token.startsWith('#')) token = token.slice(1);
    if (token.includes('ruta=')) {
      const idx = token.indexOf('ruta=');
      token = token.slice(idx + 5).split('&')[0];
    }
    if (!token) return null;

    let jsonStr: string | null = null;
    if (token.startsWith('lz.')) {
      const body = token.slice(3);
      if (typeof window !== 'undefined' && window.LZString?.decompressFromEncodedURIComponent) {
        jsonStr = window.LZString.decompressFromEncodedURIComponent(body);
      }
    } else if (token.startsWith('b64.')) {
      jsonStr = decodeBase64UrlToUtf8(token.slice(4));
    } else {
      // Try LZString then Base64URL
      if (typeof window !== 'undefined' && window.LZString?.decompressFromEncodedURIComponent) {
        jsonStr = window.LZString.decompressFromEncodedURIComponent(token);
      }
      if (!jsonStr) {
        jsonStr = decodeBase64UrlToUtf8(token);
      }
    }

    if (!jsonStr) return null;
    const parsed = JSON.parse(jsonStr) as CompactRoutePayload;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.s)) return null;
    return fromCompactPayload(parsed);
  } catch {
    return null;
  }
}

export function buildRouteShareUrl(state: RouteTransferState): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const encoded = encodeRouteToHashParam(state);
  return `${origin}${pathname}#ruta=${encoded}`;
}

export function buildRouteBackupJson(state: RouteTransferState): string {
  return JSON.stringify(
    {
      app: 'CaboRuta Pro',
      version: 1,
      exportedAt: new Date().toISOString(),
      basePoint: state.basePoint,
      isOptimized: state.isOptimized,
      stops: state.stops,
    },
    null,
    2
  );
}

export function parseRouteBackupJson(jsonText: string): RouteTransferState | null {
  try {
    const parsed = JSON.parse(jsonText) as Partial<RouteTransferState>;
    if (!parsed || !parsed.basePoint || !Array.isArray(parsed.stops)) {
      return null;
    }
    return {
      basePoint: parsed.basePoint,
      stops: parsed.stops,
      isOptimized: Boolean(parsed.isOptimized),
      exportedAt: parsed.exportedAt,
    };
  } catch {
    return null;
  }
}
