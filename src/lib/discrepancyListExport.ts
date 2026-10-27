import type { DiscrepancySummary } from "../types/discrepancies";
import { formatDay } from "./dates";
import { DISCREPANCY_FORM_CONTROL } from "./discrepancies";
import { exportPlastifarListToExcel, exportPlastifarListToPdf, type PlastifarListReportOptions } from "./plastifarListReport";

const HEADERS = [
  "Número",
  "Ticket",
  "Cliente",
  "Fecha",
  "Despachadores",
  "Líneas",
  "Seguridad",
  "Estado",
] as const;

const COL_WEIGHTS = [22, 22, 38, 20, 36, 12, 18, 24];

function filenameStem(): string {
  return `Discrepancias_Plastifar_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
}

function rowValues(item: DiscrepancySummary): string[] {
  return [
    item.number,
    item.ticketNumber,
    item.clientName ?? "—",
    formatDay(item.createdAt.slice(0, 10)),
    item.dispatchers.join(", ") || "—",
    String(item.lineCount),
    item.hasSecurityFinding ? "Hallazgo" : "—",
    item.status,
  ];
}

function options(): PlastifarListReportOptions<DiscrepancySummary> {
  return {
    reportTitle: "REPORTE DE INVESTIGACIONES DE DISCREPANCIA",
    formCode: DISCREPANCY_FORM_CONTROL.code,
    formRevision: DISCREPANCY_FORM_CONTROL.revision,
    filenameStem: filenameStem(),
    worksheetName: "Discrepancias",
    listBandTitle: "Listado de investigaciones",
    headers: HEADERS,
    colWeights: COL_WEIGHTS,
    getRowValues: rowValues,
  };
}

export function exportDiscrepanciesListToExcel(items: DiscrepancySummary[]): Promise<void> {
  return exportPlastifarListToExcel(items, options());
}

export function exportDiscrepanciesListToPdf(items: DiscrepancySummary[]): Promise<void> {
  return exportPlastifarListToPdf(items, options());
}
