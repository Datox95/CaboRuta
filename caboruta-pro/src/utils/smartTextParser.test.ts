import test from 'node:test';
import assert from 'node:assert/strict';
import {
  draftsToClientStops,
  parseRawTextToClients,
  SAMPLE_WHATSAPP_LIST,
} from './smartTextParser';

test('parseRawTextToClients extracts phones, 234xx zip codes, MZA/LTE/SIN NOMBRE, and cleans BCS/SJC', () => {
  const drafts = parseRawTextToClients(SAMPLE_WHATSAPP_LIST);
  assert.equal(drafts.length, 4);

  // Entry 1: single line with hyphen
  assert.equal(drafts[0].acreditado, 'María Guadalupe Hernández');
  assert.equal(drafts[0].calle, 'Calle Playa El Médano');
  assert.equal(drafts[0].numeroExterior, '142');
  assert.equal(drafts[0].colonia, 'El Médano');
  assert.equal(drafts[0].codigoPostal, '23453');
  assert.equal(drafts[0].ciudad, 'Cabo San Lucas');
  assert.equal(drafts[0].telefono, '+52 624 142 8810');

  // Entry 2: pipe-delimited San José del Cabo
  assert.equal(drafts[1].acreditado, 'Carlos Mendoza Castro');
  assert.equal(drafts[1].colonia, 'Centro');
  assert.equal(drafts[1].ciudad, 'San José del Cabo');
  assert.equal(drafts[1].codigoPostal, '23400');

  // Entry 3: multi-line block with MZA/LTE and SIN NOMBRE
  assert.equal(drafts[2].acreditado, 'Ana Karen Villalobos Ojeda');
  assert.equal(drafts[2].calle, 'SIN NOMBRE');
  assert.equal(drafts[2].colonia, 'Mesa Colorada');
  assert.equal(drafts[2].codigoPostal, '23473');
  assert.equal(drafts[2].telefono, '+52 624 193 0041');

  // Entry 4: messy incomplete Baja Californ & San Jose del
  assert.equal(drafts[3].acreditado, 'Héctor Avilés Green');
  assert.equal(drafts[3].colonia, 'Zacatal');
  assert.equal(drafts[3].ciudad, 'San José del Cabo');
  assert.equal(drafts[3].estado, 'Baja California Sur, México');
});

test('parseRawTextToClients parses tab-separated Excel/Sheets blocks and ignores header row', () => {
  const tsv = [
    'Acreditado\tCalle\tColonia\tCiudad\tCodigo Postal\tTeléfono',
    'Rosaura Aguilar Lucero\tAv. Nicolás Tamaral 815\tLas Palmas\tCabo San Lucas\t23477\t6241784402',
    'Patricia Montaño\tMza 4 Lte 9 Coto 2 Casa 11\tCangrejos\tCabo San Lucas\t23473\t6241335190',
  ].join('\n');

  const drafts = parseRawTextToClients(tsv);
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].acreditado, 'Rosaura Aguilar Lucero');
  assert.equal(drafts[0].colonia, 'Las Palmas');
  assert.equal(drafts[0].codigoPostal, '23477');
  assert.equal(drafts[1].acreditado, 'Patricia Montaño');
  assert.equal(drafts[1].colonia, 'Cangrejos');
  assert.equal(drafts[1].telefono, '+52 624 133 5190');
});

test('draftsToClientStops converts edited drafts into clean ClientStop objects bounded to Los Cabos', () => {
  const drafts = parseRawTextToClients(
    'Roberto Núñez - Calle Vicente Guerrero 76, Col. Centro, Cabo San Lucas, 23450, 6241126740'
  );
  const stops = draftsToClientStops(drafts);
  assert.equal(stops.length, 1);
  assert.equal(stops[0].acreditado, 'Roberto Núñez');
  assert.equal(stops[0].estado, 'Baja California Sur, México');
  assert.equal(stops[0].telefonoNormalizado, '526241126740');
  assert.equal(stops[0].zone, 'csl');
});
