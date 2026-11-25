import React from 'react';
import { FileSpreadsheet, Moon, Send, Sun, Database } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface TopBarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  hasStops: boolean;
  onLoadDemo: () => void;
  onOpenClosureReport: () => void;
  onOpenShareWhatsapp: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  darkMode,
  onToggleDarkMode,
  hasStops,
  onLoadDemo,
  onOpenClosureReport,
  onOpenShareWhatsapp,
}) => {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-[#0F172A] lg:px-6">
      {/* Zone 1: Brand Title */}
      <div className="flex items-center gap-2.5 shrink-0">
        <svg
          className="h-7 w-7 shrink-0"
          viewBox="0 0 512 512"
          aria-hidden="true"
        >
          <rect width="512" height="512" rx="112" fill="#0F172A" />
          <path
            d="M132 348 C132 248, 224 276, 256 216 C288 156, 380 184, 380 120"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="32"
            strokeLinecap="round"
          />
          <circle cx="132" cy="348" r="32" fill="#38BDF8" />
          <circle cx="256" cy="216" r="24" fill="#F59E0B" />
          <circle cx="380" cy="130" r="38" fill="#10B981" />
        </svg>
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap dark:text-white">
          CaboRuta Pro
        </span>
      </div>

      {/* Zone 2: Clean single-line utility actions */}
      <nav aria-label="Acciones de ruta" className="hidden md:flex items-center gap-5">
        <button
          type="button"
          onClick={onLoadDemo}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 whitespace-nowrap shrink-0 dark:text-slate-300 dark:hover:text-white"
        >
          <Database className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          Datos de Prueba
        </button>

        <button
          type="button"
          onClick={onOpenShareWhatsapp}
          disabled={!hasStops}
          aria-label="Enviar Ruta al Celular (Link WhatsApp)"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0 dark:text-slate-300 dark:hover:text-white"
        >
          <Send className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>Enviar Ruta al Celular (Link WhatsApp)</span>
        </button>

        <button
          type="button"
          onClick={onToggleDarkMode}
          aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 whitespace-nowrap shrink-0 dark:text-slate-300 dark:hover:text-white"
        >
          {darkMode ? (
            <>
              <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
              Modo Claro
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Modo Oscuro
            </>
          )}
        </button>
      </nav>

      {/* Zone 3: Primary Closure Report / Excel Action + Mobile Compact Controls + PWA Install */}
      <div className="flex items-center gap-2 shrink-0">
        <PWAInstallButton />

        <button
          type="button"
          onClick={onToggleDarkMode}
          aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 md:hidden dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={onOpenShareWhatsapp}
          disabled={!hasStops}
          aria-label="Enviar Ruta al Celular (Link WhatsApp)"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 md:hidden dark:border-slate-700 dark:text-emerald-400 dark:hover:bg-slate-800"
        >
          <Send className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onOpenClosureReport}
          disabled={!hasStops}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Cierre de Caja / Excel</span>
          <span className="sm:hidden">Cierre</span>
        </button>
      </div>
    </header>
  );
};
