import { withdrawalsApi } from "../api/withdrawals";
import type { MerchandiseWithdrawal, WithdrawalDetail } from "../types/withdrawals";
import { downloadWorkbook } from "./hcaExcelExport";
import { formatQuantity } from "./numbers";
import { splitIsoDate } from "./withdrawals";

/** Exporta una solicitud de retiro de mercancía en la plantilla oficial PF-FOR-068 (FR-Retiro de Mercancia). */
export async function exportWithdrawalToExcel(
  input: WithdrawalDetail | MerchandiseWithdrawal | number,
): Promise<void> {
  let w: MerchandiseWithdrawal;

  if (typeof input === "number") {
    const detail = await withdrawalsApi.get(input);
    w = detail.withdrawal;
  } else if ("withdrawal" in input) {
    w = input.withdrawal;
  } else {
    if (!input.lines) {
      const detail = await withdrawalsApi.get(input.id);
      w = detail.withdrawal;
    } else {
      w = input;
    }
  }

  const ExcelJSModule = await import("exceljs");
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const wb = new ExcelJS.Workbook();

  const res = await fetch("/templates/PF-FOR-068.xlsx");
  if (!res.ok) throw new Error("No se pudo cargar la plantilla PF-FOR-068.xlsx");
  const arrayBuffer = await res.arrayBuffer();
  await wb.xlsx.load(arrayBuffer);

  const sheet = wb.getWorksheet("FR-Retiro de Mercancia") || wb.worksheets[0];
  if (!sheet) throw new Error("Hoja FR-Retiro de Mercancia no encontrada en la plantilla");

  // Vista limpia sin líneas de cuadrícula de fondo, respetando el encuadre del formulario
  sheet.views = [{ state: "normal", showGridLines: false, zoomScale: 100, zoomScaleNormal: 100 }];

  // Nombre de la empresa (C6:G6)
  sheet.getCell("C6").value = w.clientName || "";

  // Motivo: Por Devolución (B8) / Por Cambio (B9)
  sheet.getCell("B8").value = w.reason === "Por devolución" ? "X" : "";
  sheet.getCell("B9").value = w.reason === "Por cambio" ? "X" : "";

  // Fecha dividida en DIA (I9:J10), MES (K9:M10), AÑO (N9:N10)
  const { day, month, year } = splitIsoDate(w.requestDate);
  sheet.getCell("I9").value = day ? Number(day) || day : "";
  sheet.getCell("K9").value = month ? Number(month) || month : "";
  sheet.getCell("N9").value = year ? Number(year) || year : "";

  // Limpiar primero las 15 filas base de la plantilla (filas 13 a 27)
  for (let r = 13; r <= 27; r++) {
    sheet.getCell(`A${r}`).value = "";
    sheet.getCell(`B${r}`).value = "";
    sheet.getCell(`C${r}`).value = "";
    sheet.getCell(`D${r}`).value = "";
    sheet.getCell(`I${r}`).value = "";
    sheet.getCell(`L${r}`).value = "";
  }

  // Rellenar líneas de productos (filas 13 en adelante)
  const lines = [...(w.lines || [])].sort((a, b) => a.position - b.position);
  lines.slice(0, 15).forEach((line, index) => {
    const r = 13 + index;
    const unitSuffix = line.quantityUnit ? line.quantityUnit.trim().toUpperCase() : "";
    const qtyCellText = `${formatQuantity(line.quantity)}${unitSuffix}`;

    sheet.getCell(`A${r}`).value = line.productCode || "";
    sheet.getCell(`A${r}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`B${r}`).value = qtyCellText;
    sheet.getCell(`B${r}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`C${r}`).value = line.packDetail || "";
    sheet.getCell(`C${r}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`D${r}`).value = line.productName || "";
    sheet.getCell(`D${r}`).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    sheet.getCell(`I${r}`).value = line.unitPrice != null ? Number(line.unitPrice) : "";
    sheet.getCell(`I${r}`).numFmt = "#,##0.00";
    sheet.getCell(`I${r}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`L${r}`).value = line.lineValue != null ? Number(line.lineValue) : "";
    sheet.getCell(`L${r}`).numFmt = "#,##0.00";
    sheet.getCell(`L${r}`).alignment = { horizontal: "center", vertical: "middle" };
  });

  // Firmas en fila 30: Vendedor (B30:C30), Almacén (E30:F30), Cliente (I30:L30)
  try {
    sheet.mergeCells("B30:C30");
  } catch {
    /* ya combinada */
  }
  try {
    sheet.mergeCells("E30:F30");
  } catch {
    /* ya combinada */
  }
  try {
    sheet.mergeCells("I30:M30");
  } catch {
    /* ya combinada */
  }

  sheet.getCell("B30").value = w.requestedByName || "";
  sheet.getCell("B30").alignment = { horizontal: "center", vertical: "bottom" };

  sheet.getCell("E30").value = w.warehouseStaffName || "";
  sheet.getCell("E30").alignment = { horizontal: "center", vertical: "bottom" };

  sheet.getCell("I30").value = w.customerSignerName || "";
  sheet.getCell("I30").alignment = { horizontal: "center", vertical: "bottom" };

  await downloadWorkbook(wb, `PF-FOR-068_${w.number || w.id}.xlsx`);
}
