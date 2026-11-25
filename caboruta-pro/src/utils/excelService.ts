import * as XLSX from 'xlsx';
import type { ClientStop } from '../types/route';
import { cleanExcelRows } from './dataCleaning';
import { STATUS_LABELS } from './whatsappShare';

export function parseSpreadsheetBuffer(buffer: ArrayBuffer): ClientStop[] {
  const workbook = XLSX.read(buffer, { type: 'array', codepage: 65001 });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  });

  return cleanExcelRows(rawRows);
}

export function buildClosureReportRows(stops: ClientStop[]): Array<Record<string, unknown>> {
  const sorted = [...stops].sort((a, b) => {
    const oa = a.visitOrder ?? a.originalOrder;
    const ob = b.visitOrder ?? b.originalOrder;
    return oa - ob;
  });

  return sorted.map((stop, index) => ({
    ...stop.rawRow,
    Acreditado: stop.acreditado,
    Calle: stop.calle,
    'Numero Exterior': stop.numeroExterior,
    'Numero Interior': stop.numeroInterior,
    Colonia: stop.colonia,
    Municipio: stop.municipio,
    Ciudad: stop.ciudad,
    Estado: stop.estado,
    'Codigo Postal': stop.codigoPostal,
    Teléfono: stop.telefono,
    'Orden de Visita': stop.visitOrder ?? index + 1,
    'Estatus de Cobro': STATUS_LABELS[stop.status],
    'Hora de Registro': stop.statusUpdatedAt || 'Sin registro',
    'Notas del Gestor': stop.notes || '',
  }));
}

export function downloadClosureExcel(stops: ClientStop[], filename?: string): void {
  const rows = buildClosureReportRows(stops);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cierre Cobranza');

  const dateStamp = new Date().toISOString().slice(0, 10);
  const outName = filename || `CaboRuta_Cierre_${dateStamp}.xlsx`;
  XLSX.writeFile(workbook, outName);
}
