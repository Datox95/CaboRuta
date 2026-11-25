import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2 } from 'lucide-react';
import type { BasePoint, ClientStop, RouteGeometry, VisitStatus } from '../types/route';
import { buildGoogleMapsUrl, buildWazeUrl, STATUS_LABELS } from '../utils/whatsappShare';

interface RouteMapProps {
  basePoint: BasePoint;
  stops: ClientStop[];
  routeGeometry: RouteGeometry;
  darkMode: boolean;
  selectedStopId: string | null;
  onSelectStop: (id: string) => void;
  onDragStopPin: (id: string, lat: number, lng: number) => void;
}

const STATUS_PIN_COLORS: Record<VisitStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: '#0284C7', text: '#FFFFFF', border: '#0369A1' },
  collected: { bg: '#16A34A', text: '#FFFFFF', border: '#15803D' },
  promise: { bg: '#F59E0B', text: '#0F172A', border: '#D97706' },
  not_found: { bg: '#DC2626', text: '#FFFFFF', border: '#B91C1C' },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const RouteMap: React.FC<RouteMapProps> = ({
  basePoint,
  stops,
  routeGeometry,
  darkMode,
  selectedStopId,
  onSelectStop,
  onDragStopPin,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());
  const onDragRef = useRef(onDragStopPin);
  const onSelectRef = useRef(onSelectStop);

  onDragRef.current = onDragStopPin;
  onSelectRef.current = onSelectStop;

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [basePoint.lat, basePoint.lng],
      zoom: 12,
      zoomControl: true,
    });

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Tile Layer (OpenStreetMap free tiles; dark mode styled via CSS filter)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      return;
    }

    const layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    });
    layer.addTo(map);
    tileLayerRef.current = layer;
  }, [darkMode]);

  // Render Base Marker, Numbered Draggable Stop Pins, and Street Route Polyline
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    markerMapRef.current.clear();

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    // 1. Route Polyline
    if (routeGeometry.coordinates.length > 1) {
      const polyline = L.polyline(routeGeometry.coordinates, {
        color: darkMode ? '#38BDF8' : '#0284C7',
        weight: 4.5,
        opacity: 0.85,
        dashArray: routeGeometry.source === 'fallback' ? '8 8' : undefined,
      }).addTo(map);
      routeLayerRef.current = polyline;
    }

    // 2. Base Point Marker
    const baseIcon = L.divIcon({
      className: 'caboruta-pin-icon',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      html: `<div style="width:34px;height:34px;border-radius:10px;background:#0F172A;color:#FACC15;border:2px solid #FACC15;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;box-shadow:0 4px 10px rgba(0,0,0,0.35);">B</div>`,
    });

    const baseMarker = L.marker([basePoint.lat, basePoint.lng], {
      icon: baseIcon,
      zIndexOffset: 500,
    }).addTo(markersLayer);

    baseMarker.bindPopup(
      `<div style="padding:10px 12px;font-family:inherit;">
        <div style="font-size:11px;font-weight:700;color:#0284C7;">PUNTO BASE (SALIDA Y RETORNO)</div>
        <div style="font-size:13px;font-weight:600;margin-top:3px;">${escapeHtml(basePoint.label)}</div>
      </div>`
    );

    // 3. Numbered Draggable Client Markers
    const boundsPoints: L.LatLngExpression[] = [[basePoint.lat, basePoint.lng]];

    stops.forEach((stop, index) => {
      if (stop.lat === null || stop.lng === null) return;
      const orderNum = stop.visitOrder ?? index + 1;
      const colors = STATUS_PIN_COLORS[stop.status];
      const isSelected = stop.id === selectedStopId;

      const pinIcon = L.divIcon({
        className: 'caboruta-pin-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        html: `<div style="width:32px;height:32px;border-radius:9999px;background:${colors.bg};color:${colors.text};border:${
          isSelected ? '3px solid #FFFFFF' : `2px solid ${colors.border}`
        };box-shadow:${
          isSelected ? '0 0 0 3px #0284C7, 0 6px 14px rgba(0,0,0,0.35)' : '0 3px 8px rgba(0,0,0,0.28)'
        };display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:12px;">${orderNum}</div>`,
      });

      const marker = L.marker([stop.lat, stop.lng], {
        icon: pinIcon,
        draggable: true,
        zIndexOffset: isSelected ? 400 : 100,
      }).addTo(markersLayer);

      const gmaps = buildGoogleMapsUrl(stop.lat, stop.lng);
      const waze = buildWazeUrl(stop.lat, stop.lng);

      marker.bindPopup(
        `<div style="padding:11px 12px;font-family:inherit;max-width:260px;">
          <div style="font-size:11px;font-weight:700;color:${colors.bg};">PARADA #${orderNum} · ${escapeHtml(
          STATUS_LABELS[stop.status]
        )}</div>
          <div style="font-size:13px;font-weight:700;margin-top:2px;">${escapeHtml(stop.acreditado)}</div>
          <div style="font-size:11px;opacity:0.8;margin-top:2px;">${escapeHtml(stop.cleanedAddress)}</div>
          <div style="font-size:10px;opacity:0.65;margin-top:4px;">Arrastra el pin para corregir posición</div>
          <div style="display:flex;gap:6px;margin-top:8px;">
            <a href="${gmaps}" target="_blank" rel="noopener noreferrer" style="padding:5px 8px;border-radius:6px;background:#0F172A;color:#fff;font-size:11px;font-weight:600;text-decoration:none;">Google Maps</a>
            <a href="${waze}" target="_blank" rel="noopener noreferrer" style="padding:5px 8px;border-radius:6px;background:#0284C7;color:#fff;font-size:11px;font-weight:600;text-decoration:none;">Waze</a>
          </div>
        </div>`
      );

      marker.on('click', () => {
        onSelectRef.current(stop.id);
      });

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onDragRef.current(stop.id, pos.lat, pos.lng);
      });

      markerMapRef.current.set(stop.id, marker);
      boundsPoints.push([stop.lat, stop.lng]);
    });

    if (boundsPoints.length > 1) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [45, 45], maxZoom: 15 });
    } else {
      map.setView([basePoint.lat, basePoint.lng], 13);
    }
  }, [basePoint, stops, routeGeometry, darkMode, selectedStopId]);

  // Focus & open popup when a stop card is clicked
  useEffect(() => {
    if (!selectedStopId || !mapRef.current) return;
    const marker = markerMapRef.current.get(selectedStopId);
    if (marker) {
      mapRef.current.panTo(marker.getLatLng(), { animate: true });
      marker.openPopup();
    }
  }, [selectedStopId]);

  const handleFitAll = () => {
    const map = mapRef.current;
    if (!map) return;
    const points: L.LatLngExpression[] = [[basePoint.lat, basePoint.lng]];
    stops.forEach((s) => {
      if (s.lat !== null && s.lng !== null) points.push([s.lat, s.lng]);
    });
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [45, 45], maxZoom: 15 });
    } else {
      map.setView([basePoint.lat, basePoint.lng], 13);
    }
  };

  return (
    <div className="relative h-full w-full bg-slate-200 dark:bg-slate-950" data-testid="route-map-container">
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Top-Right Map Control: Fit Bounds */}
      <button
        type="button"
        onClick={handleFitAll}
        className="absolute right-3 top-3 z-[400] inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-xs hover:bg-white dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
      >
        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        Ajustar ruta
      </button>

      {/* Bottom-Left Compact Map Legend */}
      <div className="absolute bottom-4 left-3 z-[400] hidden sm:flex items-center gap-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-slate-900 ring-1 ring-amber-400" />
          Base
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />
          Pendiente
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
          Cobrado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          Promesa
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
          No localizado
        </span>
      </div>
    </div>
  );
};
