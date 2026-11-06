// Copia local del bloqueo que impone el servidor, solo para la cuenta regresiva: borrarla no lo levanta.
const STORAGE_KEY = "pf_auth_lock";

interface StoredLock {
  until: number;
  email?: string;
}

let current: StoredLock | null = read();
const listeners = new Set<() => void>();

function read(): StoredLock | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLock;
    return typeof parsed.until === "number" && parsed.until > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

function write(next: StoredLock | null) {
  current = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento el bloqueo queda en memoria; el servidor lo vuelve a imponer igual.
  }
  listeners.forEach((listener) => listener());
}

export const authLockout = {
  /** Segundos que faltan; 0 sin bloqueo. */
  remainingSeconds(): number {
    if (!current) return 0;
    const ms = current.until - Date.now();
    return ms > 0 ? Math.ceil(ms / 1000) : 0;
  },

  /** Marca de tiempo en que termina; null sin bloqueo. */
  until(): number | null {
    return current?.until ?? null;
  },

  /** Correo del intento que provoco el bloqueo, para consultar su estado al recargar. */
  email(): string | undefined {
    return current?.email;
  },

  /** Lo que informo un 429: nunca acorta un bloqueo mas largo ya conocido. */
  lockFor(seconds: number | undefined, email?: string) {
    if (!seconds || seconds <= 0) return;
    const until = Math.max(Date.now() + seconds * 1000, current?.until ?? 0);
    write({ until, email: email ?? current?.email });
  },

  /** Lo que informa la consulta de estado: el servidor manda, tambien para levantarlo. */
  syncFromServer(seconds: number) {
    if (seconds > 0) write({ until: Date.now() + seconds * 1000, email: current?.email });
    else if (current) write(null);
  },

  clear() {
    if (current) write(null);
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// Otra pestana registro o levanto el bloqueo: esta lo adopta sin recargar.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    current = read();
    listeners.forEach((listener) => listener());
  });
}

/** 4:59, 14:05 o 1:00:00. */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
