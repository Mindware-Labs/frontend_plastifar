import { tokenStore } from "../api/tokenStore";
import { decodeAccessToken } from "./jwt";

/** Borradores del editor. Viven en el navegador: sobreviven a cerrar y volver, no a cambiar de equipo. */
const PREFIX = "plf.draft.";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 50;
const WRITE_DELAY_MS = 400;

export interface Draft {
  /** Documento del editor, tal cual lo entrega BlockNote. */
  blocks?: unknown;
  body: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  to?: string;
}

interface StoredDraft extends Draft {
  savedAt: number;
}

/** El borrador es de quien lo escribe: dos personas en el mismo equipo no se ven los textos a medias. */
function storageKey(key: string): string {
  const token = tokenStore.getAccessToken();
  const staffId = (token && decodeAccessToken(token)?.sub) || "anon";
  return `${PREFIX}${staffId}.${key}`;
}

function listDraftKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
}

/** Claves de la version sin persona ("plf.draft.<emailId>"): se retiran en la primera escritura. */
function isLegacyKey(key: string): boolean {
  return /^plf\.draft\.\d+$/.test(key);
}

function readStored(key: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

/** Sin limite el almacen crece con cada correo abierto: fuera lo viejo y, si sobra, lo menos reciente. */
function prune() {
  const now = Date.now();
  const survivors: Array<{ key: string; savedAt: number }> = [];

  for (const key of listDraftKeys()) {
    if (isLegacyKey(key)) {
      localStorage.removeItem(key);
      continue;
    }
    const stored = readStored(key);
    if (!stored || now - (stored.savedAt ?? 0) > MAX_AGE_MS) {
      localStorage.removeItem(key);
      continue;
    }
    survivors.push({ key, savedAt: stored.savedAt ?? 0 });
  }

  survivors
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(MAX_ENTRIES)
    .forEach(({ key }) => localStorage.removeItem(key));
}

export function readDraft(key: string): Draft | null {
  const stored = readStored(storageKey(key));
  if (!stored) return null;
  const { savedAt: _savedAt, ...draft } = stored;
  return draft;
}

const pendingWrites = new Map<string, number>();

function writeNow(key: string, draft: Draft) {
  const empty =
    !draft.body.trim() && !draft.cc?.trim() && !draft.bcc?.trim() && !draft.subject?.trim() && !draft.to?.trim();

  try {
    if (empty) {
      localStorage.removeItem(key);
      return;
    }
    const stored: StoredDraft = { ...draft, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(stored));
    prune();
  } catch {
    // Navegacion privada o almacenamiento lleno: se pierde el borrador, no la respuesta.
  }
}

/** Cada tecla no merece una escritura: se guarda al detenerse 400 ms. */
export function writeDraft(key: string, draft: Draft) {
  const fullKey = storageKey(key);
  const pending = pendingWrites.get(fullKey);
  if (pending !== undefined) window.clearTimeout(pending);
  pendingWrites.set(
    fullKey,
    window.setTimeout(() => {
      pendingWrites.delete(fullKey);
      writeNow(fullKey, draft);
    }, WRITE_DELAY_MS),
  );
}

export function clearDraft(key: string) {
  const fullKey = storageKey(key);
  const pending = pendingWrites.get(fullKey);
  if (pending !== undefined) {
    window.clearTimeout(pending);
    pendingWrites.delete(fullKey);
  }
  try {
    localStorage.removeItem(fullKey);
  } catch {
    // Nada que hacer: el borrador ya no se podra limpiar, pero no afecta al envio.
  }
}

/** Al cerrar sesion no queda texto a medias de nadie en este navegador. */
export function clearAllDrafts() {
  for (const timer of pendingWrites.values()) window.clearTimeout(timer);
  pendingWrites.clear();
  try {
    listDraftKeys().forEach((key) => localStorage.removeItem(key));
  } catch {
    // Sin almacenamiento no hay borradores que limpiar.
  }
}
