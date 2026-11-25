import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FolderOpen,
  ListOrdered,
  Map as MapIcon,
  MessageSquareText,
  Navigation,
  RotateCcw,
  Route,
  Search,
} from 'lucide-react';
import { TopBar } from './components/TopBar';
import { MetricsDashboard } from './components/MetricsDashboard';
import { ExcelImportPanel, type ImportTabId } from './components/ExcelImportPanel';
import { StopCard } from './components/StopCard';
import { RouteMap } from './components/RouteMap';
import {
  ClosureReportModal,
  ConfirmClearModal,
  GoogleMapsLegsModal,
  ShareWhatsappModal,
  WhatsappTemplateModal,
} from './components/RouteModals';
import { OfflineIndicator } from './components/PWAInstallButton';
import type {
  BasePoint,
  ClientStop,
  RouteGeometry,
  VisitStatus,
  ZoneId,
} from './types/route';
import { DEFAULT_BASE_POINT } from './utils/dataCleaning';
import { createDemoLosCabosStops } from './data/demoLosCabos';
import { parseSpreadsheetBuffer, downloadClosureExcel } from './utils/excelService';
import {
  cacheStopCoordinates,
  geocodeBasePoint,
  geocodeStopsBatch,
} from './services/geocoding';
import { fetchOsrmDistanceMatrix, fetchOsrmRoute } from './services/routing';
import {
  assignRouteBlocks,
  buildHaversineMatrix,
  computeRouteMetrics,
  solveTspNearestNeighbor2Opt,
} from './utils/tspOptimizer';
import {
  buildClosureWhatsappSummary,
  buildGoogleMapsLegUrls,
  buildRouteShareSummary,
  DEFAULT_WHATSAPP_TEMPLATE,
} from './utils/whatsappShare';
import {
  draftsToClientStops,
  type ParsedClientDraft,
} from './utils/smartTextParser';
import {
  buildRouteBackupJson,
  buildRouteShareUrl,
  decodeRouteFromHash,
  parseRouteBackupJson,
} from './utils/routeTransfer';

const STORAGE_KEY_ROUTE_STATE = 'caboruta_route_state_v1';
const LEGACY_STORAGE_KEY_STOPS = 'caboruta_stops_v1';
const STORAGE_KEY_THEME = 'caboruta_theme_v1';
const STORAGE_KEY_WA_TEMPLATE = 'caboruta_wa_template_v1';

interface PersistedRouteState {
  stops: ClientStop[];
  basePoint: BasePoint;
  isOptimized: boolean;
  zoneFilter: ZoneId;
  blockSize: number | null;
  routeGeometry: RouteGeometry;
  osrmTotals: {
    distanceKm: number | null;
    durationMin: number | null;
  };
}

function loadInitialPersistedState(): PersistedRouteState {
  const fallback: PersistedRouteState = {
    stops: [],
    basePoint: DEFAULT_BASE_POINT,
    isOptimized: false,
    zoneFilter: 'all',
    blockSize: null,
    routeGeometry: { coordinates: [], source: 'fallback' },
    osrmTotals: { distanceKm: null, durationMin: null },
  };

  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY_ROUTE_STATE);
    if (rawState) {
      const parsed = JSON.parse(rawState) as Partial<PersistedRouteState>;
      if (parsed && Array.isArray(parsed.stops)) {
        return {
          stops: parsed.stops,
          basePoint: parsed.basePoint ?? DEFAULT_BASE_POINT,
          isOptimized: Boolean(parsed.isOptimized),
          zoneFilter: parsed.zoneFilter ?? 'all',
          blockSize: parsed.blockSize ?? null,
          routeGeometry: parsed.routeGeometry ?? fallback.routeGeometry,
          osrmTotals: parsed.osrmTotals ?? fallback.osrmTotals,
        };
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY_STOPS);
    if (legacyRaw) {
      const legacyStops = JSON.parse(legacyRaw) as ClientStop[];
      if (Array.isArray(legacyStops)) {
        return { ...fallback, stops: legacyStops };
      }
    }
  } catch {
    // Ignore storage read errors
  }

  return fallback;
}

export default function App() {
  const [initialState] = useState<PersistedRouteState>(() => loadInitialPersistedState());

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_THEME);
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return false;
    } catch {
      return false;
    }
  });

  const [stops, setStops] = useState<ClientStop[]>(initialState.stops);
  const [basePoint, setBasePoint] = useState<BasePoint>(initialState.basePoint);
  const [baseLabelDraft, setBaseLabelDraft] = useState<string>(initialState.basePoint.label);
  const [zoneFilter, setZoneFilter] = useState<ZoneId>(initialState.zoneFilter);
  const [statusFilter, setStatusFilter] = useState<VisitStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [blockSize, setBlockSize] = useState<number | null>(initialState.blockSize);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [isOptimized, setIsOptimized] = useState<boolean>(initialState.isOptimized);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizeProgress, setOptimizeProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [routeGeometry, setRouteGeometry] = useState<RouteGeometry>(initialState.routeGeometry);
  const [osrmTotals, setOsrmTotals] = useState<{
    distanceKm: number | null;
    durationMin: number | null;
  }>(initialState.osrmTotals);

  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(
    initialState.stops.length > 0 && initialState.isOptimized
  );
  const [importTab, setImportTab] = useState<ImportTabId>('excel');
  const [pastedImageFile, setPastedImageFile] = useState<File | Blob | null>(null);
  const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list');
  const [notice, setNotice] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  const [whatsappTemplate, setWhatsappTemplate] = useState<string>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY_WA_TEMPLATE) || DEFAULT_WHATSAPP_TEMPLATE;
    } catch {
      return DEFAULT_WHATSAPP_TEMPLATE;
    }
  });
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showClosureModal, setShowClosureModal] = useState<boolean>(false);
  const [showGmapsLegsModal, setShowGmapsLegsModal] = useState<boolean>(false);
  const [showConfirmClearModal, setShowConfirmClearModal] = useState<boolean>(false);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(STORAGE_KEY_THEME, darkMode ? 'dark' : 'light');
    } catch {
      // Ignore
    }
  }, [darkMode]);

  // Persist complete active route state in localStorage
  useEffect(() => {
    try {
      const stateToPersist: PersistedRouteState = {
        stops,
        basePoint,
        isOptimized,
        zoneFilter,
        blockSize,
        routeGeometry,
        osrmTotals,
      };
      window.localStorage.setItem(STORAGE_KEY_ROUTE_STATE, JSON.stringify(stateToPersist));
    } catch {
      // Ignore quota errors
    }
  }, [stops, basePoint, isOptimized, zoneFilter, blockSize, routeGeometry, osrmTotals]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_WA_TEMPLATE, whatsappTemplate);
    } catch {
      // Ignore
    }
  }, [whatsappTemplate]);

  // Recalculate street geometry whenever zone filter or stop coordinates change after optimization
  const refreshStreetRoute = useCallback(
    async (activeBase: BasePoint, orderedZoneStops: ClientStop[]) => {
      const res = await fetchOsrmRoute(activeBase, orderedZoneStops);
      setRouteGeometry(res.geometry);
      setOsrmTotals({
        distanceKm: res.distanceKm,
        durationMin: res.durationMinutes,
      });
    },
    []
  );

  // Hydrate route automatically when opened with #ruta=... link from office
  const applyHashRouteIfPresent = useCallback(async () => {
    const hash = window.location.hash;
    if (!hash || !hash.includes('ruta=')) return;

    const decoded = decodeRouteFromHash(hash);
    if (!decoded || decoded.stops.length === 0) {
      setNotice({
        type: 'error',
        text: 'No se pudo leer el enlace de ruta (#ruta=). Solicita un nuevo enlace o archivo .json.',
      });
      return;
    }

    setStops(decoded.stops);
    setBasePoint(decoded.basePoint);
    setBaseLabelDraft(decoded.basePoint.label);
    setZoneFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setSelectedStopId(null);
    setIsOptimized(decoded.isOptimized);
    setIsPanelCollapsed(true);

    // Clean URL hash so page reloads keep working cleanly with localStorage
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      // Ignore history restriction
    }

    setNotice({
      type: 'info',
      text: `Ruta recibida desde enlace (${decoded.stops.length} paradas listas en el mapa).`,
    });

    await refreshStreetRoute(decoded.basePoint, decoded.stops);
  }, [refreshStreetRoute]);

  useEffect(() => {
    applyHashRouteIfPresent();
    const onHashChange = () => {
      applyHashRouteIfPresent();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [applyHashRouteIfPresent]);

  // Global Ctrl+V handler to paste images anywhere on screen for instant OCR
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            setIsPanelCollapsed(false);
            setImportTab('photo');
            setPastedImageFile(blob);
            setNotice({
              type: 'info',
              text: 'Imagen pegada desde el portapapeles. Extrayendo direcciones con OCR...',
            });
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  // Stops matching the selected Los Cabos Zone
  const zoneStops = useMemo(() => {
    if (zoneFilter === 'all') return stops;
    return stops.filter((s) => s.zone === zoneFilter);
  }, [stops, zoneFilter]);

  // Stops filtered by search + visit status for display in the list
  const visibleStops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return zoneStops.filter((stop) => {
      if (statusFilter !== 'all' && stop.status !== statusFilter) return false;
      if (!q) return true;
      return (
        stop.acreditado.toLowerCase().includes(q) ||
        stop.colonia.toLowerCase().includes(q) ||
        stop.cleanedAddress.toLowerCase().includes(q) ||
        stop.telefono.toLowerCase().includes(q)
      );
    });
  }, [zoneStops, statusFilter, searchQuery]);

  // Live metrics
  const metrics = useMemo(
    () =>
      computeRouteMetrics({
        allStops: zoneStops,
        base: basePoint,
        orderedStops: zoneStops,
        osrmDistanceKm: osrmTotals.distanceKm,
        osrmDurationMin: osrmTotals.durationMin,
      }),
    [zoneStops, basePoint, osrmTotals]
  );

  // 9-stop Google Maps navigation legs in exact optimized order
  const googleMapsLegs = useMemo(
    () => buildGoogleMapsLegUrls(basePoint, zoneStops, 9),
    [basePoint, zoneStops]
  );

  const handleLoadDemo = () => {
    const demoStops = createDemoLosCabosStops();
    setStops(demoStops);
    setZoneFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setIsOptimized(false);
    setSelectedStopId(null);
    setOsrmTotals({ distanceKm: null, durationMin: null });
    setRouteGeometry({ coordinates: [], source: 'fallback' });
    setNotice({
      type: 'info',
      text: '10 direcciones reales de Los Cabos cargadas y limpiadas. Haz clic en "Optimizar Ruta Ahora".',
    });
  };

  const handleFileSelected = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const parsedStops = parseSpreadsheetBuffer(buffer);
      if (parsedStops.length === 0) {
        setNotice({
          type: 'error',
          text: 'No se encontraron registros válidos en el archivo. Verifica las columnas Acreditado, Calle y Colonia.',
        });
        return;
      }
      setStops(parsedStops);
      setZoneFilter('all');
      setStatusFilter('all');
      setSearchQuery('');
      setIsOptimized(false);
      setSelectedStopId(null);
      setOsrmTotals({ distanceKm: null, durationMin: null });
      setRouteGeometry({ coordinates: [], source: 'fallback' });
      setNotice({
        type: 'info',
        text: `${parsedStops.length} clientes importados de "${file.name}" y limpiados automáticamente.`,
      });
    } catch {
      setNotice({
        type: 'error',
        text: 'Error al leer el archivo. Asegúrate de subir un formato .xlsx, .xls o .csv válido.',
      });
    }
  };

  const handleSaveBackupJson = () => {
    const jsonContent = buildRouteBackupJson({
      basePoint,
      stops,
      isOptimized,
    });
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateSlug = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `CaboRuta_Ruta_${dateSlug}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportBackupJson = async (file: File) => {
    try {
      const text = await file.text();
      const restored = parseRouteBackupJson(text);
      if (!restored || restored.stops.length === 0) {
        setNotice({
          type: 'error',
          text: 'El archivo .json no contiene una ruta válida de CaboRuta Pro.',
        });
        return;
      }
      setStops(restored.stops);
      setBasePoint(restored.basePoint);
      setBaseLabelDraft(restored.basePoint.label);
      setZoneFilter('all');
      setStatusFilter('all');
      setSearchQuery('');
      setSelectedStopId(null);
      setIsOptimized(restored.isOptimized);
      setIsPanelCollapsed(true);
      setNotice({
        type: 'info',
        text: `Respaldo cargado: ${restored.stops.length} paradas restauradas.`,
      });
      await refreshStreetRoute(restored.basePoint, restored.stops);
    } catch {
      setNotice({
        type: 'error',
        text: 'No se pudo abrir el archivo de ruta (.json).',
      });
    }
  };

  const handleUpdateBasePoint = async () => {
    if (!baseLabelDraft.trim()) return;
    const resolved = await geocodeBasePoint(baseLabelDraft);
    setBasePoint(resolved);
    setNotice({
      type: 'info',
      text: `Punto base fijado en: ${resolved.label}`,
    });
    if (isOptimized && zoneStops.length > 0) {
      await refreshStreetRoute(resolved, zoneStops);
    }
  };

  const optimizeGivenStops = async (
    targetAllStops: ClientStop[],
    activeZone: ZoneId = zoneFilter
  ) => {
    const targetZoneStops =
      activeZone === 'all' ? targetAllStops : targetAllStops.filter((s) => s.zone === activeZone);
    if (targetZoneStops.length === 0) return;

    setIsOptimizing(true);
    setOptimizeProgress({ done: 0, total: targetZoneStops.length });
    setNotice(null);

    try {
      const resolvedBase =
        baseLabelDraft.trim() !== basePoint.label
          ? await geocodeBasePoint(baseLabelDraft)
          : basePoint;
      setBasePoint(resolvedBase);

      // 1. Geocode any un-located stops strictly within Los Cabos bounding box (uses geocode_cache first)
      const geocodedZoneStops = await geocodeStopsBatch(targetZoneStops, (done, total) => {
        setOptimizeProgress({ done, total });
      });

      const validStops = geocodedZoneStops.filter(
        (s): s is ClientStop & { lat: number; lng: number } => s.lat !== null && s.lng !== null
      );

      // 2. Build real road distance matrix via OSRM Table API (or Haversine fallback)
      const matrixPoints = [{ lat: resolvedBase.lat, lng: resolvedBase.lng }, ...validStops];
      const osrmMatrix = await fetchOsrmDistanceMatrix(matrixPoints);
      const matrix = osrmMatrix ?? buildHaversineMatrix(resolvedBase, validStops);

      // 3. Solve TSP using Nearest Neighbor + 2-opt
      const bestOrderIndices = solveTspNearestNeighbor2Opt(matrix, true);
      const reorderedValid = bestOrderIndices.map((idx) => validStops[idx]);
      const ungeocoded = geocodedZoneStops.filter((s) => s.lat === null || s.lng === null);
      const optimizedZoneList = assignRouteBlocks([...reorderedValid, ...ungeocoded], blockSize);

      // Merge optimized zone stops back with stops from other zones
      const otherZoneStops = targetAllStops.filter(
        (s) => activeZone !== 'all' && s.zone !== activeZone
      );
      const nextAllStops = [...optimizedZoneList, ...otherZoneStops];
      setStops(nextAllStops);
      setIsOptimized(true);
      setIsPanelCollapsed(true);

      // 4. Fetch street-following route geometry via OSRM
      const routeRes = await fetchOsrmRoute(resolvedBase, optimizedZoneList);
      setRouteGeometry(routeRes.geometry);
      setOsrmTotals({
        distanceKm: routeRes.distanceKm,
        durationMin: routeRes.durationMinutes,
      });

      const nextMetrics = computeRouteMetrics({
        allStops: optimizedZoneList,
        base: resolvedBase,
        orderedStops: optimizedZoneList,
        osrmDistanceKm: routeRes.distanceKm,
        osrmDurationMin: routeRes.durationMinutes,
      });

      setNotice({
        type: 'info',
        text: `Ruta optimizada: ${optimizedZoneList.length} paradas · ${nextMetrics.totalDistanceKm} km · Ahorro de ${nextMetrics.distanceSavedKm} km.`,
      });
    } finally {
      setIsOptimizing(false);
      setOptimizeProgress(null);
    }
  };

  const handleOptimizeRoute = async () => {
    await optimizeGivenStops(stops, zoneFilter);
  };

  const handleCommitSmartDrafts = async (
    drafts: ParsedClientDraft[],
    mode: 'append' | 'replace'
  ) => {
    const newStops = draftsToClientStops(drafts);
    if (newStops.length === 0) return;

    const mergedStops =
      mode === 'append'
        ? [
            ...stops,
            ...newStops.map((s, idx) => ({
              ...s,
              originalOrder: stops.length + idx + 1,
            })),
          ]
        : newStops;

    setStops(mergedStops);
    setZoneFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setSelectedStopId(null);
    await optimizeGivenStops(mergedStops, 'all');
  };

  const handleChangeBlockSize = (nextSize: number | null) => {
    setBlockSize(nextSize);
    setStops((prev) => {
      if (zoneFilter === 'all') {
        return assignRouteBlocks(prev, nextSize);
      }
      const inZone = assignRouteBlocks(
        prev.filter((s) => s.zone === zoneFilter),
        nextSize
      );
      const outZone = prev.filter((s) => s.zone !== zoneFilter);
      return [...inZone, ...outZone];
    });
  };

  const handleDragStopPin = async (id: string, lat: number, lng: number) => {
    const targetStop = stops.find((s) => s.id === id);
    if (targetStop) {
      cacheStopCoordinates(targetStop, lat, lng, 'manual');
    }

    const nextAllStops = stops.map((s) =>
      s.id === id ? { ...s, lat, lng, geocodePrecision: 'manual' as const } : s
    );
    const updatedZoneStops =
      zoneFilter === 'all' ? nextAllStops : nextAllStops.filter((s) => s.zone === zoneFilter);

    setStops(nextAllStops);
    await refreshStreetRoute(basePoint, updatedZoneStops);
    setNotice({
      type: 'info',
      text: 'Pin reubicado manualmente y guardado en caché. Ruta recalculada.',
    });
  };

  const handleUpdateStatus = (id: string, status: VisitStatus) => {
    const nowTime = new Date().toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setStops((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status,
              statusUpdatedAt: status === 'pending' ? null : nowTime,
            }
          : s
      )
    );
  };

  const handleUpdateNotes = (id: string, notes: string) => {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, notes } : s)));
  };

  const handleSelectStop = (id: string) => {
    setSelectedStopId(id);
    if (window.innerWidth < 1024) {
      setMobileTab('map');
    }
  };

  const handleClearStops = () => {
    setStops([]);
    setBasePoint(DEFAULT_BASE_POINT);
    setBaseLabelDraft(DEFAULT_BASE_POINT.label);
    setZoneFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setBlockSize(null);
    setIsOptimized(false);
    setSelectedStopId(null);
    setRouteGeometry({ coordinates: [], source: 'fallback' });
    setOsrmTotals({ distanceKm: null, durationMin: null });
    setIsPanelCollapsed(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY_ROUTE_STATE);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY_STOPS);
    } catch {
      // Ignore
    }
    setNotice({
      type: 'info',
      text: 'Ruta limpiada. El caché de direcciones se conservó para futuras rutas.',
    });
  };

  const transferUrl = useMemo(() => {
    if (zoneStops.length === 0) return '';
    return buildRouteShareUrl({
      basePoint,
      stops: zoneStops,
      isOptimized,
    });
  }, [basePoint, zoneStops, isOptimized]);

  const shareSummaryText = useMemo(
    () =>
      buildRouteShareSummary({
        base: basePoint,
        stops: zoneStops,
        metrics,
        transferUrl: transferUrl || undefined,
      }),
    [basePoint, zoneStops, metrics, transferUrl]
  );

  const closureSummaryText = useMemo(
    () =>
      buildClosureWhatsappSummary({
        base: basePoint,
        stops: zoneStops,
        metrics,
      }),
    [basePoint, zoneStops, metrics]
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#090D16] dark:text-slate-100">
      <TopBar
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        hasStops={stops.length > 0}
        onLoadDemo={handleLoadDemo}
        onOpenClosureReport={() => setShowClosureModal(true)}
        onOpenShareWhatsapp={() => setShowShareModal(true)}
      />

      <MetricsDashboard metrics={metrics} isOptimized={isOptimized} />

      {/* Main Split Workspace */}
      <main className="relative flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Left Panel: Management, Search & Client Cards */}
        <section
          aria-label="Gestión de clientes y paradas"
          className={`${
            mobileTab === 'list' ? 'flex' : 'hidden'
          } lg:flex w-full lg:w-[460px] xl:w-[500px] shrink-0 flex-col min-h-0 border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-[#090D16]`}
        >
          <ExcelImportPanel
            activeTab={importTab}
            onChangeTab={setImportTab}
            baseLabel={baseLabelDraft}
            onChangeBaseLabel={setBaseLabelDraft}
            onUpdateBasePoint={handleUpdateBasePoint}
            zoneFilter={zoneFilter}
            onChangeZoneFilter={(z) => {
              setZoneFilter(z);
              setIsOptimized(false);
              setRouteGeometry({ coordinates: [], source: 'fallback' });
              setOsrmTotals({ distanceKm: null, durationMin: null });
            }}
            blockSize={blockSize}
            onChangeBlockSize={handleChangeBlockSize}
            onFileSelected={handleFileSelected}
            onLoadDemo={handleLoadDemo}
            onOptimize={handleOptimizeRoute}
            onCommitSmartDrafts={handleCommitSmartDrafts}
            pastedImageFile={pastedImageFile}
            onClearPastedImage={() => setPastedImageFile(null)}
            isOptimizing={isOptimizing}
            optimizeProgress={optimizeProgress}
            stopsCount={zoneStops.length}
            isCollapsed={isPanelCollapsed}
            onToggleCollapse={() => setIsPanelCollapsed((c) => !c)}
          />

          {/* Inline Notification Banner */}
          {notice && (
            <div
              role="status"
              className={`flex items-center justify-between gap-2 border-b px-4 py-2 text-xs font-medium ${
                notice.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200'
                  : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {notice.type === 'error' ? (
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                )}
                <span className="truncate">{notice.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="shrink-0 text-[11px] font-semibold underline hover:opacity-80"
              >
                Ocultar
              </button>
            </div>
          )}

          {/* Search, Google Maps Legs, Template & Clear Toolbar */}
          {stops.length > 0 && (
            <div className="space-y-2 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-[#0F172A]">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar acreditado, colonia o teléfono..."
                    aria-label="Buscar cliente o colonia"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowTemplateModal(true)}
                  title="Editar plantilla de WhatsApp"
                  aria-label="Editar mensaje de WhatsApp"
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <MessageSquareText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span className="hidden sm:inline">Plantilla WA</span>
                </button>
              </div>

              {/* Quick Field Actions Row: Google Maps Multi-Stop Legs + Discreet Clear/New Route */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowGmapsLegsModal(true)}
                  disabled={googleMapsLegs.length === 0}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 text-[11px] font-semibold text-sky-800 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60"
                >
                  <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                  Abrir tramo en Google Maps
                  {googleMapsLegs.length > 0 && (
                    <span className="font-mono text-[10px] opacity-80">
                      ({googleMapsLegs.length})
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmClearModal(true)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 whitespace-nowrap dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  Limpiar / Nueva Ruta
                </button>
              </div>

              {/* Status Segmented Filter */}
              <div
                role="group"
                aria-label="Filtrar paradas por estatus"
                className="flex items-center gap-1 overflow-x-auto pb-0.5"
              >
                {(
                  [
                    { id: 'all', label: `Todos (${zoneStops.length})` },
                    { id: 'pending', label: `Pendientes (${metrics.pendingCount})` },
                    { id: 'collected', label: `Cobrados (${metrics.collectedCount})` },
                    { id: 'promise', label: `Promesa (${metrics.promiseCount})` },
                    { id: 'not_found', label: `No loc. (${metrics.notFoundCount})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      statusFilter === tab.id
                        ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stop List / Empty State */}
          <div className="custom-scrollbar flex-1 overflow-y-auto p-4 pb-20 lg:pb-4">
            {stops.length === 0 ? (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-800 dark:bg-[#0F172A]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                  <Route className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">
                  Prepara tu ruta de cobranza en Los Cabos
                </h2>
                <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Importa tu Excel, pega una lista de texto, escanea una foto o abre un respaldo <code className="font-mono">.json</code> para comenzar en segundos.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadDemo}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                  >
                    <Database className="h-4 w-4" aria-hidden="true" />
                    Cargar Datos de Prueba (Los Cabos)
                  </button>

                  <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                    <FolderOpen className="h-4 w-4" aria-hidden="true" />
                    Abrir archivo de ruta (.json)
                    <input
                      type="file"
                      accept=".json,application/json"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          await handleImportBackupJson(file);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : visibleStops.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-[#0F172A]">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Ningún cliente coincide con el filtro actual
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="mt-2 text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
                >
                  Restablecer filtros
                </button>
              </div>
            ) : (
              <div className="space-y-3" data-testid="stop-list">
                {visibleStops.map((stop, idx) => (
                  <StopCard
                    key={stop.id}
                    stop={stop}
                    displayOrder={stop.visitOrder ?? idx + 1}
                    isSelected={selectedStopId === stop.id}
                    whatsappTemplate={whatsappTemplate}
                    onSelectStop={handleSelectStop}
                    onUpdateStatus={handleUpdateStatus}
                    onUpdateNotes={handleUpdateNotes}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Panel: Full-Screen Interactive Leaflet Map */}
        <section
          aria-label="Mapa interactivo de rutas en Los Cabos"
          className={`${
            mobileTab === 'map' ? 'flex' : 'hidden'
          } lg:flex flex-1 min-h-0 relative`}
        >
          <RouteMap
            basePoint={basePoint}
            stops={zoneStops}
            routeGeometry={routeGeometry}
            darkMode={darkMode}
            selectedStopId={selectedStopId}
            onSelectStop={setSelectedStopId}
            onDragStopPin={handleDragStopPin}
          />
        </section>
      </main>

      {/* Mobile Bottom Navigation Switcher (Compact <= 56px to respect 15% mobile sticky cap) */}
      <nav
        aria-label="Vista móvil"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-14 grid-cols-3 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-[#0F172A]/95"
      >
        <button
          type="button"
          onClick={() => setMobileTab('list')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            mobileTab === 'list'
              ? 'text-sky-600 dark:text-sky-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <ListOrdered className="h-4 w-4" aria-hidden="true" />
          <span>Lista ({visibleStops.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('map')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            mobileTab === 'map'
              ? 'text-sky-600 dark:text-sky-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <MapIcon className="h-4 w-4" aria-hidden="true" />
          <span>Mapa</span>
        </button>

        <button
          type="button"
          onClick={handleOptimizeRoute}
          disabled={zoneStops.length === 0 || isOptimizing}
          className="flex flex-col items-center justify-center gap-0.5 bg-sky-600 text-[11px] font-semibold text-white disabled:opacity-45 dark:bg-sky-500 dark:text-slate-950"
        >
          <Route className="h-4 w-4" aria-hidden="true" />
          <span>{isOptimizing ? 'Optimizando...' : 'Optimizar'}</span>
        </button>
      </nav>

      <OfflineIndicator />

      <ShareWhatsappModal
        isOpen={showShareModal}
        summaryText={shareSummaryText}
        transferUrl={transferUrl}
        onSaveBackupJson={handleSaveBackupJson}
        onImportBackupJson={handleImportBackupJson}
        onClose={() => setShowShareModal(false)}
      />

      <ClosureReportModal
        isOpen={showClosureModal}
        metrics={metrics}
        closureSummaryText={closureSummaryText}
        onDownloadExcel={() => downloadClosureExcel(stops)}
        onClose={() => setShowClosureModal(false)}
      />

      <GoogleMapsLegsModal
        isOpen={showGmapsLegsModal}
        legs={googleMapsLegs}
        onClose={() => setShowGmapsLegsModal(false)}
      />

      <ConfirmClearModal
        isOpen={showConfirmClearModal}
        onConfirm={handleClearStops}
        onCancel={() => setShowConfirmClearModal(false)}
      />

      <WhatsappTemplateModal
        isOpen={showTemplateModal}
        template={whatsappTemplate}
        onSaveTemplate={setWhatsappTemplate}
        onClose={() => setShowTemplateModal(false)}
      />
    </div>
  );
}
