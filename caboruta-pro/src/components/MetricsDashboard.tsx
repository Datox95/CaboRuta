import React from 'react';
import type { RouteMetrics } from '../types/route';
import { formatDurationHm } from '../utils/whatsappShare';

interface MetricsDashboardProps {
  metrics: RouteMetrics;
  isOptimized: boolean;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ metrics, isOptimized }) => {
  const progressPct =
    metrics.totalClients > 0 ? Math.round((metrics.collectedCount / metrics.totalClients) * 100) : 0;

  return (
    <section
      aria-label="Métricas de ruta en tiempo real"
      className="border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-[#0F172A] lg:px-6 lg:py-2.5"
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
        {/* Metric 1: Clientes */}
        <div className="flex flex-col justify-center">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 lg:text-xs">
            Clientes cargados
          </span>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white lg:text-lg">
              {metrics.totalClients}
            </span>
            <span className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400 lg:text-xs">
              {metrics.geocodedCount} ubicados
            </span>
          </div>
        </div>

        {/* Metric 2: Distancia Total */}
        <div className="flex flex-col justify-center">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 lg:text-xs">
            Distancia estimada
          </span>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white lg:text-lg">
              {metrics.totalDistanceKm.toFixed(1)} km
            </span>
            {isOptimized && metrics.distanceSavedKm > 0 && (
              <span className="text-[11px] font-medium text-emerald-600 tabular-nums dark:text-emerald-400 lg:text-xs">
                -{metrics.distanceSavedKm.toFixed(1)} km
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: Tiempo Estimado */}
        <div className="flex flex-col justify-center">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 lg:text-xs">
            Tiempo en ruta
          </span>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white lg:text-lg">
              {formatDurationHm(metrics.estimatedMinutes)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 lg:text-xs">
              con paradas
            </span>
          </div>
        </div>

        {/* Metric 4: Ahorro Combustible */}
        <div className="flex flex-col justify-center">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 lg:text-xs">
            Ahorro combustible
          </span>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="font-mono text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400 lg:text-lg">
              ${metrics.fuelSavedMxn} MXN
            </span>
            <span className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400 lg:text-xs">
              {metrics.fuelSavedLiters.toFixed(1)} L
            </span>
          </div>
        </div>

        {/* Metric 5: Barra de Progreso de Cobranza */}
        <div className="col-span-2 flex flex-col justify-center sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-500 dark:text-slate-400">
              Progreso de cobranza
            </span>
            <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
              {metrics.collectedCount}/{metrics.totalClients} cobrados
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso de cobranza"
            className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          >
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-300 dark:bg-emerald-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
