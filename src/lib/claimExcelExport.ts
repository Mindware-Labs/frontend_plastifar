import type { ClaimSummary, CustomerClaim } from "../types/claims";
import { topicRequiresOther } from "../types/claims";
import { CLAIM_FORM_CONTROL } from "./claims";
import { formatDay } from "./dates";
import { downloadWorkbook } from "./hcaExcelExport";
import { formatAmountOrPlain, formatQuantity } from "./numbers";
import { exportPlastifarListToExcel, exportPlastifarListToPdf, type PlastifarListReportOptions } from "./plastifarListReport";

const CLAIM_LIST_REPORT_TITLE = "REPORTE DE RECLAMACIONES DE CLIENTES";
const COLS = 9;

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

const BRAND_RED = "FFE4002B";
const BRAND_RED_LIGHT = "FFFFF1F2";
const TABLE_HEADER_FILL = "FF1E293B";
const FIELD_LABEL_FILL = "FFF8FAFC";
const ZEBRA_ROW_FILL = "FFF9FAFB";
const BORDER_COLOR = "FFD4D4D8";
const BORDER_THIN = { style: "thin" as const, color: { argb: BORDER_COLOR } };
const BORDER_ALL = {
  top: BORDER_THIN,
  left: BORDER_THIN,
  bottom: BORDER_THIN,
  right: BORDER_THIN,
};

function setRangeBorders(
  ws: import("exceljs").Worksheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  border = BORDER_ALL,
) {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r);
    for (let c = startCol; c <= endCol; c++) {
      row.getCell(c).border = border;
    }
  }
}

function mergeCellsWithBorders(
  ws: import("exceljs").Worksheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  border = BORDER_ALL,
) {
  if (endRow > startRow || endCol > startCol) {
    ws.mergeCells(startRow, startCol, endRow, endCol);
  }
  setRangeBorders(ws, startRow, startCol, endRow, endCol, border);
  return ws.getCell(startRow, startCol);
}

function sectionHeader(ws: import("exceljs").Worksheet, row: number, title: string) {
  const cell = mergeCellsWithBorders(ws, row, 1, row, COLS);
  cell.value = title;
  cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: BRAND_RED },
  };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(row).height = 24;
}

function fullSpanRow(
  ws: import("exceljs").Worksheet,
  row: number,
  label: string,
  value: string,
  labelCols = 2,
) {
  const labelCell = mergeCellsWithBorders(ws, row, 1, row, labelCols);
  labelCell.value = label;
  labelCell.font = { name: "Calibri", bold: true, size: 9.5, color: { argb: "FF374151" } };
  labelCell.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: FIELD_LABEL_FILL } };
  labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  const valueCell = mergeCellsWithBorders(ws, row, labelCols + 1, row, COLS);
  valueCell.value = value;
  valueCell.font = { name: "Calibri", size: 10, color: { argb: "FF0F172A" } };
  valueCell.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } };
  valueCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };

  ws.getRow(row).height = 23;
}

function labelValueRow(
  ws: import("exceljs").Worksheet,
  row: number,
  pairs: Array<{ label: string; value: string }>,
) {
  const cols = [
    { labelCol: 1, valStart: 2, valEnd: 3 },
    { labelCol: 4, valStart: 5, valEnd: 6 },
    { labelCol: 7, valStart: 8, valEnd: 9 },
  ];

  pairs.forEach((pair, idx) => {
    const config = cols[idx];
    if (!config) return;

    const labelCell = ws.getCell(row, config.labelCol);
    labelCell.value = pair.label;
    labelCell.font = { name: "Calibri", bold: true, size: 9.5, color: { argb: "FF374151" } };
    labelCell.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: FIELD_LABEL_FILL } };
    labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    labelCell.border = BORDER_ALL;

    const valueCell = mergeCellsWithBorders(ws, row, config.valStart, row, config.valEnd);
    valueCell.value = pair.value;
    valueCell.font = { name: "Calibri", size: 10, color: { argb: "FF0F172A" } };
    valueCell.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } };
    valueCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
  });

  ws.getRow(row).height = 23;
}

function textBlock(
  ws: import("exceljs").Worksheet,
  startRow: number,
  label: string,
  text: string,
  minRows = 3,
  labelCols = 2,
) {
  const endRow = startRow + minRows - 1;
  const labelCell = mergeCellsWithBorders(ws, startRow, 1, endRow, labelCols);
  labelCell.value = label;
  labelCell.font = { name: "Calibri", bold: true, size: 9.5, color: { argb: "FF374151" } };
  labelCell.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: FIELD_LABEL_FILL } };
  labelCell.alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: 1 };

  const bodyCell = mergeCellsWithBorders(ws, startRow, labelCols + 1, endRow, COLS);
  bodyCell.value = text;
  bodyCell.font = { name: "Calibri", size: 10, color: { argb: "FF0F172A" } };
  bodyCell.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } };
  bodyCell.alignment = { wrapText: true, vertical: "top", indent: 1 };

  const estimatedLines = Math.max(minRows, Math.ceil((text.length || 1) / 100));
  const rowHeight = Math.max(20, Math.ceil((estimatedLines * 16) / minRows));
  for (let i = 0; i < minRows; i++) {
    ws.getRow(startRow + i).height = rowHeight;
  }
  return startRow + minRows;
}

/** Excel alineado con la impresión PDF / ficha del ticket con estilo corporativo y presencia destacada. */
export async function exportClaimToExcel(claim: CustomerClaim): Promise<void> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("PF-FOR-034", {
    views: [{ state: "normal", showGridLines: true, zoomScale: 100 }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });

  // Columnas optimizadas para evitar truncamientos y dar presencia a la tabla de productos
  ws.columns = [
    { width: 22 }, // Col 1 (A): Producto / Etiquetas principales
    { width: 14 }, // Col 2 (B): Código
    { width: 15 }, // Col 3 (C): Unid. compradas
    { width: 18 }, // Col 4 (D): Unid. defectuosas / Etiquetas secundarias
    { width: 13 }, // Col 5 (E): Facturados
    { width: 14 }, // Col 6 (F): Recibidos
    { width: 19 }, // Col 7 (G): Dif. / Etiquetas terciarias (Número PO, Primer contacto, etc.)
    { width: 15 }, // Col 8 (H): Precio
    { width: 18 }, // Col 9 (I): Total línea / Importes
  ];

  try {
    const logoRes = await fetch("/brand/plastifar-logo.png");
    if (logoRes.ok) {
      const imageId = wb.addImage({
        buffer: await logoRes.arrayBuffer(),
        extension: "png",
      });
      ws.addImage(imageId, {
        tl: { col: 0.15, row: 0.15 },
        ext: { width: 130, height: 34 },
      });
    }
  } catch {
    /* sin logo no bloquea la exportación */
  }

  // Fila 1: Título institucional y Código del formulario
  let r = 1;
  const titleCell = mergeCellsWithBorders(ws, r, 3, r, 7);
  titleCell.value = CLAIM_FORM_CONTROL.title;
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: BRAND_RED } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  const codeBadge = mergeCellsWithBorders(ws, r, 8, r, COLS);
  codeBadge.value = CLAIM_FORM_CONTROL.code;
  codeBadge.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E293B" } };
  codeBadge.alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(r).height = 28;

  // Fila 2: Subtítulo y Versión
  r += 1;
  const tagCell = mergeCellsWithBorders(ws, r, 3, r, 7);
  tagCell.value = "Plastifar · Sistema de gestión de calidad";
  tagCell.font = { name: "Calibri", size: 9, color: { argb: "FF64748B" } };
  tagCell.alignment = { horizontal: "center", vertical: "middle" };

  const revBadge = mergeCellsWithBorders(ws, r, 8, r, COLS);
  revBadge.value = `Rev. ${CLAIM_FORM_CONTROL.revision}`;
  revBadge.font = { name: "Calibri", size: 9, color: { argb: "FF64748B" } };
  revBadge.alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(r).height = 16;

  // Fila 3: Línea de acento corporativo roja
  r += 1;
  mergeCellsWithBorders(ws, r, 1, r, COLS);
  ws.getRow(r).height = 4;
  ws.getCell(r, 1).border = {
    bottom: { style: "medium" as const, color: { argb: BRAND_RED } },
  };

  // Fila 4: Franja de metadatos (Fecha de reclamación y Código de ticket)
  r += 1;
  const metaLabel = mergeCellsWithBorders(ws, r, 1, r, 4);
  metaLabel.value = "FORMULARIO DE CONTROL DE RECLAMACIÓN";
  metaLabel.font = { name: "Calibri", size: 8.5, bold: true, color: { argb: "FF64748B" } };
  metaLabel.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  const dateLabel = mergeCellsWithBorders(ws, r, 5, r, 6);
  dateLabel.value = "Fecha de la Reclamación:";
  dateLabel.font = { name: "Calibri", bold: true, size: 9.5, color: { argb: "FF374151" } };
  dateLabel.alignment = { horizontal: "right", vertical: "middle" };

  const dateVal = ws.getCell(r, 7);
  dateVal.value = formatDay(claim.claimDate);
  dateVal.font = { name: "Calibri", size: 10, color: { argb: "FF0F172A" } };
  dateVal.alignment = { horizontal: "center", vertical: "middle" };

  const codeLabel = ws.getCell(r, 8);
  codeLabel.value = "Código:";
  codeLabel.font = { name: "Calibri", bold: true, size: 9.5, color: { argb: "FF374151" } };
  codeLabel.alignment = { horizontal: "right", vertical: "middle" };

  const codeVal = ws.getCell(r, 9);
  codeVal.value = claim.ticketNumber || String(claim.id);
  codeVal.font = { name: "Calibri", bold: true, size: 10.5, color: { argb: BRAND_RED } };
  codeVal.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(r).height = 23;

  // ==========================================
  // I. Información General
  // ==========================================
  r += 2;
  sectionHeader(ws, r, "I. Información General");
  r += 1;
  labelValueRow(ws, r, [
    { label: "Empresa:", value: claim.clientName || "—" },
    { label: "Contacto:", value: claim.contactName ?? "—" },
    { label: "País:", value: claim.country ?? "—" },
  ]);
  r += 1;
  const phones = [claim.contactPhone, claim.clientPhone].filter(Boolean).join(" · ") || "—";
  fullSpanRow(ws, r, "Teléfonos:", phones);

  // ==========================================
  // II. Información General sobre la Reclamación
  // ==========================================
  r += 2;
  sectionHeader(ws, r, "II. Información General sobre la Reclamación");
  r += 1;

  const plantNames = claim.plants.map((p) => p.name).join(" · ") || "—";
  fullSpanRow(ws, r, "Planta(s) involucrada(s):", plantNames);
  r += 1;

  const reasonLabel = topicRequiresOther(claim.reason)
    ? `${claim.reason}${claim.reasonOther?.trim() ? `: ${claim.reasonOther.trim()}` : ""}`
    : claim.reason || "—";
  fullSpanRow(ws, r, "Motivo del reclamo:", reasonLabel);
  r += 1;

  const affectedAreas = claim.affectedAreas.length ? claim.affectedAreas.join(" · ") : "—";
  fullSpanRow(ws, r, "Área(s) afectada(s):", affectedAreas);
  r += 1;

  labelValueRow(ws, r, [
    { label: "Fecha prod. / lote:", value: claim.productionLot ?? "—" },
    { label: "Factura:", value: claim.invoiceRef ?? "—" },
    { label: "Número PO:", value: claim.poNumber ?? "—" },
  ]);
  r += 2;

  // ==========================================
  // Tabla de Productos con Presencia y Estilo
  // ==========================================
  const tableHeaderRow = ws.getRow(r);
  tableHeaderRow.height = 26;
  const tableHeaders = [
    { title: "Producto", align: "left" as const },
    { title: "Código", align: "center" as const },
    { title: "Unid. Compradas", align: "right" as const },
    { title: "Unid. Defectuosas", align: "right" as const },
    { title: "Facturados", align: "right" as const },
    { title: "Recibidos", align: "right" as const },
    { title: "Dif.", align: "right" as const },
    { title: "Precio", align: "right" as const },
    { title: "Total Línea", align: "right" as const },
  ];

  tableHeaders.forEach((h, idx) => {
    const cell = tableHeaderRow.getCell(idx + 1);
    cell.value = h.title;
    cell.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: TABLE_HEADER_FILL } };
    cell.border = BORDER_ALL;
    cell.alignment = { vertical: "middle", horizontal: h.align, indent: h.align === "left" ? 1 : 0 };
  });
  r += 1;

  const lines = [...(claim.lines ?? [])].sort((a, b) => a.position - b.position);
  const currencyCode = claim.currency || "DOP";
  const currencyFmt = currencyCode === "USD" ? '"US$"#,##0.00' : '"RD$"#,##0.00';
  const qtyFmt = '#,##0';
  const priceFmt = '#,##0.00';

  if (lines.length === 0) {
    const emptyCell = mergeCellsWithBorders(ws, r, 1, r, COLS);
    emptyCell.value = "Sin líneas de producto registradas";
    emptyCell.font = { name: "Calibri", italic: true, size: 10, color: { argb: "FF64748B" } };
    emptyCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(r).height = 24;
    r += 1;
  } else {
    lines.forEach((line, index) => {
      const row = ws.getRow(r);
      row.height = 22;
      const isZebra = index % 2 === 1;
      const rowFill = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: isZebra ? ZEBRA_ROW_FILL : "FFFFFFFF" },
      };

      // Col 1: Producto
      const c1 = row.getCell(1);
      c1.value = line.productName || "—";
      c1.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };

      // Col 2: Código
      const c2 = row.getCell(2);
      c2.value = line.productCode || "—";
      c2.font = { name: "Consolas", size: 9.5 };
      c2.alignment = { vertical: "middle", horizontal: "center" };

      // Col 3: Unid. compradas
      const c3 = row.getCell(3);
      if (line.unitsPurchased != null) {
        c3.value = Number(line.unitsPurchased);
        c3.numFmt = qtyFmt;
      } else {
        c3.value = "—";
      }
      c3.alignment = { vertical: "middle", horizontal: "right" };

      // Col 4: Unid. defectuosas
      const c4 = row.getCell(4);
      if (line.defectiveQuantity != null) {
        c4.value = Number(line.defectiveQuantity);
        c4.numFmt = qtyFmt;
      } else {
        c4.value = "—";
      }
      c4.alignment = { vertical: "middle", horizontal: "right" };

      // Col 5: Facturados
      const c5 = row.getCell(5);
      if (line.invoicedQuantity != null) {
        c5.value = Number(line.invoicedQuantity);
        c5.numFmt = qtyFmt;
      } else {
        c5.value = "—";
      }
      c5.alignment = { vertical: "middle", horizontal: "right" };

      // Col 6: Recibidos
      const c6 = row.getCell(6);
      if (line.receivedQuantity != null) {
        c6.value = Number(line.receivedQuantity);
        c6.numFmt = qtyFmt;
      } else {
        c6.value = "—";
      }
      c6.alignment = { vertical: "middle", horizontal: "right" };

      // Col 7: Dif.
      const c7 = row.getCell(7);
      if (line.difference != null) {
        c7.value = Number(line.difference);
        c7.numFmt = qtyFmt;
      } else {
        c7.value = "—";
      }
      c7.alignment = { vertical: "middle", horizontal: "right" };

      // Col 8: Precio
      const c8 = row.getCell(8);
      if (line.unitPrice != null) {
        c8.value = Number(line.unitPrice);
        c8.numFmt = priceFmt;
      } else {
        c8.value = "—";
      }
      c8.alignment = { vertical: "middle", horizontal: "right" };

      // Col 9: Total línea
      const c9 = row.getCell(9);
      c9.value = Number(line.lineTotal) || 0;
      c9.numFmt = currencyFmt;
      c9.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FF0F172A" } };
      c9.alignment = { vertical: "middle", horizontal: "right" };

      for (let c = 1; c <= COLS; c++) {
        const cell = row.getCell(c);
        if (!cell.font) cell.font = { name: "Calibri", size: 10, color: { argb: "FF0F172A" } };
        cell.fill = rowFill;
        cell.border = BORDER_ALL;
      }
      r += 1;
    });

    // Fila destacada de Total General de la Tabla
    const totalRow = ws.getRow(r);
    totalRow.height = 26;
    mergeCellsWithBorders(ws, r, 1, r, 8);
    const labelTotal = totalRow.getCell(1);
    labelTotal.value = "TOTAL RECLAMACIÓN:";
    labelTotal.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FF1E293B" } };
    labelTotal.alignment = { vertical: "middle", horizontal: "right" };
    labelTotal.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF1F5F9" } };

    const valTotal = totalRow.getCell(9);
    valTotal.value = Number(claim.totalAmount) || 0;
    valTotal.numFmt = currencyFmt;
    valTotal.font = { name: "Calibri", bold: true, size: 11, color: { argb: BRAND_RED } };
    valTotal.alignment = { vertical: "middle", horizontal: "right" };
    valTotal.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: BRAND_RED_LIGHT } };

    const borderTotal = {
      top: { style: "thin" as const, color: { argb: "FF94A3B8" } },
      bottom: { style: "double" as const, color: { argb: "FF0F172A" } },
      left: { style: "thin" as const, color: { argb: BORDER_COLOR } },
      right: { style: "thin" as const, color: { argb: BORDER_COLOR } },
    };
    for (let c = 1; c <= 8; c++) totalRow.getCell(c).border = borderTotal;
    valTotal.border = {
      ...borderTotal,
      bottom: { style: "double" as const, color: { argb: BRAND_RED } },
    };
    r += 1;
  }

  r += 1;
  // Fila de retorno y defecto identificado (sin apretar el total)
  const retLabel = mergeCellsWithBorders(ws, r, 1, r, 2);
  retLabel.value = "Unid. a retornar:";
  retLabel.font = { name: "Calibri", bold: true, size: 9.5, color: { argb: "FF374151" } };
  retLabel.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: FIELD_LABEL_FILL } };
  retLabel.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  const retVal = mergeCellsWithBorders(ws, r, 3, r, 4);
  retVal.value = claim.unitsToReturn != null ? formatQuantity(claim.unitsToReturn) : "—";
  retVal.font = { name: "Calibri", size: 10, color: { argb: "FF0F172A" } };
  retVal.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } };
  retVal.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  const defLabel = mergeCellsWithBorders(ws, r, 5, r, 6);
  defLabel.value = "Defecto identificado:";
  defLabel.font = { name: "Calibri", bold: true, size: 9.5, color: { argb: "FF374151" } };
  defLabel.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: FIELD_LABEL_FILL } };
  defLabel.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  const defVal = mergeCellsWithBorders(ws, r, 7, r, COLS);
  defVal.value = claim.defectFoundDuring ?? "—";
  defVal.font = { name: "Calibri", size: 10, color: { argb: "FF0F172A" } };
  defVal.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } };
  defVal.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(r).height = 23;

  // ==========================================
  // III. Descripción de la Reclamación
  // ==========================================
  r += 2;
  sectionHeader(ws, r, "III. Descripción de la Reclamación");
  r += 1;
  r = textBlock(ws, r, "Descripción:", claim.description?.trim() || "—", 4);
  if (claim.comments?.trim()) {
    r = textBlock(ws, r, "Comentarios:", claim.comments.trim(), 2);
  }
  labelValueRow(ws, r, [
    { label: "Recibida por:", value: claim.receivedByName || "—" },
    { label: "Fecha recepción:", value: formatDay(claim.receivedAt) },
    {
      label: "Primer contacto:",
      value: claim.firstCustomerContactAt ? formatDay(claim.firstCustomerContactAt) : "—",
    },
  ]);

  // ==========================================
  // IV. Tratamiento de la Reclamación
  // ==========================================
  r += 2;
  sectionHeader(ws, r, "IV. Tratamiento de la Reclamación · Depto. de Calidad");
  r += 1;

  r = textBlock(ws, r, "Primera respuesta (corrección):", claim.firstResponseCorrection?.trim() || "—", 2);
  const corrective =
    claim.requiresCorrectiveAction === null
      ? "Sin responder"
      : claim.requiresCorrectiveAction
        ? `Sí${claim.hcaNumber ? ` · HCA ${claim.hcaNumber}` : ""}`
        : "No";
  fullSpanRow(ws, r, "Acción correctiva:", corrective);
  r += 1;

  r = textBlock(ws, r, "Análisis causa raíz:", claim.rootCauseAnalysis?.trim() || "—", 3);
  r = textBlock(ws, r, "Acciones correctivas / preventivas:", claim.correctiveActions?.trim() || "—", 3);

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

  fullSpanRow(ws, r, "Responsable cierre:", claim.closedByName ?? "—");
  r += 1;

  if (claim.observations?.trim()) {
    r = textBlock(ws, r, "Observaciones:", claim.observations.trim(), 2);
  }

  // Fila institucional de pie de página
  r += 1;
  const footerCell = mergeCellsWithBorders(ws, r, 1, r, COLS);
  footerCell.value = [
    CLAIM_FORM_CONTROL.code,
    `Revisión ${CLAIM_FORM_CONTROL.revision}`,
    `Sustituye a ${CLAIM_FORM_CONTROL.replaces}`,
    `Última revisión ${CLAIM_FORM_CONTROL.lastRevision}`,
    `Creación ${CLAIM_FORM_CONTROL.createdOn}`,
    `Emitido por: ${claim.receivedByName || "—"}`,
  ].join("   ·   ");
  footerCell.font = { name: "Calibri", size: 8, italic: true, color: { argb: "FF64748B" } };
  footerCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  footerCell.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } };
  ws.getRow(r).height = 20;

  await downloadWorkbook(wb, `PF-FOR-034_${claim.ticketNumber || claim.id}.xlsx`);
}

export function exportClaimsListToExcel(claims: ClaimSummary[]): Promise<void> {
  return exportPlastifarListToExcel(claims, claimListOptions());
}

/** Mismo contenido y jerarquía visual que el Excel de listado (cabecera corporativa y tabla). */
export function exportClaimsListToPdf(claims: ClaimSummary[]): Promise<void> {
  return exportPlastifarListToPdf(claims, claimListOptions());
}
