import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanCiudad,
  cleanEstado,
  cleanExcelRows,
  fixMojibake,
  isWithinLosCabosBounds,
  normalizeColumnKey,
  normalizeMexicanPhone,
} from './dataCleaning';
import {
  assignRouteBlocks,
  buildHaversineMatrix,
  calculateTourDistance,
  computeRouteMetrics,
  solveTspNearestNeighbor2Opt,
} from './tspOptimizer';
import { buildClientWhatsappUrl, buildRouteShareSummary, DEFAULT_WHATSAPP_TEMPLATE } from './whatsappShare';
import { buildClosureReportRows } from './excelService';
import { createDemoLosCabosStops } from '../data/demoLosCabos';
import { DEFAULT_BASE_POINT } from './dataCleaning';

test('fixMojibake repairs Latin-1/UTF-8 corrupted Spanish characters', () => {
  assert.equal(fixMojibake('TelÃ©fono'), 'Teléfono');
  assert.equal(fixMojibake('San JosÃ© d'), 'San José d');
  assert.equal(fixMojibake('CÃ³digo Postal'), 'Código Postal');
});

test('cleanEstado and cleanCiudad normalize incomplete Baja California Sur & Los Cabos strings', () => {
  assert.equal(cleanEstado('Baja Californ'), 'Baja California Sur, México');
  assert.equal(cleanEstado('B.C.S.'), 'Baja California Sur, México');
  assert.equal(cleanCiudad('San Jose del'), 'San José del Cabo');
  assert.equal(cleanCiudad('San JosÃ© d'), 'San José del Cabo');
  assert.equal(cleanCiudad('CSL'), 'Cabo San Lucas');
});

test('normalizeColumnKey maps dirty headers to canonical Excel columns', () => {
  assert.equal(normalizeColumnKey('TelÃ©fono'), 'Teléfono');
  assert.equal(normalizeColumnKey('Numero Exterior'), 'Numero Exterior');
  assert.equal(normalizeColumnKey('Codigo Postal'), 'Codigo Postal');
});

test('cleanExcelRows handles SIN NOMBRE streets by prioritizing Colonia and CP inside Los Cabos', () => {
  const cleaned = cleanExcelRows([
    {
      Acreditado: 'Ana Karen',
      Calle: 'SIN NOMBRE',
      'Numero Exterior': 'S/N',
      'Numero Interior': '',
      Colonia: 'Mesa Colorada',
      Municipio: 'Los Cabos',
      Ciudad: 'Cabo San Lucas',
      Estado: 'Baja Californ',
      'Codigo Postal': '23473',
      'TelÃ©fono': '6241930041',
    },
  ]);

  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].isSinNombre, true);
  assert.equal(cleaned[0].estado, 'Baja California Sur, México');
  assert.equal(cleaned[0].telefonoNormalizado, '526241930041');
  assert.ok(cleaned[0].searchQueries[0].includes('Mesa Colorada'));
  assert.ok(!cleaned[0].searchQueries[0].includes('SIN NOMBRE'));
});

test('isWithinLosCabosBounds rejects coordinates outside Los Cabos (e.g. Tijuana)', () => {
  // Plaza Puerto Paraíso, CSL
  assert.equal(isWithinLosCabosBounds(22.88585, -109.91145), true);
  // San José del Cabo Centro
  assert.equal(isWithinLosCabosBounds(23.0623, -109.6968), true);
  // Tijuana (must be rejected)
  assert.equal(isWithinLosCabosBounds(32.5149, -117.0382), false);
});

test('normalizeMexicanPhone formats 10-digit numbers with +52 lada', () => {
  const res = normalizeMexicanPhone('624-142-8810');
  assert.equal(res.whatsappDigits, '526241428810');
  assert.equal(res.telHref, 'tel:+526241428810');
});

test('TSP Nearest Neighbor + 2-opt strictly improves or matches naive zigzag order on demo Los Cabos stops', () => {
  const demoStops = createDemoLosCabosStops();
  assert.equal(demoStops.length, 10);

  const geocoded = demoStops.filter(
    (s): s is typeof s & { lat: number; lng: number } => s.lat !== null && s.lng !== null
  );
  const matrix = buildHaversineMatrix(DEFAULT_BASE_POINT, geocoded);
  const naiveTour = [0, ...geocoded.map((_, idx) => idx + 1)];
  const naiveDistance = calculateTourDistance(naiveTour, matrix, true);

  const optimizedIndices = solveTspNearestNeighbor2Opt(matrix, true);
  assert.equal(optimizedIndices.length, 10);
  assert.equal(new Set(optimizedIndices).size, 10);

  const optimizedTour = [0, ...optimizedIndices.map((i) => i + 1)];
  const optimizedDistance = calculateTourDistance(optimizedTour, matrix, true);

  assert.ok(
    optimizedDistance < naiveDistance,
    `Expected optimized (${optimizedDistance.toFixed(2)} km) < naive (${naiveDistance.toFixed(2)} km)`
  );
});

test('assignRouteBlocks splits stops cleanly and closure report includes required columns', () => {
  const demoStops = assignRouteBlocks(createDemoLosCabosStops(), 4);
  assert.equal(demoStops[0].blockIndex, 1);
  assert.equal(demoStops[4].blockIndex, 2);
  assert.equal(demoStops[8].blockIndex, 3);

  demoStops[0].status = 'collected';
  demoStops[0].statusUpdatedAt = '14:25';
  demoStops[0].notes = 'Pagó completo';

  const rows = buildClosureReportRows(demoStops);
  assert.equal(rows[0]['Orden de Visita'], 1);
  assert.equal(rows[0]['Estatus de Cobro'], 'Cobrado');
  assert.equal(rows[0]['Hora de Registro'], '14:25');
  assert.equal(rows[0]['Notas del Gestor'], 'Pagó completo');
});

test('WhatsApp template rendering and share summary produce clean non-empty text', () => {
  const demoStops = assignRouteBlocks(createDemoLosCabosStops(), null);
  const url = buildClientWhatsappUrl(demoStops[0], DEFAULT_WHATSAPP_TEMPLATE);
  assert.ok(url.startsWith('https://wa.me/52624'));

  const metrics = computeRouteMetrics({
    allStops: demoStops,
    base: DEFAULT_BASE_POINT,
    orderedStops: demoStops,
  });
  const summary = buildRouteShareSummary({
    base: DEFAULT_BASE_POINT,
    stops: demoStops,
    metrics,
  });
  assert.ok(summary.includes('Plaza Puerto Paraiso'));
  assert.ok(summary.includes('https://maps.google.com/?q='));
});
