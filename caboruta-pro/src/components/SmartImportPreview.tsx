import React from 'react';
import { Check, Plus, Route, Trash2, X } from 'lucide-react';
import type { ParsedClientDraft } from '../utils/smartTextParser';

interface SmartImportPreviewProps {
  drafts: ParsedClientDraft[];
  hasExistingStops: boolean;
  mergeMode: 'append' | 'replace';
  onChangeMergeMode: (mode: 'append' | 'replace') => void;
  onUpdateDraft: (id: string, patch: Partial<ParsedClientDraft>) => void;
  onRemoveDraft: (id: string) => void;
  onAddEmptyDraft: () => void;
  onClearDrafts: () => void;
  onConfirmAndOptimize: () => void;
  isOptimizing: boolean;
}

export const SmartImportPreview: React.FC<SmartImportPreviewProps> = ({
  drafts,
  hasExistingStops,
  mergeMode,
  onChangeMergeMode,
  onUpdateDraft,
  onRemoveDraft,
  onAddEmptyDraft,
  onClearDrafts,
  onConfirmAndOptimize,
  isOptimizing,
}) => {
  if (drafts.length === 0) return null;

  return (
    <div
      data-testid="smart-import-preview"
      className="mt-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900/70 dark:bg-sky-950/20"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
            Vista previa editable ({drafts.length}{' '}
            {drafts.length === 1 ? 'cliente detectado' : 'clientes detectados'})
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Corrige cualquier letra o número antes de ubicarlos en el mapa.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onAddEmptyDraft}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Fila
          </button>
          <button
            type="button"
            onClick={onClearDrafts}
            aria-label="Descartar vista previa"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Editable Rows */}
      <div className="custom-scrollbar mt-2.5 max-h-64 space-y-2 overflow-y-auto pr-0.5">
        {drafts.map((draft, idx) => (
          <div
            key={draft.id}
            className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-bold text-sky-700 tabular-nums dark:text-sky-400">
                #{idx + 1}
              </span>
              <input
                type="text"
                value={draft.acreditado}
                onChange={(e) => onUpdateDraft(draft.id, { acreditado: e.target.value })}
                aria-label={`Nombre del cliente ${idx + 1}`}
                placeholder="Nombre del acreditado"
                className="h-8 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <button
                type="button"
                onClick={() => onRemoveDraft(draft.id)}
                aria-label={`Eliminar fila ${idx + 1}`}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <input
                type="text"
                value={draft.calle}
                onChange={(e) => onUpdateDraft(draft.id, { calle: e.target.value })}
                aria-label={`Calle o lote de cliente ${idx + 1}`}
                placeholder="Calle / Mza / Lte"
                className="col-span-2 h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              />
              <input
                type="text"
                value={draft.colonia}
                onChange={(e) => onUpdateDraft(draft.id, { colonia: e.target.value })}
                aria-label={`Colonia de cliente ${idx + 1}`}
                placeholder="Colonia"
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              />
              <input
                type="text"
                value={draft.codigoPostal}
                onChange={(e) => onUpdateDraft(draft.id, { codigoPostal: e.target.value })}
                aria-label={`Código Postal de cliente ${idx + 1}`}
                placeholder="C.P. (234xx)"
                className="h-8 rounded-md border border-slate-200 bg-white px-2 font-mono text-[11px] tabular-nums text-slate-800 focus:border-sky-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              />
              <input
                type="text"
                value={draft.ciudad}
                onChange={(e) => onUpdateDraft(draft.id, { ciudad: e.target.value })}
                aria-label={`Ciudad de cliente ${idx + 1}`}
                placeholder="Ciudad"
                className="col-span-1 h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 sm:col-span-2"
              />
              <input
                type="text"
                value={draft.telefono}
                onChange={(e) => onUpdateDraft(draft.id, { telefono: e.target.value })}
                aria-label={`Teléfono de cliente ${idx + 1}`}
                placeholder="Teléfono (10 dígitos)"
                className="col-span-1 h-8 rounded-md border border-slate-200 bg-white px-2 font-mono text-[11px] tabular-nums text-slate-800 focus:border-sky-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 sm:col-span-2"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Merge Mode Selector + Commit & Optimize Button */}
      <div className="mt-3 flex flex-col gap-2">
        {hasExistingStops && (
          <div
            role="group"
            aria-label="Modo de integración a la ruta"
            className="grid grid-cols-2 gap-1 rounded-lg bg-white p-1 border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => onChangeMergeMode('append')}
              className={`inline-flex h-8 items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition-colors ${
                mergeMode === 'append'
                  ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              {mergeMode === 'append' && <Check className="h-3 w-3" aria-hidden="true" />}
              Sumar a ruta actual
            </button>
            <button
              type="button"
              onClick={() => onChangeMergeMode('replace')}
              className={`inline-flex h-8 items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition-colors ${
                mergeMode === 'replace'
                  ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              {mergeMode === 'replace' && <Check className="h-3 w-3" aria-hidden="true" />}
              Reemplazar lista
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onConfirmAndOptimize}
          disabled={isOptimizing}
          className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
        >
          <Route className="h-4 w-4" aria-hidden="true" />
          Agregar a la Ruta y Optimizar
        </button>
      </div>
    </div>
  );
};
