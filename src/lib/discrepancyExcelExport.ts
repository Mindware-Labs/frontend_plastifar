import { discrepanciesApi } from "../api/discrepancies";
import type { DiscrepancyDetail, LoadDiscrepancy } from "../types/discrepancies";
import { downloadWorkbook } from "./hcaExcelExport";

/** Exporta una investigación de discrepancia de carga en la plantilla oficial PF-FOR-291. */
export async function exportDiscrepancyToExcel(
  input: DiscrepancyDetail | LoadDiscrepancy | number,
): Promise<void> {
  let detail: DiscrepancyDetail;

  if (typeof input === "number") {
    detail = await discrepanciesApi.get(input);
  } else if ("discrepancy" in input) {
    detail = input;
  } else {
    // Es LoadDiscrepancy, verificar si tiene checks y lines completos
    if (!input.checks || input.checks.length === 0) {
      detail = await discrepanciesApi.get(input.id);
    } else {
      detail = { discrepancy: input };
    }
  }

  const d = detail.discrepancy;
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const wb = new ExcelJS.Workbook();

  const res = await fetch("/templates/PF-FOR-291.xlsx");
  if (!res.ok) throw new Error("No se pudo cargar la plantilla PF-FOR-291.xlsx");
  const arrayBuffer = await res.arrayBuffer();
  await wb.xlsx.load(arrayBuffer);

  const sheet = wb.getWorksheet("PF-FOR-291") || wb.worksheets[0];
  if (!sheet) throw new Error("Hoja PF-FOR-291 no encontrada en la plantilla");

  // Quitar vista de salto de página y dejar vista normal
  sheet.views = [{ state: "normal", showGridLines: true, zoomScale: 100, zoomScaleNormal: 100 }];

  // Cabecera de control documental
  sheet.getCell("B3").value = "PF-FOR-291";
  sheet.getCell("D3").value = d.createdAt ? d.createdAt.slice(0, 10) : "";
  sheet.getCell("F3").value = d.performedByName || "Williams Marte";
  sheet.getCell("G3").value = d.approvedByName || "Santos Rosario";
  sheet.getCell("I3").value = 1;
  sheet.getCell("L3").value = (d.approvedAt || d.performedAt || d.createdAt || "").slice(0, 10);

  // Líneas de la investigación (filas 7 a 13)
  (d.lines || []).forEach((line, index) => {
    const r = 7 + index;
    sheet.getCell(`B${r}`).value = line.claimRef || "";
    sheet.getCell(`C${r}`).value = line.invoiceRef || "";
    sheet.getCell(`D${r}`).value = line.clientName || "";
    sheet.getCell(`E${r}`).value = line.productCode || "";
    sheet.getCell(`F${r}`).value = line.productName || "";
    sheet.getCell(`G${r}`).value = line.surplusQuantity > 0 ? line.surplusQuantity : "";
    sheet.getCell(`H${r}`).value = line.shortageQuantity > 0 ? line.shortageQuantity : "";
    sheet.getCell(`I${r}`).value = line.qualifiesForCreditNote === true ? "X" : "";
    sheet.getCell(`J${r}`).value = line.qualifiesForCreditNote === false ? "X" : "";
    sheet.getCell(`K${r}`).value = line.creditNoteNumber || line.creditRequestNumber || "";
    sheet.getCell(`L${r}`).value = line.dispatcherName || "";
    sheet.getCell(`M${r}`).value = line.supervisorName || "";
  });

  // Firmas y nota
  sheet.getCell("B14").value = `Realizado por: ${d.performedByName || "______________________________"}`;
  sheet.getCell("B16").value = `Aprobado por: ${
    d.status === "Aprobada" ? d.approvedByName || "" : "______________________________"
  }`;
  sheet.getCell("G14").value = d.note || "";

  // Puntos de seguridad (filas 21 a 29)
  (d.checks || []).forEach((c) => {
    const r = 20 + c.itemNumber;
    if (r >= 21 && r <= 29) {
      sheet.getCell(`J${r}`).value = c.result === "Positivo" ? "X" : "";
      sheet.getCell(`L${r}`).value = c.result === "Negativo" ? "X" : "";
    }
  });

  await downloadWorkbook(wb, `PF-FOR-291_${d.number}.xlsx`);
}
