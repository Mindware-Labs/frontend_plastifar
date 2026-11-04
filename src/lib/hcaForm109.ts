import { caseReferenceColumnLabel } from "./formCaseReference";
import type { CorrectiveActionSheet } from "../types/quality";

/** Control documental del PF-FOR-109 (plantilla V0). */
export const HCA_FORM_CONTROL = {
  code: "PF-FOR-109",
  revision: "00",
  replaces: "N/A",
  lastRevision: "N/A",
  issuedOn: "17.04.2015",
} as const;

export function buildHcaHechoText(sheet: CorrectiveActionSheet): string {
  const parts = [sheet.description.trim()];
  if (sheet.immediateAction?.trim()) {
    parts.push(`Acción inmediata: ${sheet.immediateAction.trim()}`);
  }
  if (sheet.clientName) {
    let clientLine = `Cliente: ${sheet.clientName}`;
    if (sheet.ticketNumber) {
      clientLine += ` · ${caseReferenceColumnLabel(sheet.ticketNumber)}: ${sheet.ticketNumber}`;
    }
    parts.push(clientLine);
  }
  return parts.join("\n\n");
}

export function hcaProductLabel(sheet: CorrectiveActionSheet): string {
  if (sheet.productName) {
    return sheet.productCode ? `${sheet.productCode} · ${sheet.productName}` : sheet.productName;
  }
  return sheet.productLineName;
}
