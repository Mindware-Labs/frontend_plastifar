import type { ActionPlanItem, CorrectiveActionSheet } from "../types/quality";
import { qualityApi } from "../api/quality";
import { formatDay } from "./dates";
import { caseReferenceColumnLabel } from "./formCaseReference";
import { hcaProductLabel } from "./hcaForm109";

export async function downloadWorkbook(wb: any, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exporta una ficha HCA (Hecho, Causa y Acción) en el formato oficial
 * de la plantilla Excel PF-FOR-109 con auto-ajuste de altura en HECHO
 * y demás secciones para evitar que el texto se recorte.
 */
export async function exportHcaToExcel(
  sheet: CorrectiveActionSheet,
  planItemsParam?: ActionPlanItem[],
): Promise<void> {
  let planItems = planItemsParam;
  let fullSheet = sheet;

  // Si no llegaron las acciones o causas completas, releer el detalle completo del servidor
  if (!planItems || planItems.length === 0 || !sheet.causes || !sheet.participants) {
    try {
      const detail = await qualityApi.sheets.get(sheet.id);
      if (detail?.sheet) fullSheet = detail.sheet;
      if (detail?.planItems) planItems = detail.planItems;
    } catch (err) {
      console.warn("No se pudo cargar detalle completo de la HCA para exportación, usando datos disponibles:", err);
    }
  }
  const items = planItems ?? [];

  const ExcelJSModule = await import("exceljs");
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const wb = new ExcelJS.Workbook();

  const res = await fetch("/templates/PF-FOR-109.xlsx");
  if (!res.ok) throw new Error("No se pudo cargar la plantilla PF-FOR-109.xlsx");
  const arrayBuffer = await res.arrayBuffer();
  await wb.xlsx.load(arrayBuffer);

  const ws = wb.getWorksheet("HCA") || wb.worksheets[0];
  if (!ws) throw new Error("Hoja HCA no encontrada en la plantilla PF-FOR-109");

  // Quitar vista de salto de página y dejar vista normal
  ws.views = [{ state: "normal", showGridLines: true, zoomScale: 100, zoomScaleNormal: 100 }];

  // 1. Cabecera (D2:H4) con mayor notoriedad (en negrita)
  const headerFontBold = { name: "Trebuchet MS", size: 10, bold: true };
  ["D2", "F2", "G2", "H2", "D3", "F3", "G3", "H3", "D4", "F4", "G4", "H4"].forEach((coord) => {
    ws.getCell(coord).font = headerFontBold;
  });

  ws.getCell("F2").value = fullSheet.number || "";
  ws.getCell("H2").value = hcaProductLabel(fullSheet) || "";

  ws.getCell("F3").value = fullSheet.detectedAt ? formatDay(fullSheet.detectedAt.slice(0, 10)) : "";
  ws.getCell("H3").value = fullSheet.plantName || "";

  ws.getCell("F4").value = fullSheet.createdByName || "";
  ws.getCell("H4").value = fullSheet.responsibleName || "";

  // 2. HECHO (A6:A10, contenido en B6:H10)
  const hechoParts = [fullSheet.description?.trim() || ""];
  if (fullSheet.immediateAction?.trim()) {
    hechoParts.push(`Acción inmediata: ${fullSheet.immediateAction.trim()}`);
  }
  if (fullSheet.clientName) {
    let clientLine = `Cliente: ${fullSheet.clientName}`;
    if (fullSheet.ticketNumber) {
      clientLine += ` · ${caseReferenceColumnLabel(fullSheet.ticketNumber)}: ${fullSheet.ticketNumber}`;
    }
    hechoParts.push(clientLine);
  }
  const hechoText = hechoParts.join("\n\n");
  ws.getCell("B6").value = hechoText;
  ws.getCell("B6").alignment = { wrapText: true, vertical: "top" };

  // Cálculo dinámico de altura para HECHO: evitar recorte de texto
  const hechoLines = hechoText.split("\n");
  let estimatedHechoLines = 0;
  for (const line of hechoLines) {
    if (!line.trim()) {
      estimatedHechoLines += 1;
    } else {
      estimatedHechoLines += Math.max(1, Math.ceil(line.length / 95));
    }
  }
  const neededHechoHeight = Math.max(75, estimatedHechoLines * 18 + 14);
  const baseRows6to9Height =
    (ws.getRow(6).height || 15.75) +
    (ws.getRow(7).height || 12.75) +
    (ws.getRow(8).height || 15) +
    (ws.getRow(9).height || 13.5);
  ws.getRow(10).height = Math.max(14.25, neededHechoHeight - baseRows6to9Height);

  // 3. CAUSAS (A12:A18, renglones B13 a B18)
  const causes = [...(fullSheet.causes ?? [])].sort((a, b) => a.position - b.position);
  causes.forEach((cause, idx) => {
    const r = 13 + idx;
    if (r <= 18) {
      ws.getCell(`B${r}`).value = `${idx + 1}. ${cause.description}`;
      ws.getCell(`B${r}`).alignment = { wrapText: true, vertical: "middle" };
    }
  });

  // 4. PLAN DE ACCIÓN (A20:A33)
  if (items.length === 1) {
    ws.getCell("B21").value = items[0].description;
    ws.getCell("F21").value = items[0].responsibleName || "";
    ws.getCell("H21").value = items[0].dueDate ? formatDay(items[0].dueDate) : "";
  } else if (items.length === 2) {
    ws.getCell("B21").value = items[0].description;
    ws.getCell("F21").value = items[0].responsibleName || "";
    ws.getCell("H21").value = items[0].dueDate ? formatDay(items[0].dueDate) : "";

    ws.getCell("B24").value = items[1].description;
    ws.getCell("F24").value = items[1].responsibleName || "";
    ws.getCell("H24").value = items[1].dueDate ? formatDay(items[1].dueDate) : "";
  } else if (items.length > 2) {
    ws.getCell("B21").value = items[0].description;
    ws.getCell("F21").value = items[0].responsibleName || "";
    ws.getCell("H21").value = items[0].dueDate ? formatDay(items[0].dueDate) : "";

    const rest = items.slice(1);
    ws.getCell("B24").value = rest.map((item, i) => `${i + 2}. ${item.description}`).join("\n");
    ws.getCell("F24").value = rest.map((item) => item.responsibleName || "").join("\n");
    ws.getCell("H24").value = rest.map((item) => (item.dueDate ? formatDay(item.dueDate) : "")).join("\n");
  }
  ws.getCell("B21").alignment = { wrapText: true, vertical: "top" };
  ws.getCell("F21").alignment = { wrapText: true, vertical: "top" };
  ws.getCell("H21").alignment = { wrapText: true, vertical: "top", horizontal: "center" };
  ws.getCell("B24").alignment = { wrapText: true, vertical: "top" };
  ws.getCell("F24").alignment = { wrapText: true, vertical: "top" };
  ws.getCell("H24").alignment = { wrapText: true, vertical: "top", horizontal: "center" };

  // Altura dinámica para acciones si el contenido es largo
  if (items[0]?.description) {
    const actLines = items[0].description.split("\n");
    let estAct1 = 0;
    for (const l of actLines) estAct1 += Math.max(1, Math.ceil(l.length / 45));
    if (estAct1 > 3) {
      ws.getRow(23).height = Math.max(35.25, estAct1 * 16 - 25.5);
    }
  }
  const act2Desc = typeof ws.getCell("B24").value === "string" ? (ws.getCell("B24").value as string) : "";
  if (act2Desc) {
    const actLines = act2Desc.split("\n");
    let estAct2 = 0;
    for (const l of actLines) estAct2 += Math.max(1, Math.ceil(l.length / 45));
    if (estAct2 > 3) {
      ws.getRow(27).height = Math.max(12.75, estAct2 * 16 - 38.25);
    }
  }

  // Evidencias (B31:E33, F31:F33, G31:G33, H31:H33)
  const evidences = items.filter((i) => i.evidenceNotes || (i.attachments && i.attachments.length > 0));
  const evidenceCells = ["B31", "F31", "G31", "H31"];
  evidences.slice(0, 4).forEach((ev, idx) => {
    const cellCoord = evidenceCells[idx];
    const lines = [
      ev.description,
      ev.evidenceNotes || "",
      ev.attachments && ev.attachments.length > 0
        ? `Adjuntos: ${ev.attachments.map((a) => a.fileName).join(", ")}`
        : "",
    ].filter(Boolean);
    ws.getCell(cellCoord).value = lines.join("\n");
    ws.getCell(cellCoord).alignment = { wrapText: true, vertical: "top" };
  });

  // 5. PARTICIPANTES (A35:A39, renglones 36 a 39) - mayor tamaño y notoriedad
  ws.getRow(35).height = 18;
  const participantHeaderFont = { name: "Trebuchet MS", size: 11, bold: true };
  ws.getCell("A35").font = participantHeaderFont;
  ws.getCell("B35").font = participantHeaderFont;
  ws.getCell("F35").font = participantHeaderFont;

  const participantFont = { name: "Trebuchet MS", size: 10 };
  const participants = fullSheet.participants ?? [];
  participants.slice(0, 4).forEach((p, idx) => {
    const r = 36 + idx;
    ws.getRow(r).height = 22;
    ws.getCell(`B${r}`).value = p.name;
    ws.getCell(`B${r}`).font = participantFont;
    ws.getCell(`F${r}`).value = p.acknowledgedAt
      ? `Confirmó en el sistema el ${formatDay(p.acknowledgedAt.slice(0, 10))}`
      : "";
    ws.getCell(`F${r}`).font = participantFont;
    ws.getCell(`B${r}`).alignment = { wrapText: true, vertical: "middle" };
    ws.getCell(`F${r}`).alignment = { wrapText: true, vertical: "middle" };
  });

  // 6. COMENTARIOS (A40:A42, celda B40:H42) - mayor tamaño y altura
  ws.getRow(40).height = 18;
  ws.getRow(41).height = 32;
  const commentHeaderFont = { name: "Trebuchet MS", size: 11, bold: true };
  ws.getCell("A40").font = commentHeaderFont;

  const commentFont = { name: "Trebuchet MS", size: 10.5 };
  if (fullSheet.comments?.trim()) {
    ws.getCell("B40").value = fullSheet.comments.trim();
    ws.getCell("B40").font = commentFont;
    ws.getCell("B40").alignment = { wrapText: true, vertical: "top" };

    const commentLines = fullSheet.comments.trim().split("\n");
    let estCommentLines = 0;
    for (const line of commentLines) {
      if (!line.trim()) estCommentLines += 1;
      else estCommentLines += Math.max(1, Math.ceil(line.length / 95));
    }
    const neededCommentHeight = Math.max(92, estCommentLines * 18 + 14);
    const rows40to41 = 18 + 32;
    ws.getRow(42).height = Math.max(42, neededCommentHeight - rows40to41);
  } else {
    ws.getCell("B40").value = "";
    ws.getCell("B40").font = commentFont;
    ws.getCell("B40").alignment = { wrapText: true, vertical: "top" };
    ws.getRow(42).height = 42;
  }

  // 7. Control documental en pie de página
  if (ws.headerFooter) {
    const emitter = fullSheet.createdByName || fullSheet.responsibleName || "";
    ws.headerFooter.oddFooter = `&LRevisión: 00\nSustituye a: N/A&CÚltima revisión: N/A\nEmitido por: ${emitter}&RFecha emisión: 17 .04.2015\nPF-FOR-109`;
  }

  await downloadWorkbook(wb, `PF-FOR-109_${fullSheet.number}.xlsx`);
}
