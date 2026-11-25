export type VisitStatus = 'pending' | 'collected' | 'promise' | 'not_found';

export type ZoneId = 'all' | 'csl' | 'sjc';

export type StopZone = 'csl' | 'sjc' | 'corredor';

export type GeocodePrecision = 'exact' | 'street' | 'colonia' | 'manual' | 'fallback';

export interface BasePoint {
  label: string;
  lat: number;
  lng: number;
}

export interface ClientStop {
  id: string;
  originalOrder: number;
  visitOrder: number | null;
  blockIndex: number;
  acreditado: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  colonia: string;
  municipio: string;
  ciudad: string;
  estado: string;
  codigoPostal: string;
  telefono: string;
  telefonoNormalizado: string;
  isSinNombre: boolean;
  cleanedAddress: string;
  searchQueries: string[];
  zone: StopZone;
  lat: number | null;
  lng: number | null;
  geocodePrecision: GeocodePrecision | null;
  status: VisitStatus;
  statusUpdatedAt: string | null;
  notes: string;
  rawRow: Record<string, string | number | boolean | null | undefined>;
}

export interface RouteMetrics {
  totalClients: number;
  geocodedCount: number;
  totalDistanceKm: number;
  unoptimizedDistanceKm: number;
  distanceSavedKm: number;
  estimatedMinutes: number;
  fuelSavedLiters: number;
  fuelSavedMxn: number;
  collectedCount: number;
  promiseCount: number;
  notFoundCount: number;
  pendingCount: number;
}

export interface RouteGeometry {
  coordinates: [number, number][]; // [lat, lng] pairs for Leaflet Polyline
  source: 'osrm' | 'fallback';
}
