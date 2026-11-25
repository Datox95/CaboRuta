import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Database,
  FileSpreadsheet,
  FileText,
  FileUp,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Route,
  Sparkles,
} from 'lucide-react';
import type { ZoneId } from '../types/route';
import {
  parseRawTextToClients,
  SAMPLE_WHATSAPP_LIST,
  type ParsedClientDraft,
} from '../utils/smartTextParser';
import { extractTextFromImageOcr, type OcrProgressUpdate } from '../services/ocrService';
import { SmartImportPreview } from './SmartImportPreview';

export type ImportTabId = 'excel' | 'text' | 'photo';

interface ExcelImportPanelProps {
  activeTab: ImportTabId;
  onChangeTab: (tab: ImportTabId) => void;
  baseLabel: string;
  onChangeBaseLabel: (val: string) => void;
  onUpdateBasePoint: () => Promise<void>;
  zoneFilter: ZoneId;
  onChangeZoneFilter: (zone: ZoneId) => void;
  blockSize: number | null;
  onChangeBlockSize: (size: number | null) => void;
  onFileSelected: (file: File) => Promise<void>;
  onLoadDemo: () => void;
  onOptimize: () => Promise<void>;
  onCommitSmartDrafts: (drafts: ParsedClientDraft[], mode: 'append' | 'replace') => Promise<void>;
  pastedImageFile: File | Blob | null;
  onClearPastedImage: () => void;
  isOptimizing: boolean;
  optimizeProgress: { done: number; total: number } | null;
  stopsCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const ExcelImportPanel: React.FC<ExcelImportPanelProps> = ({
  activeTab,
  onChangeTab,
  baseLabel,
  onChangeBaseLabel,
  onUpdateBasePoint,
  zoneFilter,
  onChangeZoneFilter,
  blockSize,
  onChangeBlockSize,
  onFileSelected,
  onLoadDemo,
  onOptimize,
  onCommitSmartDrafts,
  pastedImageFile,
  onClearPastedImage,
  isOptimizing,
  optimizeProgress,
  stopsCount,
  isCollapsed,
  onToggleCollapse,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ocrFileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  // Tab 2: Text & Clipboard state
  const [rawText, setRawText] = useState('');
  const [textFeedback, setTextFeedback] = useState<string | null>(null);

  // Tab 3: OCR state
  const [ocrProgress, setOcrProgress] = useState<OcrProgressUpdate | null>(null);
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Shared editable preview drafts
  const [drafts, setDrafts] = useState<ParsedClientDraft[]>([]);
  const [mergeMode, setMergeMode] = useState<'append' | 'replace'>(
    stopsCount > 0 ? 'append' : 'replace'
  );

  useEffect(() => {
    setMergeMode(stopsCount > 0 ? 'append' : 'replace');
  }, [stopsCount]);

  // Process image pasted via Ctrl+V anywhere on screen
  useEffect(() => {
    if (!pastedImageFile) return;
    processOcrImage(pastedImageFile);
    onClearPastedImage();
  }, [pastedImageFile]);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await onFileSelected(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onFileSelected(file);
      e.target.value = '';
    }
  };

  const handlePasteFromClipboard = async () => {
    setTextFeedback(null);
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        setTextFeedback('Tu navegador bloqueó la lectura directa. Pega el texto manualmente en el recuadro.');
        return;
      }
      const clipText = await navigator.clipboard.readText();
      if (!clipText.trim()) {
        setTextFeedback('El portapapeles está vacío. Copia primero una lista de WhatsApp o Excel.');
        return;
      }
      setRawText(clipText);
      const parsed = parseRawTextToClients(clipText);
      setDrafts(parsed);
      setTextFeedback(
        parsed.length > 0
          ? `${parsed.length} clientes detectados automáticamente desde el portapapeles.`
          : 'Texto pegado. Revisa el formato y presiona "Detectar Clientes".'
      );
    } catch {
      setTextFeedback('Permiso de portapapeles denegado. Usa Ctrl+V o mantén presionado dentro del recuadro.');
    }
  };

  const handleAnalyzeText = () => {
    setTextFeedback(null);
    if (!rawText.trim()) {
      setTextFeedback('Pega o escribe al menos una dirección antes de analizar.');
      return;
    }
    const parsed = parseRawTextToClients(rawText);
    setDrafts(parsed);
    if (parsed.length === 0) {
      setTextFeedback('No se pudieron detectar direcciones. Incluye nombre, calle/colonia o teléfono.');
    }
  };

  const processOcrImage = async (file: File | Blob) => {
    setOcrError(null);
    setIsScanningOcr(true);
    setOcrProgress({ status: 'Iniciando lectura OCR...', progressPct: 5 });

    const objectUrl = URL.createObjectURL(file);
    setOcrPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });

    try {
      const extractedText = await extractTextFromImageOcr(file, (update) => {
        setOcrProgress(update);
      });
      setRawText(extractedText);
      const parsed = parseRawTextToClients(extractedText);
      setDrafts(parsed);
      if (parsed.length === 0) {
        setOcrError(
          'Se leyó el texto de la imagen pero no se detectaron clientes claros. Puedes editarlo en la pestaña "Pegar Texto".'
        );
      }
    } catch (err) {
      setOcrError(
        err instanceof Error
          ? err.message
          : 'No se pudo procesar la imagen con OCR. Verifica tu conexión a internet.'
      );
    } finally {
      setIsScanningOcr(false);
    }
  };

  const handleImageInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processOcrImage(file);
      e.target.value = '';
    }
  };

  const handleImageDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingImage(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await processOcrImage(file);
    }
  };

  const handleUpdateDraft = (id: string, patch: Partial<ParsedClientDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const handleRemoveDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const handleAddEmptyDraft = () => {
    setDrafts((prev) => [
      ...prev,
      {
        id: `draft-manual-${Date.now().toString(36)}`,
        acreditado: '',
        calle: '',
        numeroExterior: '',
        numeroInterior: '',
        colonia: 'Centro',
        ciudad: 'Cabo San Lucas',
        estado: 'Baja California Sur, México',
        codigoPostal: '',
        telefono: '',
        rawLine: '',
      },
    ]);
  };

  const handleConfirmAndOptimize = async () => {
    if (drafts.length === 0) return;
    await onCommitSmartDrafts(drafts, mergeMode);
    setDrafts([]);
    setRawText('');
    setTextFeedback(null);
  };

  return (
    <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0F172A]">
      {/* Compact Header Row */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!isCollapsed}
          className="flex items-center gap-2 text-left text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
        >
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
          ) : (
            <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
          )}
          <span>Cargar Clientes y Configuración</span>
        </button>

        <button
          type="button"
          onClick={onOptimize}
          disabled={stopsCount === 0 || isOptimizing}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950"
        >
          {isOptimizing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>
                {optimizeProgress
                  ? `Ubicando ${optimizeProgress.done}/${optimizeProgress.total}`
                  : 'Optimizando...'}
              </span>
            </>
          ) : (
            <>
              <Route className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Optimizar Ruta Ahora</span>
            </>
          )}
        </button>
      </div>

      {/* Expandable Controls */}
      {!isCollapsed && (
        <div className="space-y-3 px-4 pb-4 pt-1">
          {/* 3 Clean Mobile-Friendly Import Tabs */}
          <div
            role="tablist"
            aria-label="Métodos de carga de clientes"
            className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'excel'}
              onClick={() => onChangeTab('excel')}
              className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'excel'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>Subir Excel</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'text'}
              onClick={() => onChangeTab('text')}
              className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'text'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <span>Pegar Texto</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'photo'}
              onClick={() => onChangeTab('photo')}
              className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'photo'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <Camera className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>Escanear Foto</span>
            </button>
          </div>

          {/* Tab 1: Subir Excel */}
          {activeTab === 'excel' && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`rounded-xl border border-dashed p-3.5 text-center transition-colors ${
                isDragging
                  ? 'border-sky-500 bg-sky-50/70 dark:border-sky-400 dark:bg-sky-950/30'
                  : 'border-slate-300 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="sr-only"
                id="excel-file-upload"
              />
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between sm:text-left">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    <FileUp className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      Arrastra tu Excel (.xlsx, .xls, .csv) aquí
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Limpieza automática de Baja California Sur, San José y calles SIN NOMBRE
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label
                    htmlFor="excel-file-upload"
                    className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Elegir archivo
                  </label>
                  <button
                    type="button"
                    onClick={onLoadDemo}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 text-xs font-medium text-sky-700 hover:bg-sky-100 whitespace-nowrap dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60"
                  >
                    <Database className="h-3.5 w-3.5" aria-hidden="true" />
                    Datos de Prueba
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Pegar Texto */}
          {activeTab === 'text' && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white shadow-xs transition-colors hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                >
                  <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
                  Pegar del Portapapeles
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRawText(SAMPLE_WHATSAPP_LIST);
                    const parsed = parseRawTextToClients(SAMPLE_WHATSAPP_LIST);
                    setDrafts(parsed);
                    setTextFeedback(`${parsed.length} clientes de ejemplo detectados.`);
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Sparkles className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                  Probar con texto de WhatsApp
                </button>
              </div>

              <div>
                <label htmlFor="smart-text-input" className="sr-only">
                  Pega listas de WhatsApp, mensajes o bloques de Excel
                </label>
                <textarea
                  id="smart-text-input"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={5}
                  placeholder="Pega aquí mensajes de WhatsApp o filas copiadas de Excel. Ej:&#10;Juan Pérez - Mza 14 Lte 8 Col. Mesa Colorada, CSL 23473 Tel 6241428810&#10;Carlos Mendoza | Blvd. Mijares 48 | San José del Cabo 23400 | 6241553920"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Detecta teléfonos 624, C.P. 234xx, MZA/LTE/COTO/SIN NOMBRE.
                </span>
                <button
                  type="button"
                  onClick={handleAnalyzeText}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 text-xs font-semibold text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950"
                >
                  Detectar Clientes
                </button>
              </div>

              {textFeedback && (
                <p className="text-[11px] font-medium text-sky-700 dark:text-sky-300">
                  {textFeedback}
                </p>
              )}
            </div>
          )}

          {/* Tab 3: Escanear Foto (OCR Tesseract.js CDN) */}
          {activeTab === 'photo' && (
            <div className="space-y-2.5">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingImage(true);
                }}
                onDragLeave={() => setIsDraggingImage(false)}
                onDrop={handleImageDrop}
                className={`rounded-xl border border-dashed p-3.5 text-center transition-colors ${
                  isDraggingImage
                    ? 'border-amber-500 bg-amber-50/60 dark:border-amber-400 dark:bg-amber-950/20'
                    : 'border-slate-300 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/60'
                }`}
              >
                <input
                  ref={ocrFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageInputChange}
                  className="sr-only"
                  id="ocr-image-upload"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageInputChange}
                  className="sr-only"
                  id="ocr-camera-capture"
                />

                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Sube captura de pantalla, foto de hoja o pega con Ctrl+V
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Lectura OCR 100% en tu dispositivo en español (sin enviar datos a servidores)
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label
                    htmlFor="ocr-camera-capture"
                    className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
                    Tomar Foto
                  </label>
                  <label
                    htmlFor="ocr-image-upload"
                    className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <ImageIcon className="h-4 w-4" aria-hidden="true" />
                    Subir Captura
                  </label>
                </div>
              </div>

              {/* OCR Progress Bar */}
              {isScanningOcr && ocrProgress && (
                <div
                  role="status"
                  className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 dark:border-amber-900/60 dark:bg-amber-950/30"
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      {ocrProgress.status}
                    </span>
                    <span className="font-mono tabular-nums">{ocrProgress.progressPct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-amber-200/70 dark:bg-amber-950">
                    <div
                      className="h-full rounded-full bg-amber-600 transition-all duration-200 dark:bg-amber-400"
                      style={{ width: `${ocrProgress.progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {ocrError && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{ocrError}</p>
              )}

              {ocrPreviewUrl && !isScanningOcr && (
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
                  <img
                    src={ocrPreviewUrl}
                    alt="Vista previa de imagen escaneada"
                    className="h-12 w-12 rounded-md object-cover border border-slate-200 dark:border-slate-700"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                      Imagen procesada con OCR
                    </p>
                    <button
                      type="button"
                      onClick={() => onChangeTab('text')}
                      className="text-[11px] font-medium text-sky-600 hover:underline dark:text-sky-400"
                    >
                      Ver o editar texto extraído
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Editable Preview List/Table for Text & Photo imports */}
          {(activeTab === 'text' || activeTab === 'photo') && (
            <SmartImportPreview
              drafts={drafts}
              hasExistingStops={stopsCount > 0}
              mergeMode={mergeMode}
              onChangeMergeMode={setMergeMode}
              onUpdateDraft={handleUpdateDraft}
              onRemoveDraft={handleRemoveDraft}
              onAddEmptyDraft={handleAddEmptyDraft}
              onClearDrafts={() => setDrafts([])}
              onConfirmAndOptimize={handleConfirmAndOptimize}
              isOptimizing={isOptimizing}
            />
          )}

          {/* Base Point Input */}
          <div>
            <label
              htmlFor="base-point-input"
              className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300"
            >
              Punto Base (Salida y Retorno)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <div className="relative flex-1">
                <MapPin
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="base-point-input"
                  type="text"
                  value={baseLabel}
                  onChange={(e) => onChangeBaseLabel(e.target.value)}
                  placeholder="Plaza Puerto Paraiso, Cabo San Lucas..."
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <button
                type="button"
                onClick={onUpdateBasePoint}
                className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Fijar Base
              </button>
            </div>
          </div>

          {/* Zone Segmented Filter & Block Splitting */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              role="group"
              aria-label="Filtrar por zona de Los Cabos"
              className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800/80"
            >
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'csl', label: 'Solo Cabo San Lucas' },
                  { id: 'sjc', label: 'Solo San José del Cabo' },
                ] as const
              ).map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => onChangeZoneFilter(z.id)}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                    zoneFilter === z.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <label
                htmlFor="block-size-select"
                className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
              >
                Bloques:
              </label>
              <select
                id="block-size-select"
                value={blockSize ?? ''}
                onChange={(e) =>
                  onChangeBlockSize(e.target.value ? Number(e.target.value) : null)
                }
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-sky-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">Ruta única</option>
                <option value="8">Bloques de 8</option>
                <option value="12">Bloques de 12</option>
                <option value="15">Bloques de 15</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
