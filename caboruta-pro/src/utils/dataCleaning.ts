import type { ClientStop, StopZone } from '../types/route';

/**
 * Strict geographical Bounding Box for Los Cabos (Cabo San Lucas <-> San José del Cabo)
 * Prevents Nominatim from matching duplicate street names in Tijuana, La Paz, or mainland Mexico.
 */
export const LOS_CABOS_BOUNDS = {
  minLat: 22.84,
  maxLat: 23.18,
  minLng: -110.05,
  maxLng: -109.62,
} as const;

export const DEFAULT_BASE_POINT = {
  label: 'Plaza Puerto Paraiso, Cabo San Lucas, Baja California Sur, 23479',
  lat: 22.88585,
  lng: -109.91145,
};

/**
 * Fixes common UTF-8 interpreted as Latin-1/Windows-1252 mojibake in Excel/CRM exports
 * e.g. "TelÃ©fono" -> "Teléfono", "San JosÃ© d" -> "San José d", "CÃ³digo" -> "Código".
 */
export function fixMojibake(input: string): string {
  if (!input) return '';
  const replacements: Array<[RegExp, string]> = [
    [/Ã¡/g, 'á'],
    [/Ã©/g, 'é'],
    [/Ã­/g, 'í'],
    [/Ã³/g, 'ó'],
    [/Ãº/g, 'ú'],
    [/Ã±/g, 'ñ'],
    [/Ã/g, 'Á'],
    [/Ã‰/g, 'É'],
    [/Ã/g, 'Í'],
    [/Ã“/g, 'Ó'],
    [/Ãš/g, 'Ú'],
    [/Ã‘/g, 'Ñ'],
    [/Ã¼/g, 'ü'],
    [/Ãœ/g, 'Ü'],
    [/Â°/g, '°'],
    [/Âº/g, 'º'],
    [/Âª/g, 'ª'],
    [/Â/g, ''],
    [/ï¿½/g, ''],
  ];

  let out = String(input);
  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/[ \u00A0]+/g, ' ').trim();
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Maps messy or encoding-corrupted Excel header names to canonical field keys.
 */
export function normalizeColumnKey(rawHeader: string): string {
  const repaired = fixMojibake(rawHeader);
  const clean = stripAccents(repaired).replace(/[^a-z0-9]/g, '');

  if (clean.includes('acreditado') || clean === 'cliente' || clean === 'nombre') return 'Acreditado';
  if (clean === 'calle' || clean.includes('direccion') || clean.includes('domicilio')) return 'Calle';
  if (clean.includes('numeroexterior') || clean === 'numext' || clean === 'noext' || clean === 'exterior') {
    return 'Numero Exterior';
  }
  if (clean.includes('numerointerior') || clean === 'numint' || clean === 'noint' || clean === 'interior') {
    return 'Numero Interior';
  }
  if (clean.includes('colonia') || clean === 'fraccionamiento' || clean === 'col') return 'Colonia';
  if (clean.includes('municipio') || clean.includes('delegacion')) return 'Municipio';
  if (clean.includes('ciudad') || clean.includes('localidad')) return 'Ciudad';
  if (clean.includes('estado') || clean.includes('entidad')) return 'Estado';
  if (clean.includes('codigopostal') || clean === 'cp' || clean === 'postal') return 'Codigo Postal';
  if (clean.includes('telefono') || clean === 'tel' || clean === 'celular' || clean === 'whatsapp') {
    return 'Teléfono';
  }
  return repaired;
}

export function cleanEstado(rawEstado: string): string {
  const fixed = fixMojibake(rawEstado);
  const lower = stripAccents(fixed);

  if (
    !lower ||
    lower.includes('baja calif') ||
    lower.includes('b.c.s') ||
    lower === 'bcs' ||
    lower.includes('sur')
  ) {
    return 'Baja California Sur, México';
  }
  return `${fixed}, México`;
}

export function cleanCiudad(rawCiudad: string, rawColonia = '', rawCp = ''): string {
  const fixed = fixMojibake(rawCiudad);
  const lower = stripAccents(fixed);

  if (
    lower.includes('san jose') ||
    lower.includes('sjc') ||
    lower === 'sj' ||
    /^san\s+jos/.test(lower)
  ) {
    return 'San José del Cabo';
  }

  if (
    lower.includes('cabo san lucas') ||
    lower.includes('csl') ||
    lower.includes('san lucas') ||
    /^cabo\s+s/.test(lower)
  ) {
    return 'Cabo San Lucas';
  }

  if (lower.includes('los cabos') || !lower) {
    const cpNum = parseInt(rawCp.replace(/\D/g, ''), 10);
    if (!Number.isNaN(cpNum)) {
      if (cpNum >= 23400 && cpNum <= 23449) return 'San José del Cabo';
      if (cpNum >= 23450 && cpNum <= 23479) return 'Cabo San Lucas';
    }
    const colLower = stripAccents(rawColonia);
    if (
      colLower.includes('zacatal') ||
      colLower.includes('santa rosa') ||
      colLower.includes('guaymitas') ||
      colLower.includes('san jose viejo') ||
      colLower.includes('magisterial') ||
      colLower.includes('vista hermosa')
    ) {
      return 'San José del Cabo';
    }
    return 'Cabo San Lucas';
  }

  return fixed;
}

export function isSinNombreStreet(calle: string): boolean {
  const clean = stripAccents(fixMojibake(calle)).replace(/[^a-z0-9\s]/g, '').trim();
  return (
    !clean ||
    clean === 'sin nombre' ||
    clean === 'sn' ||
    clean === 'sin calle' ||
    clean === 'conocido' ||
    clean === 'domicilio conocido' ||
    clean === 'na' ||
    clean === 'nd'
  );
}

export function cleanCodigoPostal(rawCp: string | number | undefined): string {
  const digits = String(rawCp ?? '').replace(/\D/g, '');
  if (digits.length === 5) return digits;
  if (digits.length === 4) return `0${digits}`;
  return digits.slice(0, 5);
}

/**
 * Formats Mexican phone numbers for WhatsApp (+52) and tel: links.
 */
export function normalizeMexicanPhone(rawPhone: string | number | undefined): {
  display: string;
  whatsappDigits: string;
  telHref: string;
} {
  const rawStr = fixMojibake(String(rawPhone ?? ''));
  const digits = rawStr.replace(/\D/g, '');

  if (!digits) {
    return { display: 'Sin teléfono', whatsappDigits: '', telHref: '' };
  }

  let normalized10 = digits;
  if (digits.length === 13 && digits.startsWith('521')) {
    normalized10 = digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith('52')) {
    normalized10 = digits.slice(2);
  } else if (digits.length > 10) {
    normalized10 = digits.slice(-10);
  }

  if (normalized10.length === 10) {
    const formatted = `+52 ${normalized10.slice(0, 3)} ${normalized10.slice(3, 6)} ${normalized10.slice(6)}`;
    return {
      display: formatted,
      whatsappDigits: `52${normalized10}`,
      telHref: `tel:+52${normalized10}`,
    };
  }

  return {
    display: rawStr || digits,
    whatsappDigits: digits.startsWith('52') ? digits : `52${digits}`,
    telHref: `tel:+${digits.startsWith('52') ? digits : `52${digits}`}`,
  };
}

export function classifyZone(ciudad: string, colonia: string, cp: string): StopZone {
  const cityLower = stripAccents(ciudad);
  const colLower = stripAccents(colonia);
  const cpNum = parseInt(cp, 10);

  if (colLower.includes('tezal') || colLower.includes('corredor') || colLower.includes('palmilla')) {
    // El Tezal is on the CSL side of the corridor; treat as CSL unless Palmilla/SJC
    if (colLower.includes('palmilla')) return 'sjc';
    return 'csl';
  }

  if (cityLower.includes('san jose')) return 'sjc';
  if (cityLower.includes('cabo san lucas')) return 'csl';

  if (!Number.isNaN(cpNum)) {
    if (cpNum >= 23400 && cpNum <= 23449) return 'sjc';
    if (cpNum >= 23450 && cpNum <= 23479) return 'csl';
  }

  return 'csl';
}

export function isWithinLosCabosBounds(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= LOS_CABOS_BOUNDS.minLat &&
    lat <= LOS_CABOS_BOUNDS.maxLat &&
    lng >= LOS_CABOS_BOUNDS.minLng &&
    lng <= LOS_CABOS_BOUNDS.maxLng
  );
}

/**
 * Builds ranked search queries for Nominatim.
 * When Calle is "SIN NOMBRE", prioritizes Colonia + Codigo Postal + Ciudad inside Los Cabos.
 */
export function buildGeocodeQueries(params: {
  calle: string;
  numeroExterior: string;
  colonia: string;
  ciudad: string;
  codigoPostal: string;
  isSinNombre: boolean;
}): string[] {
  const { calle, numeroExterior, colonia, ciudad, codigoPostal, isSinNombre } = params;
  const queries: string[] = [];
  const cpPart = codigoPostal ? `${codigoPostal}` : '';
  const statePart = 'Baja California Sur, México';

  if (isSinNombre) {
    if (colonia && cpPart) {
      queries.push(`Colonia ${colonia}, ${ciudad}, ${cpPart}, ${statePart}`);
      queries.push(`${colonia}, ${ciudad}, ${statePart}`);
    } else if (colonia) {
      queries.push(`Colonia ${colonia}, ${ciudad}, ${statePart}`);
      queries.push(`${colonia}, Los Cabos, ${statePart}`);
    }
    if (cpPart) {
      queries.push(`${cpPart}, ${ciudad}, ${statePart}`);
    }
    queries.push(`${ciudad}, Los Cabos, ${statePart}`);
  } else {
    const cleanNum = numeroExterior && !/^s\/?n$/i.test(numeroExterior) ? ` ${numeroExterior}` : '';
    const streetFull = `${calle}${cleanNum}`.trim();
    if (colonia && cpPart) {
      queries.push(`${streetFull}, ${colonia}, ${ciudad}, ${cpPart}, ${statePart}`);
    }
    if (colonia) {
      queries.push(`${streetFull}, ${colonia}, ${ciudad}, ${statePart}`);
    }
    queries.push(`${streetFull}, ${ciudad}, ${statePart}`);
    if (colonia) {
      queries.push(`${colonia}, ${ciudad}, ${statePart}`);
    }
    if (cpPart) {
      queries.push(`${cpPart}, ${ciudad}, ${statePart}`);
    }
  }

  return Array.from(new Set(queries.filter(Boolean)));
}

/**
 * Cleans and transforms raw parsed Excel/CSV row objects into normalized ClientStop entities.
 */
export function cleanExcelRows(
  rows: Array<Record<string, unknown>>,
  presetCoords?: Array<{ lat: number; lng: number; precision?: ClientStop['geocodePrecision'] }>
): ClientStop[] {
  const stops: ClientStop[] = [];

  rows.forEach((rawRow, index) => {
    const normalizedRow: Record<string, string> = {};
    const preservedRaw: Record<string, string | number | boolean | null | undefined> = {};

    for (const [key, value] of Object.entries(rawRow)) {
      const cleanKey = normalizeColumnKey(key);
      const valStr = value === null || value === undefined ? '' : fixMojibake(String(value));
      normalizedRow[cleanKey] = valStr;
      preservedRaw[fixMojibake(key)] =
        typeof value === 'string' ? fixMojibake(value) : (value as string | number | boolean | null | undefined);
    }

    const acreditado = normalizedRow['Acreditado'] || '';
    const calleRaw = normalizedRow['Calle'] || '';
    const colonia = normalizedRow['Colonia'] || '';

    // Skip completely empty trailing Excel rows
    if (!acreditado && !calleRaw && !colonia) {
      return;
    }

    const numeroExterior = normalizedRow['Numero Exterior'] || '';
    const numeroInterior = normalizedRow['Numero Interior'] || '';
    const municipio = fixMojibake(normalizedRow['Municipio'] || 'Los Cabos') || 'Los Cabos';
    const codigoPostal = cleanCodigoPostal(normalizedRow['Codigo Postal']);
    const ciudad = cleanCiudad(normalizedRow['Ciudad'] || '', colonia, codigoPostal);
    const estado = cleanEstado(normalizedRow['Estado'] || 'Baja California Sur');
    const phoneInfo = normalizeMexicanPhone(normalizedRow['Teléfono']);
    const sinNombre = isSinNombreStreet(calleRaw);

    const calleDisplay = sinNombre ? 'Calle SIN NOMBRE (ubicado por colonia)' : calleRaw;
    const numExtClean = numeroExterior && !/^s\/?n$/i.test(numeroExterior) ? ` #${numeroExterior}` : numeroExterior ? ' S/N' : '';
    const numIntClean = numeroInterior ? ` Int. ${numeroInterior}` : '';
    const cleanedAddress = [
      sinNombre ? `Col. ${colonia || 'Sin colonia'}` : `${calleRaw}${numExtClean}${numIntClean}`,
      !sinNombre && colonia ? `Col. ${colonia}` : '',
      ciudad,
      codigoPostal ? `C.P. ${codigoPostal}` : '',
      estado,
    ]
      .filter(Boolean)
      .join(', ');

    const searchQueries = buildGeocodeQueries({
      calle: calleRaw,
      numeroExterior,
      colonia,
      ciudad,
      codigoPostal,
      isSinNombre: sinNombre,
    });

    const preset = presetCoords?.[index];
    const hasValidPreset = preset && isWithinLosCabosBounds(preset.lat, preset.lng);

    stops.push({
      id: `stop-${index + 1}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      originalOrder: stops.length + 1,
      visitOrder: null,
      blockIndex: 1,
      acreditado: acreditado || `Cliente #${stops.length + 1}`,
      calle: calleDisplay,
      numeroExterior,
      numeroInterior,
      colonia: colonia || 'Centro',
      municipio,
      ciudad,
      estado,
      codigoPostal,
      telefono: phoneInfo.display,
      telefonoNormalizado: phoneInfo.whatsappDigits,
      isSinNombre: sinNombre,
      cleanedAddress,
      searchQueries,
      zone: classifyZone(ciudad, colonia, codigoPostal),
      lat: hasValidPreset ? preset.lat : null,
      lng: hasValidPreset ? preset.lng : null,
      geocodePrecision: hasValidPreset ? (preset.precision ?? 'exact') : null,
      status: 'pending',
      statusUpdatedAt: null,
      notes: '',
      rawRow: preservedRaw,
    });
  });

  return stops;
}
