import type { ClaimSummary, CustomerClaim } from "../types/claims";
import { topicRequiresOther } from "../types/claims";
import { CLAIM_FORM_CONTROL } from "./claims";
import { formatDay } from "./dates";
import { downloadWorkbook } from "./hcaExcelExport";
import { formatAmountOrPlain, formatPrice, formatQuantity } from "./numbers";
import { exportPlastifarListToExcel, exportPlastifarListToPdf, type PlastifarListReportOptions } from "./plastifarListReport";

const CLAIM_LIST_REPORT_TITLE = "REPORTE DE RECLAMACIONES DE CLIENTES";
const COLS = 9;
const BRAND_RED = "FFE4002B";
const BORDER_THIN = { style: "thin" as const, color: { argb: "FF000000" } };
const BORDER_ALL = {
  top: BORDER_THIN,
  left: BORDER_THIN,
  bottom: BORDER_THIN,
  right: BORDER_THIN,
};

const CLAIM_LIST_HEADERS = [
  "Ticket",
  "Cliente",
  "Fecha",
  "Motivo",
  "Detalle Motivo",
  "Plantas",
  "Moneda",
  "Total Reclamado",
  "Estado",
] as const;

/** Pesos relativos de columnas; se escalan al ancho útil de la hoja. */
const CLAIM_LIST_COL_WEIGHTS = [26, 46, 20, 34, 28, 34, 14, 28, 26];
const AMOUNT_COL = 7;

function claimListRowValues(c: ClaimSummary): string[] {
  return [
    c.ticketNumber,
    c.clientName,
    c.claimDate ? formatDay(c.claimDate) : "",
    c.reason,
    c.reasonOther || "",
    c.plants.join(", ") || "—",
    c.currency || "DOP",
    formatAmountOrPlain(c.totalAmount, c.currency),
    c.status,
  ];
}

function claimsListFilenameStem(): string {
  return `Reclamaciones_Plastifar_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
}

function claimListOptions(): PlastifarListReportOptions<ClaimSummary> {
  return {
    reportTitle: CLAIM_LIST_REPORT_TITLE,
    formCode: CLAIM_FORM_CONTROL.code,
    formRevision: CLAIM_FORM_CONTROL.revision,
    filenameStem: claimsListFilenameStem(),
    worksheetName: "Reclamaciones",
    listBandTitle: "Listado de reclamaciones",
    headers: CLAIM_LIST_HEADERS,
    colWeights: CLAIM_LIST_COL_WEIGHTS,
    rightAlignColumns: [AMOUNT_COL],
    amountColumnIndex: AMOUNT_COL,
    getRowValues: claimListRowValues,
    getAmountValue: (c) => c.totalAmount,
  };
}

const sectionTitleFont = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
const sectionTitleFill = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: BRAND_RED },
};

function mergeRow(ws: import("exceljs").Worksheet, row: number, fromCol: number, toCol: number, value?: string) {
  ws.mergeCells(row, fromCol, row, toCol);
  const cell = ws.getCell(row, fromCol);
  if (value !== undefined) cell.value = value;
  return cell;
}

function sectionHeader(ws: import("exceljs").Worksheet, row: number, title: string) {
  const cell = mergeRow(ws, row, 1, COLS, title);
  cell.font = sectionTitleFont;
  cell.fill = sectionTitleFill;
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(row).height = 20;
}

function labelValueRow(
  ws: import("exceljs").Worksheet,
  row: number,
  pairs: Array<{ label: string; value: string }>,
  colsPerPair = 3,
) {
  let col = 1;
  for (const { label, value } of pairs) {
    const labelCell = ws.getCell(row, col);
    labelCell.value = label;
    labelCell.font = { bold: true, size: 10 };
    labelCell.border = BORDER_ALL;

    const valueStart = col + 1;
    const valueEnd = Math.min(col + colsPerPair - 1, COLS);
    if (valueEnd > valueStart) ws.mergeCells(row, valueStart, row, valueEnd);
    const valueCell = ws.getCell(row, valueStart);
    valueCell.value = value;
    valueCell.alignment = { wrapText: true, vertical: "top" };
    valueCell.border = BORDER_ALL;

    col = valueEnd + 1;
    if (col > COLS) break;
  }
}

function textBlock(ws: import("exceljs").Worksheet, startRow: number, label: string, text: string, minRows = 3) {
  ws.getCell(startRow, 1).value = label;
  ws.getCell(startRow, 1).font = { bold: true, size: 10 };
  ws.mergeCells(startRow, 1, startRow + minRows - 1, 1);
  ws.getCell(startRow, 1).alignment = { vertical: "top", wrapText: true };
  ws.getCell(startRow, 1).border = BORDER_ALL;

  ws.mergeCells(startRow, 2, startRow + minRows - 1, COLS);
  const body = ws.getCell(startRow, 2);
  body.value = text;
  body.alignment = { wrapText: true, vertical: "top" };
  body.border = BORDER_ALL;

  const lines = Math.max(minRows, Math.ceil((text.length || 1) / 110));
  for (let i = 0; i < minRows; i++) {
    ws.getRow(startRow + i).height = i === 0 ? Math.max(15, lines * 14) : 15;
  }
  return startRow + minRows;
}

/** Excel alineado con la impresión PDF / ficha del ticket (no la cuadrícula legacy del xlsx). */
export async function exportClaimToExcel(claim: CustomerClaim): Promise<void> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("PF-FOR-034", {
    views: [{ state: "normal", showGridLines: true, zoomScale: 100 }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
  ];

  try {
    const logoRes = await fetch("/brand/plastifar-logo.png");
    if (logoRes.ok) {
      const imageId = wb.addImage({
        buffer: await logoRes.arrayBuffer(),
        extension: "png",
      });
      ws.addImage(imageId, {
        tl: { col: 0.15, row: 0.1 },
        ext: { width: 130, height: 34 },
      });
    }
  } catch {
    /* sin logo no bloquea la exportación */
  }

  let r = 1;
  mergeRow(ws, r, 3, 7, CLAIM_FORM_CONTROL.title);
  ws.getCell(r, 3).font = { name: "Calibri", size: 16, bold: true, color: { argb: BRAND_RED } };
  ws.getCell(r, 3).alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(r).height = 28;

  r += 1;
  mergeRow(ws, r, 3, 7, "Plastifar · Sistema de gestión de calidad");
  ws.getCell(r, 3).font = { size: 9, color: { argb: "FF515151" } };
  ws.getCell(r, 3).alignment = { horizontal: "center" };

  r += 1;
  ws.getCell(r, 6).value = "Fecha de la Reclamación:";
  ws.getCell(r, 6).font = { bold: true, size: 10 };
  ws.getCell(r, 7).value = formatDay(claim.claimDate);
  ws.getCell(r, 8).value = "Código:";
  ws.getCell(r, 8).font = { bold: true, size: 10 };
  ws.getCell(r, 9).value = claim.ticketNumber || String(claim.id);

  r += 2;
  sectionHeader(ws, r, "I. Información General");
  r += 1;
  labelValueRow(ws, r, [
    { label: "Empresa:", value: claim.clientName || "" },
    { label: "Contacto:", value: claim.contactName ?? "" },
    { label: "País:", value: claim.country ?? "" },
  ]);
  r += 1;
  const phones = [claim.contactPhone, claim.clientPhone].filter(Boolean).join(" · ");
  mergeRow(ws, r, 1, 2, "Teléfonos:");
  ws.getCell(r, 1).font = { bold: true };
  mergeRow(ws, r, 3, COLS, phones);
  ws.getCell(r, 3).alignment = { wrapText: true };

  r += 2;
  sectionHeader(ws, r, "II. Información General sobre la Reclamación");
  r += 1;

  const plantNames = claim.plants.map((p) => p.name).join(" · ") || "—";
  const reasonLabel = topicRequiresOther(claim.reason)
    ? `${claim.reason}${claim.reasonOther?.trim() ? `: ${claim.reasonOther.trim()}` : ""}`
    : claim.reason;
  mergeRow(ws, r, 1, 2, "Planta(s) involucrada(s):");
  ws.getCell(r, 1).font = { bold: true };
  mergeRow(ws, r, 3, COLS, plantNames);
  ws.getCell(r, 3).alignment = { wrapText: true };
  r += 1;

  mergeRow(ws, r, 1, 2, "Motivo del reclamo:");
  ws.getCell(r, 1).font = { bold: true };
  mergeRow(ws, r, 3, COLS, reasonLabel);
  r += 1;

  mergeRow(ws, r, 1, 2, "Área(s) afectada(s):");
  ws.getCell(r, 1).font = { bold: true };
  mergeRow(ws, r, 3, COLS, claim.affectedAreas.length ? claim.affectedAreas.join(" · ") : "—");
  r += 1;

  labelValueRow(ws, r, [
    { label: "Fecha prod. / lote:", value: claim.productionLot ?? "" },
    { label: "Factura:", value: claim.invoiceRef ?? "" },
    { label: "Número PO:", value: claim.poNumber ?? "" },
  ]);
  r += 2;

  const tableHeader = ws.getRow(r);
  [
    "Producto",
    "Código",
    "Unid. compradas",
    "Unid. defectuosas",
    "Facturados",
    "Recibidos",
    "Dif.",
    "Precio",
    "Total línea",
  ].forEach((h, idx) => {
    const cell = tableHeader.getCell(idx + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F5" } };
    cell.border = BORDER_ALL;
  });
  r += 1;

  const lines = [...(claim.lines ?? [])].sort((a, b) => a.position - b.position);
  const money = (value: number) =>
    claim.currency ? formatAmountOrPlain(value, claim.currency) : formatQuantity(value);

  if (lines.length === 0) {
    mergeRow(ws, r, 1, COLS, "Sin líneas de producto");
    ws.getCell(r, 1).alignment = { horizontal: "center" };
    r += 1;
  } else {
    for (const line of lines) {
      const row = ws.getRow(r);
      row.getCell(1).value = line.productName;
      row.getCell(2).value = line.productCode;
      row.getCell(3).value = line.unitsPurchased ?? "";
      row.getCell(4).value = line.defectiveQuantity ?? "";
      row.getCell(5).value = line.invoicedQuantity ?? "";
      row.getCell(6).value = line.receivedQuantity ?? "";
      row.getCell(7).value = line.difference ?? "";
      row.getCell(8).value = line.unitPrice != null ? formatPrice(line.unitPrice) : "";
      row.getCell(9).value = money(line.lineTotal);
      for (let c = 1; c <= COLS; c++) {
        row.getCell(c).border = BORDER_ALL;
        row.getCell(c).alignment = { vertical: "top", wrapText: true };
      }
      r += 1;
    }
  }

  r += 1;
  labelValueRow(ws, r, [
    {
      label: "Unid. a retornar:",
      value: claim.unitsToReturn != null ? formatQuantity(claim.unitsToReturn) : "—",
    },
    {
      label: "Defecto identificado:",
      value: claim.defectFoundDuring ?? "—",
    },
    {
      label: "Total reclamación:",
      value: money(claim.totalAmount),
    },
  ]);

  r += 2;
  sectionHeader(ws, r, "III. Descripción de la Reclamación");
  r += 1;
  r = textBlock(ws, r, "Descripción", claim.description?.trim() || "—", 4);
  if (claim.comments?.trim()) {
    r = textBlock(ws, r, "Comentarios", claim.comments.trim(), 2);
  }
  labelValueRow(ws, r, [
    { label: "Recibida por:", value: claim.receivedByName },
    { label: "Fecha recepción:", value: formatDay(claim.receivedAt) },
    {
      label: "Primer contacto:",
      value: claim.firstCustomerContactAt ? formatDay(claim.firstCustomerContactAt) : "—",
    },
  ]);
  r += 2;

  sectionHeader(ws, r, "IV. Tratamiento de la Reclamación · Depto. de Calidad");
  r += 1;

  r = textBlock(ws, r, "Primera respuesta (corrección)", claim.firstResponseCorrection?.trim() || "—", 2);
  const corrective =
    claim.requiresCorrectiveAction === null
      ? "Sin responder"
      : claim.requiresCorrectiveAction
        ? `Sí${claim.hcaNumber ? ` · HCA ${claim.hcaNumber}` : ""}`
        : "No";
  mergeRow(ws, r, 1, 2, "Acción correctiva:");
  ws.getCell(r, 1).font = { bold: true };
  mergeRow(ws, r, 3, COLS, corrective);
  r += 1;

  r = textBlock(ws, r, "Análisis causa raíz", claim.rootCauseAnalysis?.trim() || "—", 3);
  r = textBlock(ws, r, "Acciones correctivas / preventivas", claim.correctiveActions?.trim() || "—", 3);

  labelValueRow(ws, r, [
    {
      label: "Cierre:",
      value: claim.closedAt ? formatDay(claim.closedAt.slice(0, 10)) : "—",
    },
    {
      label: "Tiempo respuesta:",
      value: claim.responseDays != null ? `${claim.responseDays} días` : "—",
    },
    {
      label: "Cliente satisfecho:",
      value:
        claim.customerSatisfied === null ? "Sin responder" : claim.customerSatisfied ? "Sí" : "No",
    },
  ]);
  r += 1;

  mergeRow(ws, r, 1, 2, "Responsable cierre:");
  ws.getCell(r, 1).font = { bold: true };
  mergeRow(ws, r, 3, COLS, claim.closedByName ?? "—");
  r += 1;

  if (claim.observations?.trim()) {
    r = textBlock(ws, r, "Observaciones", claim.observations.trim(), 2);
  }

  r += 1;
  mergeRow(ws, r, 1, COLS);
  const footer = ws.getCell(r, 1);
  footer.value = [
    CLAIM_FORM_CONTROL.code,
    `Revisión ${CLAIM_FORM_CONTROL.revision}`,
    `Sustituye a ${CLAIM_FORM_CONTROL.replaces}`,
    `Última revisión ${CLAIM_FORM_CONTROL.lastRevision}`,
    `Creación ${CLAIM_FORM_CONTROL.createdOn}`,
    `Emitido por: ${claim.receivedByName}`,
  ].join("  ·  ");
  footer.font = { size: 8, color: { argb: "FF515151" } };
  footer.alignment = { wrapText: true };

  await downloadWorkbook(wb, `PF-FOR-034_${claim.ticketNumber || claim.id}.xlsx`);
}

export function exportClaimsListToExcel(claims: ClaimSummary[]): Promise<void> {
  return exportPlastifarListToExcel(claims, claimListOptions());
}

/** Mismo contenido y jerarquía visual que el Excel de listado (cabecera corporativa y tabla). */
export function exportClaimsListToPdf(claims: ClaimSummary[]): Promise<void> {
  return exportPlastifarListToPdf(claims, claimListOptions());
}
