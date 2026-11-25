import type { ClientStop } from '../types/route';
import { cleanExcelRows } from '../utils/dataCleaning';

/**
 * 10 realistic Los Cabos collection stops (Cabo San Lucas & San José del Cabo)
 * Intentionally includes real-world database dirtiness (mojibake, truncated State/City, SIN NOMBRE street)
 * and a zigzag initial ordering so TSP optimization visibly reduces total distance.
 */
const RAW_DEMO_ROWS: Array<Record<string, string>> = [
  {
    Acreditado: 'María Guadalupe Hernández Ríos',
    Calle: 'Calle Playa El Médano',
    'Numero Exterior': '142',
    'Numero Interior': '',
    Colonia: 'El Médano',
    Municipio: 'Los Cabos',
    Ciudad: 'Cabo San Lucas',
    Estado: 'Baja Californ',
    'Codigo Postal': '23453',
    'TelÃ©fono': '6241428810',
  },
  {
    Acreditado: 'Carlos Eduardo Mendoza Castro',
    Calle: 'Blvd. Antonio Mijares',
    'Numero Exterior': '48',
    'Numero Interior': 'B',
    Colonia: 'Centro',
    Municipio: 'Los Cabos',
    Ciudad: 'San JosÃ© d',
    Estado: 'Baja Californ',
    'Codigo Postal': '23400',
    'TelÃ©fono': '6241553920',
  },
  {
    Acreditado: 'Rosaura Aguilar Lucero',
    Calle: 'Av. Nicolás Tamaral',
    'Numero Exterior': '815',
    'Numero Interior': '',
    Colonia: 'Las Palmas',
    Municipio: 'Los Cabos',
    Ciudad: 'Cabo San Lucas',
    Estado: 'Baja California Sur',
    'Codigo Postal': '23477',
    Teléfono: '6241784402',
  },
  {
    Acreditado: 'Jorge Luis Ceseña Márquez',
    Calle: 'Calle Mauricio Castro',
    'Numero Exterior': '210',
    'Numero Interior': '',
    Colonia: 'Chametla',
    Municipio: 'Los Cabos',
    Ciudad: 'San Jose del',
    Estado: 'B.C.S.',
    'Codigo Postal': '23405',
    Teléfono: '6241612399',
  },
  {
    Acreditado: 'Ana Karen Villalobos Ojeda',
    Calle: 'SIN NOMBRE',
    'Numero Exterior': 'S/N',
    'Numero Interior': 'Lote 14',
    Colonia: 'Mesa Colorada',
    Municipio: 'Los Cabos',
    Ciudad: 'Cabo San Lucas',
    Estado: 'Baja Californ',
    'Codigo Postal': '23473',
    Teléfono: '6241930041',
  },
  {
    Acreditado: 'Héctor Manuel Avilés Green',
    Calle: 'Av. Centenario',
    'Numero Exterior': '304',
    'Numero Interior': '',
    Colonia: 'Zacatal',
    Municipio: 'Los Cabos',
    Ciudad: 'San Jose del',
    Estado: 'Baja Californ',
    'Codigo Postal': '23427',
    Teléfono: '6241207765',
  },
  {
    Acreditado: 'Patricia Montaño Domínguez',
    Calle: 'Calle Playa Chileno',
    'Numero Exterior': '19',
    'Numero Interior': '',
    Colonia: 'Cangrejos',
    Municipio: 'Los Cabos',
    Ciudad: 'Cabo San Lucas',
    Estado: 'Baja California Sur',
    'Codigo Postal': '23473',
    Teléfono: '6241335190',
  },
  {
    Acreditado: 'Fernando Arámburo Salgado',
    Calle: 'Camino Real al Tezal',
    'Numero Exterior': '520',
    'Numero Interior': '3',
    Colonia: 'El Tezal',
    Municipio: 'Los Cabos',
    Ciudad: 'Cabo San Lucas',
    Estado: 'Baja Californ',
    'Codigo Postal': '23454',
    Teléfono: '6241891124',
  },
  {
    Acreditado: 'Lucía Fernanda Verdugo Cota',
    Calle: 'Calle Ernesto Chanez Chávez',
    'Numero Exterior': '118',
    'Numero Interior': '',
    Colonia: 'Santa Rosa',
    Municipio: 'Los Cabos',
    Ciudad: 'San JosÃ© d',
    Estado: 'Baja Californ',
    'Codigo Postal': '23428',
    Teléfono: '6241449203',
  },
  {
    Acreditado: 'Roberto Carlos Núñez Collins',
    Calle: 'Calle Vicente Guerrero',
    'Numero Exterior': '76',
    'Numero Interior': '',
    Colonia: 'Centro',
    Municipio: 'Los Cabos',
    Ciudad: 'Cabo San Lucas',
    Estado: 'Baja California Sur',
    'Codigo Postal': '23450',
    Teléfono: '6241126740',
  },
];

// Real verified coordinates in Los Cabos for instant 1-click demo & baseline
const DEMO_COORDS: Array<{ lat: number; lng: number; precision: ClientStop['geocodePrecision'] }> = [
  { lat: 22.8909, lng: -109.9036, precision: 'exact' }, // El Médano CSL
  { lat: 23.0623, lng: -109.6968, precision: 'exact' }, // Centro SJC (Blvd. Mijares)
  { lat: 22.9094, lng: -109.9278, precision: 'street' }, // Las Palmas CSL
  { lat: 23.0539, lng: -109.7042, precision: 'street' }, // Chametla / Mauricio Castro SJC
  { lat: 22.9178, lng: -109.9395, precision: 'colonia' }, // Mesa Colorada SIN NOMBRE CSL
  { lat: 23.0764, lng: -109.7138, precision: 'street' }, // Zacatal SJC
  { lat: 22.9056, lng: -109.9482, precision: 'street' }, // Cangrejos CSL
  { lat: 22.9022, lng: -109.8781, precision: 'street' }, // El Tezal CSL
  { lat: 23.0798, lng: -109.7024, precision: 'street' }, // Santa Rosa SJC
  { lat: 22.8884, lng: -109.9154, precision: 'exact' }, // Centro CSL (Vicente Guerrero)
];

export function createDemoLosCabosStops(): ClientStop[] {
  return cleanExcelRows(RAW_DEMO_ROWS, DEMO_COORDS);
}
