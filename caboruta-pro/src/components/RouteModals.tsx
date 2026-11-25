import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Link2,
  MessageCircle,
  Navigation,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import type { RouteMetrics } from '../types/route';
import { DEFAULT_WHATSAPP_TEMPLATE, type GoogleMapsLeg } from '../utils/whatsappShare';

interface ShareWhatsappModalProps {
  isOpen: boolean;
  summaryText: string;
  transferUrl: string;
  onSaveBackupJson: () => void;
  onImportBackupJson: (file: File) => Promise<void>;
  onClose: () => void;
}

export const ShareWhatsappModal: React.FC<ShareWhatsappModalProps> = ({
  isOpen,
  summaryText,
  transferUrl,
  onSaveBackupJson,
  onImportBackupJson,
  onClose,
}) => {
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(transferUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleJsonChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onImportBackupJson(file);
      e.target.value = '';
      onClose();
    }
  };

  const waUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-wa-title"
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#111827]">
        <div className="flex items-center justify-between gap-3">
          <h2 id="share-wa-title" className="text-base font-bold text-slate-900 dark:text-white">
            Enviar Ruta al Celular (Link WhatsApp)
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          La ruta completa va comprimida dentro del enlace (<code className="font-mono">#ruta=...</code>). Al abrirlo en el celular se cargan los pines y el mapa al instante sin servidor.
        </p>

        {/* Direct Link Box */}
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/60 p-2 dark:border-sky-900/70 dark:bg-sky-950/30">
          <Link2 className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          <input
            type="text"
            readOnly
            value={transferUrl}
            aria-label="Enlace directo de ruta"
            className="w-full bg-transparent font-mono text-[11px] text-slate-800 focus:outline-hidden dark:text-slate-200"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-white px-2.5 text-[11px] font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {copiedLink ? (
              <>
                <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                Copiado
              </>
            ) : (
              'Copiar Link'
            )}
          </button>
        </div>

        <textarea
          readOnly
          value={summaryText}
          rows={8}
          aria-label="Resumen de ruta para WhatsApp"
          className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />

        {/* Offline JSON Backup Row */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-900/60">
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
            Respaldo offline (.json):
          </span>
          <div className="flex items-center gap-2">
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleJsonChange}
              className="sr-only"
              id="route-json-import"
            />
            <button
              type="button"
              onClick={onSaveBackupJson}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              Guardar archivo de ruta
            </button>
            <label
              htmlFor="route-json-import"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Abrir archivo de ruta
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCopyText}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {copiedText ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                Mensaje copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copiar mensaje
              </>
            )}
          </button>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Enviar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
};

interface ClosureReportModalProps {
  isOpen: boolean;
  metrics: RouteMetrics;
  closureSummaryText: string;
  onDownloadExcel: () => void;
  onClose: () => void;
}

export const ClosureReportModal: React.FC<ClosureReportModalProps> = ({
  isOpen,
  metrics,
  closureSummaryText,
  onDownloadExcel,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const totalVisited = metrics.collectedCount + metrics.promiseCount + metrics.notFoundCount;
  const pendingOrPromised = metrics.pendingCount + metrics.promiseCount;
  const waGroupUrl = `https://wa.me/?text=${encodeURIComponent(closureSummaryText)}`;

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(closureSummaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="closure-report-title"
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#111827]">
        <div className="flex items-center justify-between gap-3">
          <h2 id="closure-report-title" className="text-base font-bold text-slate-900 dark:text-white">
            Resumen de Cierre de Caja / Cobranza
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar resumen de cierre"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Visual Summary Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Total visitados
            </span>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
              {totalVisited}/{metrics.totalClients}
            </p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/70 dark:bg-emerald-950/30">
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              Total cobrados
            </span>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {metrics.collectedCount}
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/70 dark:bg-amber-950/30">
            <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
              Pend. / Reprog.
            </span>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
              {pendingOrPromised}
            </p>
          </div>

          <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 dark:border-rose-900/70 dark:bg-rose-950/30">
            <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
              No localizados
            </span>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-rose-700 dark:text-rose-400">
              {metrics.notFoundCount}
            </p>
          </div>
        </div>

        <label
          htmlFor="closure-summary-textarea"
          className="mt-4 block text-xs font-semibold text-slate-700 dark:text-slate-200"
        >
          Texto para el grupo de WhatsApp de la empresa
        </label>
        <textarea
          id="closure-summary-textarea"
          readOnly
          value={closureSummaryText}
          rows={7}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  Resumen copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Copiar resumen
                </>
              )}
            </button>

            <a
              href={waGroupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              WhatsApp
            </a>
          </div>

          <button
            type="button"
            onClick={() => {
              onDownloadExcel();
              onClose();
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Descargar Excel (.xlsx)
          </button>
        </div>
      </div>
    </div>
  );
};

interface GoogleMapsLegsModalProps {
  isOpen: boolean;
  legs: GoogleMapsLeg[];
  onClose: () => void;
}

export const GoogleMapsLegsModal: React.FC<GoogleMapsLegsModalProps> = ({
  isOpen,
  legs,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gmaps-legs-title"
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#111827]">
        <div className="flex items-center justify-between gap-3">
          <h2 id="gmaps-legs-title" className="text-base font-bold text-slate-900 dark:text-white">
            Abrir Tramo en Google Maps
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar tramos de Google Maps"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Google Maps admite hasta 9 paradas continuas por enlace. Selecciona el tramo en orden exacto:
        </p>

        <div className="mt-3 space-y-2">
          {legs.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Primero optimiza o ubica tus paradas en el mapa.
            </p>
          ) : (
            legs.map((leg) => (
              <a
                key={leg.legIndex}
                href={leg.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 transition-colors hover:border-sky-400 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sky-600 dark:hover:bg-sky-950/40"
              >
                <div>
                  <span className="font-bold">Tramo {leg.legIndex}</span>
                  <span className="ml-2 font-mono text-[11px] font-normal text-slate-500 tabular-nums dark:text-slate-400">
                    Paradas #{leg.startOrder}–#{leg.endOrder} ({leg.stopCount})
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400">
                  <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                  Navegar
                </span>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

interface ConfirmClearModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmClearModal: React.FC<ConfirmClearModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-clear-title"
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#111827]">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="confirm-clear-title" className="text-base font-bold text-slate-900 dark:text-white">
              ¿Limpiar e iniciar nueva ruta?
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Se borrarán los clientes, notas y cobros del día actual. El caché de direcciones encontradas se conserva para ubicaciones instantáneas mañana.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg border border-slate-200 px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="h-9 rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700"
          >
            Sí, limpiar ruta
          </button>
        </div>
      </div>
    </div>
  );
};

interface WhatsappTemplateModalProps {
  isOpen: boolean;
  template: string;
  onSaveTemplate: (next: string) => void;
  onClose: () => void;
}

export const WhatsappTemplateModal: React.FC<WhatsappTemplateModalProps> = ({
  isOpen,
  template,
  onSaveTemplate,
  onClose,
}) => {
  const [draft, setDraft] = useState(template);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-template-title"
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#111827]">
        <div className="flex items-center justify-between gap-3">
          <h2 id="wa-template-title" className="text-base font-bold text-slate-900 dark:text-white">
            Mensaje Predefinido de WhatsApp
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar editor de plantilla"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Variables disponibles: <code className="font-mono">[Nombre]</code>,{' '}
          <code className="font-mono">[Colonia]</code>, <code className="font-mono">[Dirección]</code>,{' '}
          <code className="font-mono">[Parada]</code>.
        </p>

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          aria-label="Texto de plantilla WhatsApp"
          className="mt-3 w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_WHATSAPP_TEMPLATE)}
            className="inline-flex h-9 items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Restaurar predeterminado
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveTemplate(draft);
                onClose();
              }}
              className="h-9 rounded-lg bg-sky-600 px-4 text-xs font-semibold text-white hover:bg-sky-700"
            >
              Guardar plantilla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
