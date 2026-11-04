/** Borradores locales de formularios empresariales ligados a un ticket (PF-FOR-034/068/291/109). */

export type EnterpriseFormDraftCode = "pf034" | "pf068" | "pf291" | "pf109";

export type EnterpriseFormPickerKey =
  | "Reclamacion"
  | "RetiroMercancia"
  | "DiscrepanciaCarga"
  | "Hca";

export const ENTERPRISE_FORM_PICKER_META: Record<
  EnterpriseFormPickerKey,
  { draftCode: EnterpriseFormDraftCode; formCode: string; title: string }
> = {
  Reclamacion: {
    draftCode: "pf034",
    formCode: "PF-FOR-034",
    title: "Reclamación de clientes",
  },
  RetiroMercancia: {
    draftCode: "pf068",
    formCode: "PF-FOR-068",
    title: "Solicitud de retiro de mercancía",
  },
  DiscrepanciaCarga: {
    draftCode: "pf291",
    formCode: "PF-FOR-291",
    title: "Discrepancia de cargas",
  },
  Hca: {
    draftCode: "pf109",
    formCode: "PF-FOR-109",
    title: "Hecho, causa y acción (HCA)",
  },
};

export function enterpriseFormDraftKey(code: EnterpriseFormDraftCode, ticketId: number): string {
  return `${code}-draft:ticket:${ticketId}`;
}

export function enterpriseFormDraftKeyForPicker(
  pickerKey: EnterpriseFormPickerKey,
  ticketId: number,
): string {
  return enterpriseFormDraftKey(ENTERPRISE_FORM_PICKER_META[pickerKey].draftCode, ticketId);
}

export function readEnterpriseFormDraft<T extends Record<string, unknown>>(
  key: string | null | undefined,
): T | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as T;
    }
  } catch {
    /** borrador corrupto */
  }
  return null;
}

export function hasEnterpriseFormDraft(key: string | null | undefined): boolean {
  return readEnterpriseFormDraft(key) !== null;
}

export function writeEnterpriseFormDraft(
  key: string | null | undefined,
  payload: Record<string, unknown>,
): boolean {
  if (!key) return false;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        ...payload,
        savedAt: Date.now(),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearEnterpriseFormDraft(key: string | null | undefined): void {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /** sin almacenamiento */
  }
}
