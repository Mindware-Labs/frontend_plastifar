/** Borradores del editor. Viven en el navegador: sobreviven a cerrar y volver, no a cambiar de equipo. */
const PREFIX = "plf.draft.";

export interface Draft {
  /** Documento del editor, tal cual lo entrega BlockNote. */
  blocks?: unknown;
  body: string;
  cc?: string;
  subject?: string;
  to?: string;
}

export function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, draft: Draft) {
  const empty = !draft.body.trim() && !draft.cc?.trim() && !draft.subject?.trim() && !draft.to?.trim();

  try {
    if (empty) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(draft));
  } catch {
    // Navegacion privada o almacenamiento lleno: se pierde el borrador, no la respuesta.
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Nada que hacer: el borrador ya no se podra limpiar, pero no afecta al envio.
  }
}
