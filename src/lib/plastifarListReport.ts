import { downloadWorkbook } from "./hcaExcelExport";

const PLASTIFAR_TAGLINE = "Plastifar · Sistema de gestión de calidad";
const LIST_TABLE_HEADER_FILL = "FFF4F4F5";
const LIST_ZEBRA_FILL = "FFF9FAFB";
const BRAND_RED = "FFE4002B";
const BORDER_THIN = { style: "thin" as const, color: { argb: "FF000000" } };
const BORDER_ALL = {
  top: BORDER_THIN,
  left: BORDER_THIN,
  bottom: BORDER_THIN,
  right: BORDER_THIN,
};

const LIST_HEADER_ROW = 5;
const LIST_TABLE_HEADER_ROW = 6;
const LIST_DATA_START_ROW = 7;

export interface PlastifarListReportOptions<T> {
  reportTitle: string;
  formCode: string;
  formRevision: string;
  filenameStem: string;
  worksheetName: string;
  listBandTitle: string;
  headers: readonly string[];
  colWeights: readonly number[];
  rightAlignColumns?: readonly number[];
  amountColumnIndex?: number;
  getRowValues: (item: T) => string[];
  getAmountValue?: (item: T) => number;
}

function listSubtitle(count: number): string {
  return `Generado el ${new Date().toLocaleDateString("es-DO")} · Total de registros: ${count}`;
}

function scaleColumnWidths(tableWidth: number, weights: readonly number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const widths = weights.map((weight) => (weight / total) * tableWidth);
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

function applyCorporateHeader(
  ws: import("exceljs").Worksheet,
  count: number,
  colCount: number,
  options: Pick<PlastifarListReportOptions<unknown>, "reportTitle" | "formCode" | "formRevision">,
): void {
  ws.mergeCells(1, 3, 1, colCount - 1);
  const titleCell = ws.getCell(1, 3);
  titleCell.value = options.reportTitle;
  titleCell.font = { name: "Calibri", size: 15, bold: true, color: { argb: BRAND_RED } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells(2, 3, 2, colCount - 1);
  const taglineCell = ws.getCell(2, 3);
  taglineCell.value = PLASTIFAR_TAGLINE;
  taglineCell.font = { name: "Calibri", size: 9, color: { argb: "FF515151" } };
  taglineCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.getCell(1, colCount).value = options.formCode;
  ws.getCell(1, colCount).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF18181B" } };
  ws.getCell(1, colCount).alignment = { horizontal: "right", vertical: "middle" };

  ws.getCell(2, colCount).value = `Rev. ${options.formRevision}`;
  ws.getCell(2, colCount).font = { name: "Calibri", size: 9, color: { argb: "FF515151" } };
  ws.getCell(2, colCount).alignment = { horizontal: "right", vertical: "middle" };

  ws.mergeCells(3, 1, 3, colCount);
  const metaCell = ws.getCell(3, 1);
  metaCell.value = listSubtitle(count);
  metaCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF515151" } };
  metaCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells(4, 1, 4, colCount);
  ws.getRow(4).height = 6;
  ws.getCell(4, 1).border = {
    bottom: { style: "medium", color: { argb: BRAND_RED } },
  };

  ws.getRow(1).height = 26;
  ws.getRow(2).height = 16;
  ws.getRow(3).height = 18;
}

function sectionHeader(ws: import("exceljs").Worksheet, row: number, title: string, colCount: number) {
  ws.mergeCells(row, 1, row, colCount);
  const cell = ws.getCell(row, 1);
  cell.value = title;
  cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_RED } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(row).height = 20;
}

export async function exportPlastifarListToExcel<T>(
  items: T[],
  options: PlastifarListReportOptions<T>,
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const colCount = options.headers.length;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Plastifar S.A.";
  wb.created = new Date();

  const ws = wb.addWorksheet(options.worksheetName, {
    views: [{ state: "normal", showGridLines: false, zoomScale: 100 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = options.headers.map(() => ({ width: 16 }));

  await embedPlastifarLogoOnSheet(wb, ws);
  applyCorporateHeader(ws, items.length, colCount, options);
  sectionHeader(ws, LIST_HEADER_ROW, options.listBandTitle, colCount);

  const headerRow = ws.getRow(LIST_TABLE_HEADER_ROW);
  headerRow.height = 22;
  const rightCols = new Set(options.rightAlignColumns ?? []);
  options.headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF18181B" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIST_TABLE_HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: rightCols.has(idx) ? "right" : "left" };
    cell.border = BORDER_ALL;
  });

  items.forEach((item, i) => {
    const row = ws.getRow(LIST_DATA_START_ROW + i);
    row.height = 20;
    const values = options.getRowValues(item);

    values.forEach((v, idx) => {
      const cell = row.getCell(idx + 1);
      const isAmount = options.amountColumnIndex === idx && options.getAmountValue;
      cell.value = isAmount ? options.getAmountValue!(item) : v;
      cell.font = { name: "Calibri", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: rightCols.has(idx) ? "right" : "left" };
      if (isAmount) cell.numFmt = "#,##0.00";
      cell.border = BORDER_ALL;
      if (i % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIST_ZEBRA_FILL } };
      }
    });
  });

  await downloadWorkbook(wb, `${options.filenameStem}.xlsx`);
}

export async function exportPlastifarListToPdf<T>(
  items: T[],
  options: PlastifarListReportOptions<T>,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });

  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableWidth = pageWidth - margin * 2;
  const colWidths = scaleColumnWidths(tableWidth, options.colWeights);
  const lineHeight = 3.6;
  const cellPadX = 1.2;
  const cellPadY = 2.2;
  const headerFontSize = 7.5;
  const headerLineHeight = 3.1;
  const brandRed: [number, number, number] = [228, 0, 43];
  const tableHeaderFill: [number, number, number] = [244, 244, 245];
  const zebraFill: [number, number, number] = [249, 250, 251];
  const logoDataUrl = await loadPlastifarLogoDataUrl();
  const rightCols = new Set(options.rightAlignColumns ?? []);

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
    doc.text(options.reportTitle, centerX, startY + 4.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(81, 81, 81);
    doc.text(PLASTIFAR_TAGLINE.toUpperCase(), centerX, startY + 8.5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(24, 24, 27);
    doc.text(options.formCode, pageWidth - margin, startY + 4, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Rev. ${options.formRevision}`, pageWidth - margin, startY + 8, { align: "right" });

    let y = startY + logoH + 3;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(listSubtitle(items.length), centerX, y, { align: "center" });
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
    doc.text(options.listBandTitle, margin + 2, y + 4.8);
    return y + 9;
  }

  function measureColumnHeaderHeight(): number {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(headerFontSize);
    let maxLines = 1;
    for (let i = 0; i < options.headers.length; i++) {
      const lines = doc.splitTextToSize(options.headers[i], colWidths[i] - cellPadX * 2);
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
    for (let i = 0; i < options.headers.length; i++) {
      doc.setFillColor(...tableHeaderFill);
      doc.rect(x, y, colWidths[i], headerHeight, "F");
      doc.rect(x, y, colWidths[i], headerHeight, "S");
      doc.setTextColor(24, 24, 27);
      const lines = doc.splitTextToSize(options.headers[i], colWidths[i] - cellPadX * 2);
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
      `${options.formCode} · Rev. ${options.formRevision} · Plastifar S.A. · Página ${page} de ${totalPages}`,
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
  for (const item of items) {
    const values = options.getRowValues(item);
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
      const align = rightCols.has(col) ? "right" : "left";
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

  doc.save(`${options.filenameStem}.pdf`);
}
