import type { ClaimSummary, CustomerClaim } from "../types/claims";
import { topicRequiresOther } from "../types/claims";
import { CLAIM_FORM_CONTROL } from "./claims";
import { formatDay } from "./dates";
import { downloadWorkbook } from "./hcaExcelExport";
import { formatAmountOrPlain, formatPrice, formatQuantity } from "./numbers";

const CLAIM_LIST_REPORT_TITLE = "REPORTE DE RECLAMACIONES DE CLIENTES";
const PLASTIFAR_TAGLINE = "Plastifar · Sistema de gestión de calidad";
const LIST_TABLE_HEADER_FILL = "FFF4F4F5";
const LIST_ZEBRA_FILL = "FFF9FAFB";
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

function claimListSubtitle(count: number): string {
  return `Generado el ${new Date().toLocaleDateString("es-DO")} · Total de registros: ${count}`;
}

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

/** Pesos relativos de columnas; se escalan al ancho útil de la hoja. */
const CLAIM_LIST_COL_WEIGHTS = [26, 46, 20, 34, 28, 34, 14, 28, 26];

function scaleClaimListColumnWidths(tableWidth: number): number[] {
  const total = CLAIM_LIST_COL_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  const widths = CLAIM_LIST_COL_WEIGHTS.map((weight) => (weight / total) * tableWidth);
  const drift = tableWidth - widths.reduce((sum, width) => sum + width, 0);
  widths[widths.length - 1] += drift;
  return widths;
}

async function loadPlastifarLogoBuffer(): Promise<ArrayBuffer | null> {
  try {
    const logoRes = await fetch("/brand/plastifar-logo.png");
    if (!logoRes.ok) return null;
    return await logoRes.arrayBuffer();
  } catch {
    return null;
  }
}

async function loadPlastifarLogoDataUrl(): Promise<string | null> {
  const buffer = await loadPlastifarLogoBuffer();
  if (!buffer) return null;
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/png;base64,${btoa(binary)}`;
}

async function embedPlastifarLogoOnSheet(
  wb: import("exceljs").Workbook,
  ws: import("exceljs").Worksheet,
): Promise<void> {
  const buffer = await loadPlastifarLogoBuffer();
  if (!buffer) return;
  const imageId = wb.addImage({ buffer, extension: "png" });
  ws.addImage(imageId, {
    tl: { col: 0.12, row: 0.12 },
    ext: { width: 128, height: 34 },
  });
}

const LIST_HEADER_ROWS = 5;
const LIST_TABLE_HEADER_ROW = 6;
const LIST_DATA_START_ROW = 7;

function applyClaimsListCorporateHeader(ws: import("exceljs").Worksheet, count: number): void {
  ws.mergeCells(1, 3, 1, 8);
  const titleCell = ws.getCell(1, 3);
  titleCell.value = CLAIM_LIST_REPORT_TITLE;
  titleCell.font = { name: "Calibri", size: 15, bold: true, color: { argb: BRAND_RED } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells(2, 3, 2, 8);
  const taglineCell = ws.getCell(2, 3);
  taglineCell.value = PLASTIFAR_TAGLINE;
  taglineCell.font = { name: "Calibri", size: 9, color: { argb: "FF515151" } };
  taglineCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.getCell(1, 9).value = CLAIM_FORM_CONTROL.code;
  ws.getCell(1, 9).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF18181B" } };
  ws.getCell(1, 9).alignment = { horizontal: "right", vertical: "middle" };

  ws.getCell(2, 9).value = `Rev. ${CLAIM_FORM_CONTROL.revision}`;
  ws.getCell(2, 9).font = { name: "Calibri", size: 9, color: { argb: "FF515151" } };
  ws.getCell(2, 9).alignment = { horizontal: "right", vertical: "middle" };

  ws.mergeCells(3, 1, 3, 9);
  const metaCell = ws.getCell(3, 1);
  metaCell.value = claimListSubtitle(count);
  metaCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF515151" } };
  metaCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells(4, 1, 4, 9);
  ws.getRow(4).height = 6;
  ws.getCell(4, 1).border = {
    bottom: { style: "medium", color: { argb: BRAND_RED } },
  };

  ws.getRow(1).height = 26;
  ws.getRow(2).height = 16;
  ws.getRow(3).height = 18;
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


export async function exportClaimsListToExcel(claims: ClaimSummary[]): Promise<void> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Plastifar S.A.";
  wb.created = new Date();

  const ws = wb.addWorksheet("Reclamaciones", {
    views: [{ state: "normal", showGridLines: false, zoomScale: 100 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { width: 15 },
    { width: 30 },
    { width: 14 },
    { width: 26 },
    { width: 22 },
    { width: 22 },
    { width: 10 },
    { width: 16 },
    { width: 16 },
  ];

  await embedPlastifarLogoOnSheet(wb, ws);
  applyClaimsListCorporateHeader(ws, claims.length);
  sectionHeader(ws, LIST_HEADER_ROWS, "Listado de reclamaciones");

  const headerRow = ws.getRow(LIST_TABLE_HEADER_ROW);
  headerRow.height = 22;
  CLAIM_LIST_HEADERS.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF18181B" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIST_TABLE_HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: idx === 7 ? "right" : "left" };
    cell.border = BORDER_ALL;
  });

  claims.forEach((c, i) => {
    const row = ws.getRow(LIST_DATA_START_ROW + i);
    row.height = 20;
    const values = claimListRowValues(c);

    values.forEach((v, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = idx === 7 ? c.totalAmount : v;
      cell.font = { name: "Calibri", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: idx === 7 ? "right" : "left" };
      if (idx === 7) {
        cell.numFmt = "#,##0.00";
      }
      cell.border = BORDER_ALL;
      if (i % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIST_ZEBRA_FILL } };
      }
    });
  });

  await downloadWorkbook(wb, `${claimsListFilenameStem()}.xlsx`);
}

/** Mismo contenido y jerarquía visual que el Excel de listado (cabecera corporativa y tabla). */
export async function exportClaimsListToPdf(claims: ClaimSummary[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });

  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableWidth = pageWidth - margin * 2;
  const colWidths = scaleClaimListColumnWidths(tableWidth);
  const lineHeight = 3.6;
  const cellPadX = 1.2;
  const cellPadY = 2.2;
  const headerFontSize = 7.5;
  const headerLineHeight = 3.1;
  const brandRed: [number, number, number] = [228, 0, 43];
  const tableHeaderFill: [number, number, number] = [244, 244, 245];
  const zebraFill: [number, number, number] = [249, 250, 251];
  const logoDataUrl = await loadPlastifarLogoDataUrl();

  function drawCorporateHeader(startY: number): number {
    const logoW = 36;
    const logoH = 10;
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", margin, startY, logoW, logoH);
    }

    const centerX = pageWidth / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...brandRed);
    doc.text(CLAIM_LIST_REPORT_TITLE, centerX, startY + 4.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(81, 81, 81);
    doc.text(PLASTIFAR_TAGLINE.toUpperCase(), centerX, startY + 8.5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(24, 24, 27);
    doc.text(CLAIM_FORM_CONTROL.code, pageWidth - margin, startY + 4, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(81, 81, 81);
    doc.text(`Rev. ${CLAIM_FORM_CONTROL.revision}`, pageWidth - margin, startY + 8, { align: "right" });

    let y = startY + logoH + 3;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(81, 81, 81);
    doc.text(claimListSubtitle(claims.length), centerX, y, { align: "center" });
    y += 3;

    doc.setDrawColor(...brandRed);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    doc.setFillColor(...brandRed);
    doc.rect(margin, y, tableWidth, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("Listado de reclamaciones", margin + 2, y + 4.8);
    return y + 9;
  }

  function measureColumnHeaderHeight(): number {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(headerFontSize);
    let maxLines = 1;
    for (let i = 0; i < CLAIM_LIST_HEADERS.length; i++) {
      const lines = doc.splitTextToSize(CLAIM_LIST_HEADERS[i], colWidths[i] - cellPadX * 2);
      maxLines = Math.max(maxLines, lines.length);
    }
    return maxLines * headerLineHeight + cellPadY * 2;
  }

  function drawColumnHeader(y: number): number {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(headerFontSize);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.15);

    const headerHeight = measureColumnHeaderHeight();
    let x = margin;
    for (let i = 0; i < CLAIM_LIST_HEADERS.length; i++) {
      doc.setFillColor(...tableHeaderFill);
      doc.rect(x, y, colWidths[i], headerHeight, "F");
      doc.rect(x, y, colWidths[i], headerHeight, "S");
      doc.setTextColor(24, 24, 27);
      const lines = doc.splitTextToSize(CLAIM_LIST_HEADERS[i], colWidths[i] - cellPadX * 2);
      doc.text(lines, x + cellPadX, y + cellPadY + headerLineHeight);
      x += colWidths[i];
    }
    return y + headerHeight;
  }

  function drawPageFooter(page: number, totalPages: number) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(81, 81, 81);
    doc.text(
      `${CLAIM_FORM_CONTROL.code} · Rev. ${CLAIM_FORM_CONTROL.revision} · Plastifar S.A. · Página ${page} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: "center" },
    );
  }

  let y = drawCorporateHeader(margin);
  y = drawColumnHeader(y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  let rowIndex = 0;
  for (const claim of claims) {
    const values = claimListRowValues(claim);
    const wrapped = values.map((value, idx) =>
      doc.splitTextToSize(value || "—", colWidths[idx] - cellPadX * 2),
    );
    const rowLines = Math.max(...wrapped.map((lines) => lines.length), 1);
    const rowHeight = rowLines * lineHeight + cellPadY * 2;

    if (y + rowHeight > pageHeight - margin - 8) {
      doc.addPage();
      y = drawColumnHeader(margin);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
    }

    let x = margin;
    for (let col = 0; col < values.length; col++) {
      if (rowIndex % 2 === 1) {
        doc.setFillColor(...zebraFill);
        doc.rect(x, y, colWidths[col], rowHeight, "F");
      }
      doc.setDrawColor(0, 0, 0);
      doc.rect(x, y, colWidths[col], rowHeight, "S");
      const align = col === 7 ? "right" : "left";
      const textX = align === "right" ? x + colWidths[col] - cellPadX : x + cellPadX;
      doc.setTextColor(0, 0, 0);
      doc.text(wrapped[col], textX, y + cellPadY + lineHeight, { align });
      x += colWidths[col];
    }
    y += rowHeight;
    rowIndex++;
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    drawPageFooter(page, totalPages);
  }

  doc.save(`${claimsListFilenameStem()}.pdf`);
}

export function exportClaimsListToCsv(claims: ClaimSummary[]): void {
  const rows = claims.map((c) => {
    const values = claimListRowValues(c);
    return values.map((v, idx) =>
      idx === 7 ? String(c.totalAmount) : `"${String(v).replace(/"/g, '""')}"`,
    );
  });

  const csvContent =
    "\uFEFF" + [CLAIM_LIST_HEADERS.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${claimsListFilenameStem()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
