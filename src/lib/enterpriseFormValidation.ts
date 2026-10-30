import { topicRequiresOther } from "../types/claims";
import type { ValidationItem } from "./validationItems";
import { buildValidationItems } from "./validationItems";
import { today } from "./quality";

/** Enfoca un control del formulario por atributo `name` (react-hook-form). */
export function focusFormFieldByName(name: string) {
  const el = document.querySelector(`[name="${CSS.escape(name)}"]`);
  if (!(el instanceof HTMLElement)) return;
  el.focus();
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function check(id: string, label: string, short: string, valid: boolean) {
  return { id, label, short, valid };
}

export type ClaimStepValues = {
  claimDate: string;
  topicId: string;
  reasonOther: string;
  affectedAreas: string[];
  plantIds: string[];
  currency: string;
  description: string;
  firstCustomerContactAt: string;
  lines: Array<{ productId: string; unitPrice: string }>;
};

export function getClaimStepMissing(
  step: 1 | 2 | 3 | 4,
  values: ClaimStepValues,
  topicLabel: string | null | undefined,
): ValidationItem[] {
  const checks: Array<{ id: string; label: string; short: string; valid: boolean }> = [];

  if (step === 1) {
    checks.push(
      check(
        "claimDate",
        "Indica la fecha de la reclamación",
        "la fecha de la reclamación",
        Boolean(values.claimDate && values.claimDate <= today()),
      ),
    );
  }

  if (step === 2) {
    checks.push(
      check("topicId", "Elige el motivo del reclamo", "el motivo", values.topicId.trim().length > 0),
      check(
        "reasonOther",
        "Especifica el motivo (mínimo 3 caracteres)",
        "el detalle del motivo",
        !topicRequiresOther(topicLabel ?? "") || values.reasonOther.trim().length >= 3,
      ),
      check(
        "affectedAreas",
        "Marca al menos un área afectada",
        "un área afectada",
        values.affectedAreas.length > 0,
      ),
      check(
        "plantIds",
        "Marca al menos una planta involucrada",
        "una planta",
        values.plantIds.length > 0,
      ),
    );
  }

  if (step === 3) {
    if (values.lines.length === 0) {
      checks.push(check("lines", "Agrega al menos un producto reclamado", "un producto", false));
    }
    values.lines.forEach((line, index) => {
      checks.push(
        check(
          `lines.${index}.productId`,
          `Producto #${index + 1}: elige el producto`,
          `producto #${index + 1}`,
          line.productId.trim().length > 0,
        ),
      );
    });
    const needsCurrency = values.lines.some((line) => line.unitPrice.trim() !== "");
    checks.push(
      check(
        "currency",
        "Indica la moneda (hay líneas con precio)",
        "la moneda",
        !needsCurrency || values.currency.trim().length > 0,
      ),
    );
  }

  if (step === 4) {
    checks.push(
      check(
        "description",
        "Describe la reclamación (mínimo 20 caracteres)",
        "la descripción",
        values.description.trim().length >= 20,
      ),
    );
    if (values.firstCustomerContactAt && values.firstCustomerContactAt < values.claimDate) {
      checks.push(
        check(
          "firstCustomerContactAt",
          "El primer contacto no puede ser anterior a la reclamación",
          "la fecha de primer contacto",
          false,
        ),
      );
    }
  }

  return buildValidationItems(checks);
}

export type WithdrawalLineDraft = {
  key: number;
  productId: string;
  quantity: string;
  quantityUnit: string;
  unitPrice: string;
};

function parsePositiveDecimal(raw: string): number | null {
  const normalized = raw.replace(",", ".").trim();
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseOptionalPrice(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  const normalized = trimmed.replace(",", ".");
  if (normalized.length > 6) return false;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0;
}

export function getWithdrawalStepMissing(input: {
  step: 1 | 2;
  lockedTicketId?: number;
  selectedTicketId: string;
  requestDate: string;
  reason: string;
  currency: string;
  lines: WithdrawalLineDraft[];
}): ValidationItem[] {
  const checks: Array<{ id: string; label: string; short: string; valid: boolean }> = [];
  const todayIso = today();

  if (input.step === 1) {
    checks.push(
      check(
        "withdrawal-ticket",
        "Selecciona el ticket de la solicitud",
        "el ticket",
        Boolean(input.lockedTicketId || input.selectedTicketId),
      ),
      check(
        "withdrawal-request-date",
        "Indica la fecha de la solicitud",
        "la fecha de solicitud",
        Boolean(input.requestDate && input.requestDate <= todayIso),
      ),
      check("withdrawal-reason", "Elige el motivo del retiro", "el motivo", Boolean(input.reason)),
      check("withdrawal-currency", "Selecciona la moneda", "la moneda", Boolean(input.currency)),
    );
  }

  if (input.step === 2) {
    if (input.lines.length === 0) {
      checks.push(check("withdrawal-lines", "Incluye al menos un renglón de producto", "un producto", false));
    }
    input.lines.forEach((line, index) => {
      const n = index + 1;
      checks.push(
        check(
          `withdrawal-line-${line.key}-product`,
          `Renglón ${n}: elige el producto`,
          `producto del renglón ${n}`,
          Boolean(line.productId),
        ),
        check(
          `withdrawal-line-${line.key}-qty`,
          `Renglón ${n}: cantidad mayor que cero`,
          `cantidad del renglón ${n}`,
          parsePositiveDecimal(line.quantity) !== null,
        ),
        check(
          `withdrawal-line-${line.key}-unit`,
          `Renglón ${n}: indica la unidad`,
          `unidad del renglón ${n}`,
          line.quantityUnit.trim().length > 0 && line.quantityUnit.trim().length <= 5,
        ),
        check(
          `withdrawal-line-${line.key}-price`,
          `Renglón ${n}: precio unitario válido`,
          `precio del renglón ${n}`,
          parseOptionalPrice(line.unitPrice),
        ),
      );
    });
  }

  return buildValidationItems(checks);
}

export type DiscrepancyLineValues = {
  productId: string;
  invoiceRef: string;
  quantity: string;
  dispatcherMode: string;
  dispatcherStaffId: string;
  dispatcherName: string;
  qualifies: string;
  creditNoteNumber: string;
};

export function getDiscrepancyStepMissing(input: {
  step: 1 | 2 | 3;
  ticketId: string;
  discrepancyDate: string;
  lines: DiscrepancyLineValues[];
  checks: Record<number, string>;
  anyPositive: boolean;
}): ValidationItem[] {
  const checks: Array<{ id: string; label: string; short: string; valid: boolean }> = [];

  if (input.step === 1) {
    checks.push(
      check("ticketId", "Elige el ticket vinculado", "el ticket", input.ticketId.trim().length > 0),
      check(
        "discrepancy-date",
        "Indica la fecha del despacho",
        "la fecha del despacho",
        input.discrepancyDate.trim().length > 0,
      ),
    );
  }

  if (input.step === 2) {
    if (input.lines.length === 0) {
      checks.push(check("lines", "Agrega al menos una línea en discrepancia", "una línea", false));
    }
    input.lines.forEach((line, index) => {
      const n = index + 1;
      const qty = Number(line.quantity);
      checks.push(
        check(
          `lines.${index}.productId`,
          `Línea ${n}: elige el producto`,
          `producto de la línea ${n}`,
          line.productId.trim().length > 0,
        ),
        check(
          `lines.${index}.invoiceRef`,
          `Línea ${n}: indica la factura`,
          `factura de la línea ${n}`,
          line.invoiceRef.trim().length > 0,
        ),
        check(
          `lines.${index}.quantity`,
          `Línea ${n}: indica la cantidad`,
          `cantidad de la línea ${n}`,
          Number.isFinite(qty) && qty > 0,
        ),
        check(
          `lines.${index}.dispatcherName`,
          `Línea ${n}: indica el despachador`,
          `despachador de la línea ${n}`,
          line.dispatcherMode === "sistema"
            ? line.dispatcherStaffId.trim().length > 0 && line.dispatcherName.trim().length >= 3
            : line.dispatcherName.trim().length >= 3,
        ),
        check(
          `lines.${index}.qualifies`,
          `Línea ${n}: indica si cumple N/C`,
          `N/C de la línea ${n}`,
          line.qualifies === "si" || line.qualifies === "no",
        ),
      );
      if (line.qualifies === "si") {
        checks.push(
          check(
            `lines.${index}.creditNoteNumber`,
            `Línea ${n}: número de nota de crédito`,
            `nota de crédito de la línea ${n}`,
            line.creditNoteNumber.trim().length > 0,
          ),
        );
      }
    });
  }

  if (input.step === 3) {
    for (let n = 1; n <= 8; n += 1) {
      checks.push(
        check(
          `security-check-${n}`,
          `Punto de seguridad #${n}: marca Positivo o Negativo`,
          `punto de seguridad #${n}`,
          input.checks[n] === "Positivo" || input.checks[n] === "Negativo",
        ),
      );
    }
    if (input.anyPositive) {
      checks.push(
        check(
          "security-check-9",
          "Punto #9: notificación a Seguridad y Logística",
          "el punto #9",
          input.checks[9] === "Positivo" || input.checks[9] === "Negativo",
        ),
      );
    }
  }

  return buildValidationItems(checks);
}

export type HcaStepValues = {
  detectedAt: string;
  responsibleMode: string;
  responsibleStaffId: string;
  responsibleManualName: string;
  description: string;
  causes: string;
  planItems: Array<{
    description: string;
    responsibleMode: string;
    responsibleStaffId: string;
    responsibleManualName: string;
    dueDate: string;
    evidenceNotes: string;
  }>;
};

export function getHcaStepMissing(step: 1 | 2 | 3 | 4, values: HcaStepValues): ValidationItem[] {
  const checks: Array<{ id: string; label: string; short: string; valid: boolean }> = [];

  if (step === 1) {
    checks.push(
      check(
        "detectedAt",
        "Indica la fecha del hecho",
        "la fecha del hecho",
        values.detectedAt.trim().length > 0 && values.detectedAt <= today(),
      ),
    );
    if (values.responsibleMode === "sistema") {
      checks.push(
        check(
          "responsibleStaffId",
          "Elige el responsable de la hoja",
          "el responsable",
          values.responsibleStaffId.trim().length > 0,
        ),
      );
    } else {
      checks.push(
        check(
          "responsibleManualName",
          "Indica el responsable (mínimo 3 caracteres)",
          "el responsable",
          values.responsibleManualName.trim().length >= 3,
        ),
      );
    }
  }

  if (step === 2) {
    checks.push(
      check(
        "description",
        "Describe el hecho (mínimo 10 caracteres)",
        "la descripción del hecho",
        values.description.trim().length >= 10,
      ),
      check(
        "causes",
        "Describe las causas (mínimo 10 caracteres)",
        "las causas",
        values.causes.trim().length >= 10,
      ),
    );
  }

  if (step === 3) {
    const startedRows = values.planItems.filter(
      (row) =>
        row.description.trim() !== "" ||
        row.responsibleStaffId !== "" ||
        row.responsibleManualName.trim() !== "" ||
        row.dueDate !== "" ||
        row.evidenceNotes.trim() !== "",
    );
    if (startedRows.length === 0) {
      checks.push(check("planItems", "Agrega al menos una acción en el plan", "una acción", false));
    }
    values.planItems.forEach((row, index) => {
      const started =
        row.description.trim() !== "" ||
        row.responsibleStaffId !== "" ||
        row.responsibleManualName.trim() !== "" ||
        row.dueDate !== "" ||
        row.evidenceNotes.trim() !== "";
      if (!started) return;
      const n = index + 1;
      checks.push(
        check(
          `planItems.${index}.description`,
          `Acción ${n}: describe la acción (mín. 10 caracteres)`,
          `acción ${n}`,
          row.description.trim().length >= 10,
        ),
      );
      if (row.responsibleMode === "sistema") {
        checks.push(
          check(
            `planItems.${index}.responsibleStaffId`,
            `Acción ${n}: elige responsable`,
            `responsable de la acción ${n}`,
            row.responsibleStaffId.trim().length > 0,
          ),
        );
      } else {
        checks.push(
          check(
            `planItems.${index}.responsibleManualName`,
            `Acción ${n}: responsable manual`,
            `responsable de la acción ${n}`,
            row.responsibleManualName.trim().length >= 3,
          ),
        );
      }
      checks.push(
        check(
          `planItems.${index}.dueDate`,
          `Acción ${n}: fecha compromiso`,
          `fecha de la acción ${n}`,
          row.dueDate.trim().length > 0,
        ),
      );
    });
  }

  return buildValidationItems(checks);
}
