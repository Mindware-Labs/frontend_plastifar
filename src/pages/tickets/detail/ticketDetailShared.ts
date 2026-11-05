/** El atajo se nombra con la tecla que la persona tiene delante, no con las dos. */
export const SAVE_SHORTCUT =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘ + Enter" : "Ctrl + Enter";

const MAX_SINGLE_ATTACHMENT = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENTS = 25 * 1024 * 1024;

/** Valida un lote nuevo de adjuntos contra el limite individual y el total acumulado. */
export function validateAttachments(chosen: File[], existing: File[]): string | null {
  const oversized = chosen.find((f) => f.size > MAX_SINGLE_ATTACHMENT);
  if (oversized) return `El archivo "${oversized.name}" supera el límite individual de 10 MB.`;

  const currentTotal = existing.reduce((acc, f) => acc + f.size, 0);
  const newTotal = chosen.reduce((acc, f) => acc + f.size, 0);
  if (currentTotal + newTotal > MAX_TOTAL_ATTACHMENTS) {
    return "El total de los adjuntos excede los 25 MB permitidos por mensaje.";
  }
  return null;
}

/** Suma los archivos elegidos en el input si pasan la validacion; si no, deja el aviso. */
export function pickFiles(
  input: HTMLInputElement,
  existing: File[],
  setFiles: (update: (prev: File[]) => File[]) => void,
  setFileError: (message: string | null) => void,
  onSuccess?: () => void,
) {
  if (!input.files) return;
  const chosen = Array.from(input.files);
  const problem = validateAttachments(chosen, existing);
  if (problem) {
    setFileError(problem);
    return;
  }
  setFileError(null);
  setFiles((prev) => [...prev, ...chosen]);
  input.value = "";
  onSuccess?.();
}

/** Id con el que se alinea la tarjeta de la descripcion inicial (AlignedClampBody). */
export const ACTIVITY_CARD_ID = "ticket-activity-summary-card";

export const PRIORITY_OPTIONS = ["Emergencia", "Alta", "Normal", "Baja"].map((value) => ({ value, label: value }));

export const labelClass = "font-heading text-[11.5px] font-semibold text-zinc-500";

export const textareaClass =
  "w-full resize-none rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-[12.5px] leading-relaxed " +
  "text-zinc-900 outline-none transition-all placeholder:text-zinc-400 hover:border-zinc-300 " +
  "focus:border-brand-red focus:ring-2 focus:ring-brand-red/15";

export const attachLabelClass =
  "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-2.5 " +
  "text-[11.5px] font-medium text-zinc-600 shadow-2xs transition-all duration-300 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95";

export const attachSuccessLabelClass =
  "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 " +
  "text-[11.5px] font-semibold text-emerald-700 shadow-2xs ring-2 ring-emerald-200/70 transition-all duration-300 active:scale-95";

export const attachExitingLabelClass =
  "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/40 px-2.5 " +
  "text-[11.5px] font-medium text-emerald-600 shadow-2xs ring-1 ring-emerald-100/50 transition-all duration-300 active:scale-95";
