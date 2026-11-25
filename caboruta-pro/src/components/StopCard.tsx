import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  XCircle,
} from 'lucide-react';
import type { ClientStop, VisitStatus } from '../types/route';
import {
  buildClientWhatsappUrl,
  buildGoogleMapsUrl,
  buildWazeUrl,
} from '../utils/whatsappShare';
import { normalizeMexicanPhone } from '../utils/dataCleaning';

interface StopCardProps {
  stop: ClientStop;
  displayOrder: number;
  isSelected: boolean;
  whatsappTemplate: string;
  onSelectStop: (id: string) => void;
  onUpdateStatus: (id: string, status: VisitStatus) => void;
  onUpdateNotes: (id: string, notes: string) => void;
}

const STATUS_BUTTONS: Array<{
  id: VisitStatus;
  label: string;
  fullLabel: string;
  icon: React.FC<{ className?: string }>;
  activeClass: string;
}> = [
  {
    id: 'collected',
    label: 'Cobrado',
    fullLabel: 'Marcar como Cobrado',
    icon: CheckCircle2,
    activeClass:
      'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950',
  },
  {
    id: 'promise',
    label: 'Promesa',
    fullLabel: 'Marcar como Promesa de pago / Reprogramar',
    icon: Clock,
    activeClass:
      'border-amber-500 bg-amber-500 text-slate-950 dark:border-amber-400 dark:bg-amber-400',
  },
  {
    id: 'not_found',
    label: 'No ubicado',
    fullLabel: 'Marcar como No localizado',
    icon: XCircle,
    activeClass:
      'border-rose-600 bg-rose-600 text-white dark:border-rose-500 dark:bg-rose-500',
  },
];

export const StopCard: React.FC<StopCardProps> = ({
  stop,
  displayOrder,
  isSelected,
  whatsappTemplate,
  onSelectStop,
  onUpdateStatus,
  onUpdateNotes,
}) => {
  const [showGpsOptions, setShowGpsOptions] = useState(false);
  const phoneData = normalizeMexicanPhone(stop.telefono);
  const whatsappUrl = buildClientWhatsappUrl(stop, whatsappTemplate);

  const surfaceAccent =
    stop.status === 'collected'
      ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800/70 dark:bg-emerald-950/20'
      : stop.status === 'promise'
      ? 'border-amber-300 bg-amber-50/40 dark:border-amber-800/70 dark:bg-amber-950/20'
      : stop.status === 'not_found'
      ? 'border-rose-300 bg-rose-50/40 dark:border-rose-800/70 dark:bg-rose-950/20'
      : isSelected
      ? 'border-sky-500 bg-sky-50/40 dark:border-sky-500 dark:bg-sky-950/20'
      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]';

  const numberBadgeClass =
    stop.status === 'collected'
      ? 'bg-emerald-600 text-white'
      : stop.status === 'promise'
      ? 'bg-amber-500 text-slate-950'
      : stop.status === 'not_found'
      ? 'bg-rose-600 text-white'
      : 'bg-sky-600 text-white';

  return (
    <article
      data-testid={`stop-card-${stop.id}`}
      className={`rounded-xl border p-3.5 transition-colors ${surfaceAccent}`}
    >
      {/* Top Row: Stop Order + Client Name + Focus Map */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold tabular-nums ${numberBadgeClass}`}
          >
            {displayOrder}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-snug text-slate-900 dark:text-white">
              {stop.acreditado}
            </h3>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              {stop.cleanedAddress}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Col. {stop.colonia}</span>
              <span aria-hidden="true">·</span>
              <span>{stop.ciudad}</span>
              {stop.blockIndex > 1 || stop.visitOrder !== null ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">Bloque {stop.blockIndex}</span>
                </>
              ) : null}
              {stop.statusUpdatedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">Reg. {stop.statusUpdatedAt}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectStop(stop.id)}
          aria-label={`Ubicar a ${stop.acreditado} en el mapa`}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <MapPin className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          <span>Mapa</span>
        </button>
      </div>

      {/* Warning if SIN NOMBRE or approximate colonia pin */}
      {(stop.isSinNombre || stop.geocodePrecision === 'colonia' || stop.geocodePrecision === 'fallback') && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {stop.isSinNombre
              ? 'Calle SIN NOMBRE ubicada por colonia — arrastra el pin en el mapa si requiere ajuste'
              : 'Ubicación aproximada por colonia — puedes arrastrar el pin en el mapa'}
          </span>
        </div>
      )}

      {/* Field Agent Action Bar: GPS, WhatsApp, Call */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {stop.lat !== null && stop.lng !== null ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGpsOptions((prev) => !prev)}
              aria-expanded={showGpsOptions}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
              Ir con GPS
            </button>
            {showGpsOptions && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <a
                  href={buildGoogleMapsUrl(stop.lat, stop.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[36px] items-center rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  Google Maps
                </a>
                <a
                  href={buildWazeUrl(stop.lat, stop.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[36px] items-center rounded-md border border-sky-300 bg-sky-50 px-2.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
                >
                  Waze
                </a>
              </div>
            )}
          </div>
        ) : (
          <span className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 px-3 text-xs text-slate-400 dark:border-slate-700">
            Optimiza para GPS
          </span>
        )}

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Enviar WhatsApp a ${stop.acreditado}`}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 whitespace-nowrap dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          WhatsApp
        </a>

        {phoneData.telHref && (
          <a
            href={phoneData.telHref}
            aria-label={`Llamar a ${stop.acreditado} al ${phoneData.display}`}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            Llamar
          </a>
        )}
      </div>

      {/* Visit Status Selector */}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {STATUS_BUTTONS.map((btn) => {
          const Icon = btn.icon;
          const active = stop.status === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => onUpdateStatus(stop.id, active ? 'pending' : btn.id)}
              aria-pressed={active}
              aria-label={btn.fullLabel}
              title={btn.fullLabel}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                active
                  ? btn.activeClass
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{btn.label}</span>
            </button>
          );
        })}
      </div>

      {/* Quick Field Note Input */}
      <div className="mt-2.5">
        <label htmlFor={`note-${stop.id}`} className="sr-only">
          Notas del gestor para {stop.acreditado}
        </label>
        <input
          id={`note-${stop.id}`}
          type="text"
          value={stop.notes}
          onChange={(e) => onUpdateNotes(stop.id, e.target.value)}
          placeholder="Nota rápida del gestor (ej. Paga viernes 5pm, portón blanco)..."
          className="h-9 w-full rounded-lg border border-slate-200 bg-white/80 px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
        />
      </div>
    </article>
  );
};
