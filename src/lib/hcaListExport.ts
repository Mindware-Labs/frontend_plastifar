import type { CorrectiveActionSheet } from "../types/quality";
import { formatDay } from "./dates";
import {
  exportPlastifarListToExcel,
  exportPlastifarListToPdf,
  type PlastifarListReportOptions,
} from "./plastifarListReport";

const HCA_LIST_REPORT_TITLE = "REPORTE DE ACCIONES CORRECTIVAS (HCA)";

const HCA_LIST_HEADERS = [
  "Código HCA",
  "Cliente",
  "Línea de Producto",
  "Planta",
  "Responsable",
  "Fecha Detección",
  "Vencimiento",
  "Estado",
] as const;

const HCA_LIST_COL_WEIGHTS = [24, 38, 28, 22, 32, 22, 22, 24];

function hcaListRowValues(sheet: CorrectiveActionSheet): string[] {
  return [
    sheet.number,
    sheet.clientName,
    sheet.productLineName,
    sheet.plantName || "—",
    sheet.responsibleName,
    sheet.detectedAt ? formatDay(sheet.detectedAt.slice(0, 10)) : "",
    sheet.dueDate ? formatDay(sheet.dueDate) : "",
    sheet.status,
  ];
}

const hcaListReportOptions: PlastifarListReportOptions<CorrectiveActionSheet> = {
  reportTitle: HCA_LIST_REPORT_TITLE,
  formCode: "PF-FOR-109",
  formRevision: "00",
  filenameStem: "HCA_Acciones_Correctivas",
  worksheetName: "HCA",
  listBandTitle: "I. LISTADO DE ACCIONES CORRECTIVAS (PF-FOR-109)",
  headers: HCA_LIST_HEADERS,
  colWeights: HCA_LIST_COL_WEIGHTS,
  getRowValues: hcaListRowValues,
};

export async function exportHcasListToExcel(items: CorrectiveActionSheet[]): Promise<void> {
  await exportPlastifarListToExcel(items, hcaListReportOptions);
}

export async function exportHcasListToPdf(items: CorrectiveActionSheet[]): Promise<void> {
  await exportPlastifarListToPdf(items, hcaListReportOptions);
}
