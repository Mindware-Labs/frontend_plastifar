// Texto y control documental de la reclamación de clientes (PF-FOR-034).

/** Sí / No / sin responder: la sección IV distingue «no» de «todavía no». */
export function yesNo(value: boolean | null): string {
  if (value === null) return "Sin responder";
  return value ? "Sí" : "No";
}

/** Control documental del pie del PF-FOR-034, tal como está en la plantilla. */
export const CLAIM_FORM_CONTROL = {
  code: "PF-FOR-034",
  title: "RECLAMACIONES DE CLIENTES",
  revision: "03",
  replaces: "02",
  lastRevision: "16-Oct-2024",
  createdOn: "03-May-2013",
} as const;
