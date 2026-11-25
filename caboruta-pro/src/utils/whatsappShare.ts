import type { BasePoint, ClientStop, RouteMetrics, VisitStatus } from '../types/route';

export const DEFAULT_WHATSAPP_TEMPLATE =
  'Hola [Nombre], le saludamos del equipo de cobranza CaboRuta. Vamos en camino hacia su domicilio en [Colonia] (parada #[Parada]). ¿Nos confirma si se encuentra disponible?';

export const STATUS_LABELS: Record<VisitStatus, string> = {
  pending: 'Pendiente',
  collected: 'Cobrado',
  promise: 'Promesa / Reprogramar',
  not_found: 'No localizado',
};

export function renderClientWhatsappMessage(template: string, stop: ClientStop): string {
  const parada = stop.visitOrder ?? stop.originalOrder;
  return template
    .replace(/\[Nombre\]/gi, stop.acreditado)
    .replace(/\[Dirección\]/gi, stop.cleanedAddress)
    .replace(/\[Direccion\]/gi, stop.cleanedAddress)
    .replace(/\[Colonia\]/gi, stop.colonia)
    .replace(/\[Parada\]/gi, String(parada));
}

export function buildClientWhatsappUrl(stop: ClientStop, template: string): string {
  const message = encodeURIComponent(renderClientWhatsappMessage(template, stop));
  if (!stop.telefonoNormalizado) {
    return `https://wa.me/?text=${message}`;
  }
  return `https://wa.me/${stop.telefonoNormalizado}?text=${message}`;
}

export function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}&travelmode=driving`;
}

export function buildWazeUrl(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat.toFixed(6)},${lng.toFixed(6)}&navigate=yes`;
}

export interface GoogleMapsLeg {
  legIndex: number;
  startOrder: number;
  endOrder: number;
  stopCount: number;
  url: string;
}

/**
 * Groups ordered geocoded stops in chunks of 9 stops to generate continuous
 * multi-stop Google Maps navigation links (https://www.google.com/maps/dir/?api=1...).
 */
export function buildGoogleMapsLegUrls(
  base: BasePoint,
  orderedStops: ClientStop[],
  chunkSize = 9
): GoogleMapsLeg[] {
  const geocoded = orderedStops.filter(
    (s): s is ClientStop & { lat: number; lng: number } => s.lat !== null && s.lng !== null
  );
  if (geocoded.length === 0) return [];

  const legs: GoogleMapsLeg[] = [];
  let prevOrigin = { lat: base.lat, lng: base.lng };

  for (let start = 0; start < geocoded.length; start += chunkSize) {
    const chunk = geocoded.slice(start, start + chunkSize);
    const destination = chunk[chunk.length - 1];
    const waypoints = chunk.slice(0, -1);

    const params = new URLSearchParams({
      api: '1',
      origin: `${prevOrigin.lat.toFixed(6)},${prevOrigin.lng.toFixed(6)}`,
      destination: `${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`,
      travelmode: 'driving',
    });
    if (waypoints.length > 0) {
      params.set(
        'waypoints',
        waypoints.map((w) => `${w.lat.toFixed(6)},${w.lng.toFixed(6)}`).join('|')
      );
    }

    const firstOrder = chunk[0].visitOrder ?? start + 1;
    const lastOrder = destination.visitOrder ?? start + chunk.length;

    legs.push({
      legIndex: legs.length + 1,
      startOrder: firstOrder,
      endOrder: lastOrder,
      stopCount: chunk.length,
      url: `https://www.google.com/maps/dir/?${params.toString()}`,
    });

    prevOrigin = { lat: destination.lat, lng: destination.lng };
  }

  return legs;
}

export function formatDurationHm(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins} min`;
  return `${hours}h ${mins.toString().padStart(2, '0')}m`;
}

export function buildRouteShareSummary(params: {
  base: BasePoint;
  stops: ClientStop[];
  metrics: RouteMetrics;
  transferUrl?: string;
}): string {
  const { base, stops, metrics, transferUrl } = params;
  const lines: string[] = [
    '*CaboRuta Pro — Hoja de Ruta Optimizada*',
    `Base Salida/Retorno: ${base.label}`,
    `Paradas: ${stops.length} | Distancia: ${metrics.totalDistanceKm} km | Tiempo est.: ${formatDurationHm(metrics.estimatedMinutes)}`,
    `Cobranza actual: ${metrics.collectedCount}/${metrics.totalClients} cobrados`,
  ];

  if (transferUrl) {
    lines.push('', '*Abre la ruta directo en tu celular (mapa y pines listos):*', transferUrl);
  }

  lines.push('', '*Orden de Visitas:*');

  stops.forEach((stop, idx) => {
    const order = stop.visitOrder ?? idx + 1;
    const coordsLink =
      stop.lat !== null && stop.lng !== null
        ? `https://maps.google.com/?q=${stop.lat.toFixed(6)},${stop.lng.toFixed(6)}`
        : 'Sin coordenadas';
    lines.push(
      `${order}. *${stop.acreditado}* (${STATUS_LABELS[stop.status]})` +
        `\n   Dir: ${stop.cleanedAddress}` +
        `\n   Tel: ${stop.telefono} | GPS: ${coordsLink}`
    );
  });

  return lines.join('\n');
}

export function buildClosureWhatsappSummary(params: {
  base: BasePoint;
  stops: ClientStop[];
  metrics: RouteMetrics;
}): string {
  const { base, stops, metrics } = params;
  const visitedCount = metrics.collectedCount + metrics.promiseCount + metrics.notFoundCount;
  const dateStr = new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const lines: string[] = [
    `*Cierre de Cobranza — CaboRuta Pro (${dateStr})*`,
    `Base: ${base.label}`,
    `• Total clientes en ruta: ${metrics.totalClients}`,
    `• Total visitados: ${visitedCount}`,
    `• Cobrados: ${metrics.collectedCount}`,
    `• Promesa / Reprogramados: ${metrics.promiseCount}`,
    `• No localizados: ${metrics.notFoundCount}`,
    `• Sin visitar (Pendientes): ${metrics.pendingCount}`,
    `• Distancia recorrida est.: ${metrics.totalDistanceKm} km`,
  ];

  const withNotes = stops.filter((s) => s.status !== 'pending' || s.notes.trim());
  if (withNotes.length > 0) {
    lines.push('', '*Detalle de gestiones:*');
    withNotes.forEach((s, idx) => {
      const order = s.visitOrder ?? idx + 1;
      const timeTag = s.statusUpdatedAt ? ` [${s.statusUpdatedAt}]` : '';
      const noteTag = s.notes.trim() ? ` — Nota: ${s.notes.trim()}` : '';
      lines.push(`${order}. ${s.acreditado}: *${STATUS_LABELS[s.status]}*${timeTag}${noteTag}`);
    });
  }

  return lines.join('\n');
}
