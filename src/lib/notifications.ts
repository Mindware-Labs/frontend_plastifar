import type { EmailAssignment, InboxArrival, TicketAssignmentNotice, TicketSlaNotice } from "../types/api";

/** Preferencias de aviso de cada persona. Viven en este navegador, como los borradores. */
export interface NotifyPrefs {
  desktop: boolean;
  sound: boolean;
}

const KEY = "plf.notify";
const CHANGED = "plf:notify-changed";
const DEFAULTS: NotifyPrefs = { desktop: false, sound: false };

/** Sonar por cada correo de una rafaga seria una alarma: un aviso por ventana basta. */
const CHIME_COOLDOWN = 2500;

let cached: NotifyPrefs | null = null;
let lastChimeAt = 0;
let audio: AudioContext | null = null;

export function readPrefs(): NotifyPrefs {
  if (cached) return cached;

  try {
    const raw = localStorage.getItem(KEY);
    cached = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<NotifyPrefs>) } : DEFAULTS;
  } catch {
    cached = DEFAULTS;
  }

  return cached;
}

export function writePrefs(next: NotifyPrefs) {
  cached = next;

  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento la preferencia dura lo que dure la pestana.
  }

  window.dispatchEvent(new Event(CHANGED));
}

/** Para useSyncExternalStore: avisa cuando otra parte del panel cambia la preferencia. */
export function subscribePrefs(listener: () => void) {
  window.addEventListener(CHANGED, listener);
  return () => window.removeEventListener(CHANGED, listener);
}

export type DesktopState = NotificationPermission | "unsupported";

export function desktopState(): DesktopState {
  return "Notification" in window ? Notification.permission : "unsupported";
}

export async function requestDesktop(): Promise<DesktopState> {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;

  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/**
 * Dos notas ascendentes sintetizadas: sin archivo que descargar ni que se pierda.
 * El contexto de audio se crea al primer uso, despues de que la persona haya
 * tocado la pagina, que es cuando el navegador permite sonar.
 */
export function playChime(force = false) {
  const now = performance.now();
  if (!force && now - lastChimeAt < CHIME_COOLDOWN) return;
  lastChimeAt = now;

  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();

    const start = audio.currentTime + 0.01;
    const notes: Array<[frequency: number, offset: number]> = [
      [880, 0],
      [1174.66, 0.13],
    ];

    for (const [frequency, offset] of notes) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.16, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.38);

      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.4);
    }
  } catch {
    // Sin audio (politica del navegador o dispositivo mudo) el aviso sigue llegando por la bandeja.
  }
}

/** Notificacion del sistema. Solo tiene sentido cuando la pestana no esta a la vista. */
export function showArrival(arrival: InboxArrival, onOpen: () => void): Notification | null {
  if (desktopState() !== "granted") return null;

  const from = arrival.fromName ?? arrival.fromEmail;
  const subject = arrival.subject.trim() || "(sin asunto)";

  try {
    const notification = new Notification(`Correo de ${from}`, {
      body: arrival.hasAttachments ? `${subject} · con adjuntos` : subject,
      // El mismo correo reintentado por el servidor no apila dos avisos.
      tag: `plf-mail-${arrival.emailId}`,
      icon: "/brand/plastifar-isotipo.png",
    });

    notification.onclick = () => {
      onOpen();
      notification.close();
    };

    return notification;
  } catch {
    return null;
  }
}

/** Notificacion del sistema para una conversacion recien asignada. */
export function showAssignment(assignment: EmailAssignment, onOpen: () => void): Notification | null {
  if (desktopState() !== "granted") return null;

  const from = assignment.fromName ?? assignment.fromEmail;
  const subject = assignment.subject.trim() || "(sin asunto)";

  try {
    const notification = new Notification(`${assignment.assignedByName} te asignó un correo`, {
      body: `De ${from} · ${subject}`,
      // La misma asignacion reintentada por el servidor no apila dos avisos.
      tag: `plf-assign-${assignment.emailId}`,
      icon: "/brand/plastifar-isotipo.png",
    });

    notification.onclick = () => {
      onOpen();
      notification.close();
    };

    return notification;
  } catch {
    return null;
  }
}

/** Notificacion del sistema para un ticket recién asignado. */
export function showTicketAssignment(notice: TicketAssignmentNotice, onOpen: () => void): Notification | null {
  if (desktopState() !== "granted") return null;

  const actor = notice.assignedByName?.trim() || "El sistema";
  const title = `${actor} te asignó el ticket ${notice.ticketNumber}`;
  const body = `${notice.subject} · Prioridad: ${notice.priority}`;

  try {
    const notification = new Notification(title, {
      body,
      tag: `plf-ticket-assign-${notice.ticketId}`,
      icon: "/brand/plastifar-isotipo.png",
    });

    notification.onclick = () => {
      onOpen();
      notification.close();
    };

    return notification;
  } catch {
    return null;
  }
}

/** Notificacion del sistema para alertas de SLA (por vencer o vencido). */
export function showTicketSlaAlert(notice: TicketSlaNotice, onOpen: () => void): Notification | null {
  if (desktopState() !== "granted") return null;

  const isBreach = notice.noticeType === "breach";
  const title = isBreach
    ? `⚠️ SLA Incumplido: ${notice.ticketNumber}`
    : `⏳ SLA Próximo a Vencer: ${notice.ticketNumber}`;
  const body = `${notice.subject} · ${notice.details}`;

  try {
    const notification = new Notification(title, {
      body,
      tag: `plf-ticket-sla-${notice.ticketId}-${notice.noticeType}`,
      icon: "/brand/plastifar-isotipo.png",
    });

    notification.onclick = () => {
      onOpen();
      notification.close();
    };

    return notification;
  } catch {
    return null;
  }
}

