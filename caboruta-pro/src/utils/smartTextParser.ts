import type { ClientStop } from '../types/route';
import {
  cleanCiudad,
  cleanCodigoPostal,
  cleanEstado,
  cleanExcelRows,
  fixMojibake,
  isSinNombreStreet,
  normalizeMexicanPhone,
} from './dataCleaning';

export interface ParsedClientDraft {
  id: string;
  acreditado: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  colonia: string;
  ciudad: string;
  estado: string;
  codigoPostal: string;
  telefono: string;
  rawLine: string;
}

const KNOWN_LOS_CABOS_COLONIAS: Array<{ pattern: RegExp; canonical: string; defaultCity: string }> = [
  { pattern: /\b(?:el\s+)?m[eé]dano\b/i, canonical: 'El Médano', defaultCity: 'Cabo San Lucas' },
  { pattern: /\bmesa\s+colorada\b/i, canonical: 'Mesa Colorada', defaultCity: 'Cabo San Lucas' },
  { pattern: /\bcangrejos\b/i, canonical: 'Cangrejos', defaultCity: 'Cabo San Lucas' },
  { pattern: /\blas\s+palmas\b/i, canonical: 'Las Palmas', defaultCity: 'Cabo San Lucas' },
  { pattern: /\bcaribe\b/i, canonical: 'Caribe', defaultCity: 'Cabo San Lucas' },
  { pattern: /\bgast[eé]lum\b/i, canonical: 'Gastélum', defaultCity: 'Cabo San Lucas' },
  { pattern: /\b(?:el\s+)?tezal\b/i, canonical: 'El Tezal', defaultCity: 'Cabo San Lucas' },
  { pattern: /\bbrisas\s+del\s+pac[ií]fico\b/i, canonical: 'Brisas del Pacífico', defaultCity: 'Cabo San Lucas' },
  { pattern: /\barcos\s+del\s+sol\b/i, canonical: 'Arcos del Sol', defaultCity: 'Cabo San Lucas' },
  { pattern: /\blomas\s+del\s+sol\b/i, canonical: 'Lomas del Sol', defaultCity: 'Cabo San Lucas' },
  { pattern: /\bjacarandas\b/i, canonical: 'Jacarandas', defaultCity: 'Cabo San Lucas' },
  { pattern: /\bmirador\b/i, canonical: 'Mirador', defaultCity: 'Cabo San Lucas' },
  { pattern: /\bpedregal\b/i, canonical: 'Pedregal', defaultCity: 'Cabo San Lucas' },
  { pattern: /\bchula\s+vista\b/i, canonical: 'Chula Vista', defaultCity: 'Cabo San Lucas' },
  { pattern: /\bchametla\b/i, canonical: 'Chametla', defaultCity: 'San José del Cabo' },
  { pattern: /\b(?:el\s+)?zacatal\b/i, canonical: 'Zacatal', defaultCity: 'San José del Cabo' },
  { pattern: /\bsanta\s+rosa\b/i, canonical: 'Santa Rosa', defaultCity: 'San José del Cabo' },
  { pattern: /\bsan\s+jos[eé]\s+viejo\b/i, canonical: 'San José Viejo', defaultCity: 'San José del Cabo' },
  { pattern: /\bvista\s+hermosa\b/i, canonical: 'Vista Hermosa', defaultCity: 'San José del Cabo' },
  { pattern: /\bguaymitas\b/i, canonical: 'Guaymitas', defaultCity: 'San José del Cabo' },
  { pattern: /\bmagisterial\b/i, canonical: 'Magisterial', defaultCity: 'San José del Cabo' },
  { pattern: /\b(?:el\s+)?rosarito\b/i, canonical: 'El Rosarito', defaultCity: 'San José del Cabo' },
  { pattern: /\bmonte\s+real\b/i, canonical: 'Monte Real', defaultCity: 'San José del Cabo' },
  { pattern: /\bpalmilla\b/i, canonical: 'Palmilla', defaultCity: 'San José del Cabo' },
  { pattern: /\blas\s+veredas\b/i, canonical: 'Las Veredas', defaultCity: 'San José del Cabo' },
  { pattern: /\bsanta\s+anita\b/i, canonical: 'Santa Anita', defaultCity: 'San José del Cabo' },
  { pattern: /\bcentro\b/i, canonical: 'Centro', defaultCity: '' },
];

// Matches start of street / local lot nomenclature / address markers
const ADDRESS_START_REGEX =
  /\b(calle|c\.|av\.?|avenida|blvd\.?|bulevar|boulevard|andador|retorno|cerrada|privada|camino|carretera|carr\.?|prolongaci[oó]n|prol\.?|callej[oó]n|paseo|sin\s+nombre|s\/n|sn|mza\.?|mz\.?|manzana|m\s*\d+|lte\.?|lt\.?|lote|l\s*\d+|coto|ed\.?|edificio|casa|depto\.?|departamento|col\.?|colonia|fracc\.?|fraccionamiento)\b/i;

const LOT_BLOCK_REGEX =
  /\b(?:mza\.?|mz\.?|manzana|m)\s*[-:#.]?\s*([a-z0-9]+)|\b(?:lte\.?|lt\.?|lote|l)\s*[-:#.]?\s*([a-z0-9]+)|\b(?:coto|ed\.?|edificio|casa|depto\.?|int\.?)\s*[-:#.]?\s*([a-z0-9]+)/gi;

function extractPhone(text: string): { phone: string; remaining: string } {
  // Match optional +52/521 prefix followed by 10 digits with optional spaces/dashes/parens
  const phoneRegex = /(?:\+?52\s*1?\s*[-.]?\s*)?(?:\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|\b\d{10}\b)/g;
  const matches = text.match(phoneRegex);
  if (!matches || matches.length === 0) {
    return { phone: '', remaining: text };
  }

  // Prefer 624 area code (Los Cabos) if multiple matches exist
  const picked = matches.find((m) => m.replace(/\D/g, '').includes('624')) || matches[0];
  const digits = picked.replace(/\D/g, '');
  if (digits.length < 10) {
    return { phone: '', remaining: text };
  }

  const remaining = text
    .replace(picked, ' ')
    .replace(/\b(?:tel[eé]fono|tel|cel|celular|whatsapp|wa)\.?\s*[:#-]?\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    phone: normalizeMexicanPhone(picked).display,
    remaining,
  };
}

function extractPostalCode(text: string): { cp: string; remaining: string } {
  // Prioritize Los Cabos 234xx postal codes
  const losCabosCp = text.match(/(?:\b(?:c\.?\s*p\.?|c[oó]digo\s+postal)\s*[:#-]?\s*)?\b(234\d{2})\b/i);
  if (losCabosCp) {
    const cp = cleanCodigoPostal(losCabosCp[1]);
    const remaining = text.replace(losCabosCp[0], ' ').replace(/\s+/g, ' ').trim();
    return { cp, remaining };
  }

  const explicitCp = text.match(/\b(?:c\.?\s*p\.?|c[oó]digo\s+postal)\s*[:#-]?\s*(\d{5})\b/i);
  if (explicitCp) {
    const cp = cleanCodigoPostal(explicitCp[1]);
    const remaining = text.replace(explicitCp[0], ' ').replace(/\s+/g, ' ').trim();
    return { cp, remaining };
  }

  return { cp: '', remaining: text };
}

function extractCityAndState(text: string): {
  ciudadRaw: string;
  estadoRaw: string;
  remaining: string;
} {
  let out = text;
  let ciudadRaw = '';
  let estadoRaw = '';

  const statePatterns = [
    /\bbaja\s+california\s+sur\b,?\s*(?:m[eé]xico)?/i,
    /\bbaja\s+calif(?:orn(?:ia)?)?\.?\s*(?:s\.?)?\b,?\s*(?:m[eé]xico)?/i,
    /\bb\.?\s*c\.?\s*s\.?\b/i,
    /\bm[eé]xico\b/i,
  ];
  for (const pat of statePatterns) {
    const m = out.match(pat);
    if (m) {
      estadoRaw = m[0];
      out = out.replace(pat, ' ');
    }
  }

  const cityPatterns = [
    /\bsan\s+jos[eé]\s+del\s+cabo\b/i,
    /\bsan\s+jos[eé]\s+d(?:el)?\b/i,
    /\bsjc\b/i,
    /\bcabo\s+san\s+lucas\b/i,
    /\bcabo\s+s\.?\s*l\.?\b/i,
    /\bcsl\b/i,
    /\blos\s+cabos\b/i,
  ];
  for (const pat of cityPatterns) {
    const m = out.match(pat);
    if (m) {
      ciudadRaw = m[0];
      out = out.replace(pat, ' ');
      break;
    }
  }

  return {
    ciudadRaw,
    estadoRaw,
    remaining: out.replace(/\s+/g, ' ').trim(),
  };
}

function extractColonia(text: string): {
  colonia: string;
  inferredCity: string;
  remaining: string;
} {
  let out = text;

  // Explicit "Col. XYZ" or "Colonia XYZ" or "Fracc. XYZ"
  const explicitMatch = out.match(
    /\b(?:colonia|col\.?|fraccionamiento|fracc\.?)\s+([a-záéíóúñü0-9\s.'-]+?)(?=,|;|\||$|\b(?:c\.?\s*p\.?|san\s+jos|cabo|los\s+cabos|baja|bcs)\b)/i
  );
  if (explicitMatch) {
    const colonia = explicitMatch[1].trim().replace(/[.,;]+$/, '');
    const remaining = out.replace(explicitMatch[0], ' ').replace(/\s+/g, ' ').trim();
    let inferredCity = '';
    for (const k of KNOWN_LOS_CABOS_COLONIAS) {
      if (k.pattern.test(colonia) && k.defaultCity) {
        inferredCity = k.defaultCity;
        break;
      }
    }
    return { colonia, inferredCity, remaining };
  }

  // Known Los Cabos colonias without explicit "Col." prefix
  for (const entry of KNOWN_LOS_CABOS_COLONIAS) {
    const m = out.match(entry.pattern);
    if (m) {
      const remaining = out.replace(entry.pattern, ' ').replace(/\s+/g, ' ').trim();
      return {
        colonia: entry.canonical,
        inferredCity: entry.defaultCity,
        remaining,
      };
    }
  }

  return { colonia: '', inferredCity: '', remaining: out };
}

function extractStreetDetails(addressText: string): {
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
} {
  let cleaned = addressText
    .replace(/^[,;|/\-.\s]+|[,;|/\-.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return { calle: 'SIN NOMBRE', numeroExterior: '', numeroInterior: '' };
  }

  if (isSinNombreStreet(cleaned) || /\bsin\s+nombre\b/i.test(cleaned)) {
    // Check if there are MZA/LTE details alongside SIN NOMBRE
    const lotTokens = cleaned.match(LOT_BLOCK_REGEX);
    const interior = lotTokens ? lotTokens.join(' ').trim() : '';
    return {
      calle: 'SIN NOMBRE',
      numeroExterior: /\bs\/?n\b/i.test(cleaned) ? 'S/N' : '',
      numeroInterior: interior,
    };
  }

  // Extract explicit Interior (Int. B, Depto 3, Coto 2 Casa 5, Mza/Lte)
  let numeroInterior = '';
  const intMatch = cleaned.match(/\b(?:int\.?|interior|depto\.?|departamento|casa|coto|ed\.?|edificio)\s*[-:#.]?\s*([a-z0-9-]+(?:\s+(?:casa|depto|lte|lt)\s*[a-z0-9-]+)?)/i);
  if (intMatch) {
    numeroInterior = intMatch[0].trim();
    cleaned = cleaned.replace(intMatch[0], ' ').replace(/\s+/g, ' ').trim();
  }

  // Check if entire remaining street is MZA / LTE nomenclature (common in Los Cabos colonias without street names)
  const isOnlyLotBlock = /^(?:mza\.?|mz\.?|manzana|m)\s*\d+/i.test(cleaned);
  if (isOnlyLotBlock) {
    return {
      calle: cleaned.replace(/[,\s]+$/, ''),
      numeroExterior: '',
      numeroInterior,
    };
  }

  // Extract exterior number (#142, No. 48, S/N, or trailing number)
  let numeroExterior = '';
  const snMatch = cleaned.match(/\b(?:s\/n|sn)\b/i);
  if (snMatch) {
    numeroExterior = 'S/N';
    cleaned = cleaned.replace(snMatch[0], ' ').replace(/\s+/g, ' ').trim();
  } else {
    const extMatch = cleaned.match(/(?:#|\b(?:no|num)\.?\s*)(\d+[a-z]?)\b|\s(\d{1,5}[a-z]?)(?:\s*$|\s*,)/i);
    if (extMatch) {
      numeroExterior = (extMatch[1] || extMatch[2] || '').trim();
      cleaned = cleaned.replace(extMatch[0], ' ').replace(/\s+/g, ' ').trim();
    }
  }

  return {
    calle: cleaned.replace(/^[,;|/\-.\s]+|[,;|/\-.\s]+$/g, '') || 'SIN NOMBRE',
    numeroExterior,
    numeroInterior,
  };
}

function splitNameAndAddress(text: string): { acreditado: string; addressPart: string } {
  const cleaned = text.replace(/^\s*(?:\d{1,3}[.)\-:]|[•\-*])\s+/, '').trim();

  // Delimiter-based split (pipe, semicolon, dash between name and address)
  const delimMatch = cleaned.match(/^([^|;\t]+?)\s*(?:\||;| - | – | — )\s*(.+)$/);
  if (delimMatch) {
    const left = delimMatch[1].trim();
    const right = delimMatch[2].trim();
    if (left.length >= 3 && !ADDRESS_START_REGEX.test(left.split(' ')[0])) {
      return { acreditado: left, addressPart: right };
    }
  }

  // Comma-separated: if first segment looks like a person's name (no address keywords or digits)
  const commaParts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);
  if (
    commaParts.length >= 2 &&
    !/\d/.test(commaParts[0]) &&
    !ADDRESS_START_REGEX.test(commaParts[0])
  ) {
    return {
      acreditado: commaParts[0],
      addressPart: commaParts.slice(1).join(', '),
    };
  }

  // Keyword scan: split right before the first street/lot/colonia keyword
  const match = ADDRESS_START_REGEX.exec(cleaned);
  if (match && match.index > 2) {
    const possibleName = cleaned.slice(0, match.index).replace(/[,:\-\s]+$/, '').trim();
    const rest = cleaned.slice(match.index).trim();
    if (possibleName.length >= 3 && !/\d{3,}/.test(possibleName)) {
      return { acreditado: possibleName, addressPart: rest };
    }
  }

  // Check if first 2-4 words are capitalized name followed by a number
  const numIdx = cleaned.search(/\s\d{1,5}\b/);
  if (numIdx > 4) {
    const wordsBefore = cleaned.slice(0, numIdx).trim().split(/\s+/);
    if (wordsBefore.length >= 2 && wordsBefore.length <= 5) {
      // Last word might be street name; keep up to 3 words as name if no address keyword
      const nameCandidate = wordsBefore.slice(0, Math.min(3, wordsBefore.length - 1)).join(' ');
      const restCandidate = cleaned.slice(nameCandidate.length).trim();
      if (nameCandidate.length >= 3 && restCandidate.length >= 3) {
        return { acreditado: nameCandidate, addressPart: restCandidate };
      }
    }
  }

  return { acreditado: '', addressPart: cleaned };
}

function parseSingleBlockToDraft(blockText: string, index: number): ParsedClientDraft | null {
  const fixed = fixMojibake(blockText).trim();
  if (!fixed || fixed.length < 4) return null;

  // Check if tab-separated (copy-pasted from Excel / Google Sheets)
  if (fixed.includes('\t')) {
    const cols = fixed.split('\t').map((c) => c.trim());
    // Ignore header row if copied directly
    const joinedLower = cols.join(' ').toLowerCase();
    if (joinedLower.includes('acreditado') && joinedLower.includes('colonia')) {
      return null;
    }

    const joined = cols.filter(Boolean).join(' ');
    const { phone } = extractPhone(joined);
    const { cp } = extractPostalCode(joined);
    const { ciudadRaw, estadoRaw } = extractCityAndState(joined);
    const { colonia, inferredCity } = extractColonia(joined);

    // Heuristic: column 0 is almost always Acreditado in Excel copy
    const acreditado = cols[0] || `Cliente #${index + 1}`;
    const remainingCols = cols
      .slice(1)
      .filter((c) => c && c !== phone && !c.includes(cp))
      .join(', ');

    const { remaining: withoutCity } = extractCityAndState(
      extractPostalCode(extractPhone(remainingCols).remaining).remaining
    );
    const { remaining: streetSource } = extractColonia(withoutCity);
    const streetInfo = extractStreetDetails(streetSource);
    const finalCity = cleanCiudad(ciudadRaw || inferredCity, colonia, cp);

    return {
      id: `draft-${index + 1}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      acreditado,
      calle: streetInfo.calle,
      numeroExterior: streetInfo.numeroExterior,
      numeroInterior: streetInfo.numeroInterior,
      colonia: colonia || 'Centro',
      ciudad: finalCity,
      estado: cleanEstado(estadoRaw || 'Baja California Sur'),
      codigoPostal: cp,
      telefono: phone,
      rawLine: fixed,
    };
  }

  // Multi-line or single-line freeform block
  const lines = fixed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const combined = lines.join(', ');
  const { phone, remaining: afterPhone } = extractPhone(combined);
  const { cp, remaining: afterCp } = extractPostalCode(afterPhone);
  const { ciudadRaw, estadoRaw, remaining: afterCity } = extractCityAndState(afterCp);
  const { colonia, inferredCity, remaining: afterColonia } = extractColonia(afterCity);

  let acreditado = '';
  let addressPart = afterColonia;

  if (lines.length >= 2) {
    // In a multi-line block, first line without address keywords/phone is usually the name
    const firstLine = lines[0].replace(/^\s*(?:\d{1,3}[.)\-:]|[•\-*])\s+/, '').trim();
    const firstHasPhone = /\b\d{10}\b/.test(firstLine.replace(/[\s-]/g, ''));
    if (firstLine && !firstHasPhone && !ADDRESS_START_REGEX.test(firstLine) && !/\b234\d{2}\b/.test(firstLine)) {
      acreditado = firstLine;
      const restJoined = lines.slice(1).join(', ');
      const r1 = extractPhone(restJoined).remaining;
      const r2 = extractPostalCode(r1).remaining;
      const r3 = extractCityAndState(r2).remaining;
      addressPart = extractColonia(r3).remaining;
    } else {
      const split = splitNameAndAddress(afterColonia);
      acreditado = split.acreditado;
      addressPart = split.addressPart;
    }
  } else {
    const split = splitNameAndAddress(afterColonia);
    acreditado = split.acreditado;
    addressPart = split.addressPart;
  }

  const streetInfo = extractStreetDetails(addressPart);
  const finalCity = cleanCiudad(ciudadRaw || inferredCity, colonia, cp);

  return {
    id: `draft-${index + 1}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    acreditado: acreditado || `Cliente #${index + 1}`,
    calle: streetInfo.calle,
    numeroExterior: streetInfo.numeroExterior,
    numeroInterior: streetInfo.numeroInterior,
    colonia: colonia || 'Centro',
    ciudad: finalCity,
    estado: cleanEstado(estadoRaw || 'Baja California Sur'),
    codigoPostal: cp,
    telefono: phone,
    rawLine: fixed,
  };
}

/**
 * Splits messy pasted text or OCR output into individual client blocks and parses each one.
 * Handles:
 *  - Blank-line separated multi-line blocks
 *  - Numbered list blocks (1. ..., 2. ...)
 *  - Tab-separated spreadsheet blocks
 *  - Line-by-line client lists
 */
export function parseRawTextToClients(rawText: string): ParsedClientDraft[] {
  const fixed = fixMojibake(rawText).trim();
  if (!fixed) return [];

  const lines = fixed.split(/\r?\n/);
  const hasBlankLines = /\n\s*\n/.test(fixed);
  const hasTabs = lines.some((l) => l.includes('\t'));

  let blocks: string[] = [];

  if (hasTabs) {
    // Spreadsheet copy-paste: each non-empty line is one client row
    blocks = lines.map((l) => l.trim()).filter(Boolean);
  } else if (hasBlankLines) {
    // Blank-line separated blocks; also split any huge block if each line inside looks complete
    const rawBlocks = fixed.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
    for (const b of rawBlocks) {
      const subLines = b.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      // If >= 3 lines and most lines contain a phone number or CP, treat each line as its own client
      const linesWithPhoneOrCp = subLines.filter(
        (l) => /\b\d{10}\b/.test(l.replace(/[\s-]/g, '')) || /\b234\d{2}\b/.test(l)
      ).length;
      if (subLines.length >= 2 && linesWithPhoneOrCp >= subLines.length - 1 && linesWithPhoneOrCp >= 2) {
        blocks.push(...subLines);
      } else {
        blocks.push(b);
      }
    }
  } else {
    // No blank lines: group multi-line client blocks if lines alternate (name line -> address/phone line)
    // or treat each line as a client if each line has name + address/phone
    const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
    let currentGroup: string[] = [];

    const flushGroup = () => {
      if (currentGroup.length > 0) {
        blocks.push(currentGroup.join('\n'));
        currentGroup = [];
      }
    };

    for (const line of nonEmpty) {
      const startsWithNumber = /^\d{1,3}[.)\-]\s+/.test(line);
      const hasPhone = /\b\d{10}\b/.test(line.replace(/[\s-]/g, ''));
      const hasAddressMarker = ADDRESS_START_REGEX.test(line) || /\b234\d{2}\b/.test(line);
      const looksLikeNameOnly = !hasPhone && !hasAddressMarker && !/\d/.test(line) && line.split(/\s+/).length >= 2;

      if (startsWithNumber) {
        flushGroup();
        currentGroup.push(line);
      } else if (looksLikeNameOnly && currentGroup.length > 0) {
        flushGroup();
        currentGroup.push(line);
      } else if (hasPhone && hasAddressMarker && !looksLikeNameOnly && currentGroup.length === 0) {
        // Complete single-line client
        blocks.push(line);
      } else {
        currentGroup.push(line);
        // If current group now has both a name line and a phone/address line, keep collecting only continuation lines
        if (currentGroup.length >= 3 && hasPhone) {
          flushGroup();
        }
      }
    }
    flushGroup();
  }

  const drafts: ParsedClientDraft[] = [];
  blocks.forEach((blk, idx) => {
    const parsed = parseSingleBlockToDraft(blk, idx);
    if (parsed) drafts.push(parsed);
  });

  return drafts;
}

/**
 * Converts edited ParsedClientDraft items through the canonical cleanExcelRows pipeline.
 */
export function draftsToClientStops(drafts: ParsedClientDraft[]): ClientStop[] {
  const rows = drafts.map((d) => ({
    Acreditado: d.acreditado,
    Calle: d.calle,
    'Numero Exterior': d.numeroExterior,
    'Numero Interior': d.numeroInterior,
    Colonia: d.colonia,
    Municipio: 'Los Cabos',
    Ciudad: d.ciudad,
    Estado: d.estado,
    'Codigo Postal': d.codigoPostal,
    Teléfono: d.telefono,
  }));
  return cleanExcelRows(rows);
}

export const SAMPLE_WHATSAPP_LIST = `1. María Guadalupe Hernández - Calle Playa El Médano 142, Col. El Médano, Cabo San Lucas, CP 23453 Tel 624 142 8810
2. Carlos Mendoza Castro | Blvd. Antonio Mijares 48 Int B | Col. Centro | San José del Cabo 23400 | 624-155-3920

Ana Karen Villalobos Ojeda
MZA 14 LTE 8 SIN NOMBRE Col. Mesa Colorada
Cabo San Lucas 23473
Tel: 6241930041

Héctor Avilés Green - Av. Centenario #304 Col. Zacatal, San Jose del, Baja Californ 23427 6241207765`;
