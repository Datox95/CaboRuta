import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRouteBackupJson,
  decodeRouteFromHash,
  encodeRouteToHashParam,
  parseRouteBackupJson,
} from './routeTransfer';
import { buildClosureWhatsappSummary, buildGoogleMapsLegUrls } from './whatsappShare';
import { DEFAULT_BASE_POINT } from './dataCleaning';
import { createDemoLosCabosStops } from '../data/demoLosCabos';
import { assignRouteBlocks, computeRouteMetrics } from './tspOptimizer';

test('encodeRouteToHashParam and decodeRouteFromHash preserve coordinates, order, status, and notes', () => {
  const demo = assignRouteBlocks(createDemoLosCabosStops(), null);
  demo[0].status = 'collected';
  demo[0].notes = 'Pagó en efectivo';
  demo[2].status = 'promise';

  const encoded = encodeRouteToHashParam({
    basePoint: DEFAULT_BASE_POINT,
    stops: demo,
    isOptimized: true,
  });

  const decoded = decodeRouteFromHash(`#ruta=${encoded}`);
  assert.ok(decoded !== null);
  assert.equal(decoded.isOptimized, true);
  assert.equal(decoded.stops.length, 10);
  assert.equal(decoded.stops[0].acreditado, demo[0].acreditado);
  assert.equal(decoded.stops[0].status, 'collected');
  assert.equal(decoded.stops[0].notes, 'Pagó en efectivo');
  assert.equal(decoded.stops[2].status, 'promise');
  assert.ok(decoded.stops[0].lat !== null && decoded.stops[0].lng !== null);
});

test('buildRouteBackupJson and parseRouteBackupJson round-trip offline JSON route file', () => {
  const demo = assignRouteBlocks(createDemoLosCabosStops(), null);
  const json = buildRouteBackupJson({
    basePoint: DEFAULT_BASE_POINT,
    stops: demo,
    isOptimized: true,
  });

  const restored = parseRouteBackupJson(json);
  assert.ok(restored !== null);
  assert.equal(restored.stops.length, 10);
  assert.equal(restored.basePoint.label, DEFAULT_BASE_POINT.label);
});

test('buildGoogleMapsLegUrls chunks ordered stops into groups of 9 with chained origin/destination', () => {
  const demo = assignRouteBlocks(createDemoLosCabosStops(), null);
  const legs = buildGoogleMapsLegUrls(DEFAULT_BASE_POINT, demo, 9);

  assert.equal(legs.length, 2);
  assert.equal(legs[0].startOrder, 1);
  assert.equal(legs[0].endOrder, 9);
  assert.equal(legs[0].stopCount, 9);
  assert.ok(legs[0].url.startsWith('https://www.google.com/maps/dir/?'));
  assert.ok(legs[0].url.includes('waypoints='));

  assert.equal(legs[1].startOrder, 10);
  assert.equal(legs[1].endOrder, 10);
  assert.equal(legs[1].stopCount, 1);
});

test('buildClosureWhatsappSummary reports visited, collected, promise, and not found totals', () => {
  const demo = assignRouteBlocks(createDemoLosCabosStops(), null);
  demo[0].status = 'collected';
  demo[1].status = 'promise';
  demo[2].status = 'not_found';
  demo[0].notes = 'Recibo #44';

  const metrics = computeRouteMetrics({
    allStops: demo,
    base: DEFAULT_BASE_POINT,
    orderedStops: demo,
  });

  const summary = buildClosureWhatsappSummary({
    base: DEFAULT_BASE_POINT,
    stops: demo,
    metrics,
  });

  assert.ok(summary.includes('Total visitados: 3'));
  assert.ok(summary.includes('Cobrados: 1'));
  assert.ok(summary.includes('Promesa / Reprogramados: 1'));
  assert.ok(summary.includes('No localizados: 1'));
  assert.ok(summary.includes('Recibo #44'));
});
