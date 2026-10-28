import { z } from "zod";

export const TASK_PRIORITIES = ["Emergencia", "Alta", "Normal", "Baja"] as const;
export const OPEN_TASK_STATUSES = ["Pendiente", "EnProgreso"] as const;

const calendarDate = z
  .string()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Fecha inválida");

const timeFormat = z
  .string()
  .refine(
    (value) => value === "" || value === undefined || /^\d{2}:\d{2}$/.test(value),
    "Hora inválida",
  );

/** Alta y edición. El estado solo se ofrece mientras la tarea sigue abierta. */
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(200, "Máximo 200 caracteres"),
  instructions: z
    .string()
    .trim()
    .min(1, "Las instrucciones son obligatorias")
    .max(8000, "Máximo 8000 caracteres"),
  departmentId: z.string().trim().min(1, "Elige el departamento"),
  assignedStaffId: z.string(),
  slaPolicyId: z.string().trim().min(1, "Elige una política SLA"),
  status: z.enum(OPEN_TASK_STATUSES),
  clientId: z.string(),
  contactId: z.string(),
  dueDate: calendarDate,
  dueTime: timeFormat.optional(),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const taskCommentSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, "El comentario de cierre es obligatorio")
    .max(4000, "Máximo 4000 caracteres"),
});

export const taskReasonSchema = z.object({
  reason: z.string().trim().min(1, "El motivo es obligatorio").max(500, "Máximo 500 caracteres"),
});

export function dueDateToApi(date: string, time?: string): string | null {
  if (!date || date.trim() === "") return null;
  const cleanTime = time?.trim();
  if (cleanTime && /^\d{2}:\d{2}$/.test(cleanTime)) {
    const [h, m] = cleanTime.split(":").map(Number);
    const [year, month, day] = date.split("-").map(Number);
    const localDate = new Date(year, month - 1, day, h, m, 0);
    return localDate.toISOString();
  }
  return `${date}T00:00:00Z`;
}

export function parseDueDateFromApi(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  if (iso.includes("T00:00:00") || iso.includes("T23:59:59")) {
    return { date: iso.slice(0, 10), time: "" };
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

/** Verifica si una fecha y hora límite ya expiró con respecto al momento de referencia. */
export function isPastDueDate(date: string, time?: string, referenceNow: Date = new Date()): boolean {
  if (!date || date.trim() === "") return false;
  const todayStr = `${referenceNow.getFullYear()}-${String(referenceNow.getMonth() + 1).padStart(2, "0")}-${String(referenceNow.getDate()).padStart(2, "0")}`;
  if (date < todayStr) return true;
  if (date > todayStr) return false;
  const cleanTime = time?.trim();
  if (cleanTime && /^\d{2}:\d{2}$/.test(cleanTime)) {
    const [h, m] = cleanTime.split(":").map(Number);
    const nowH = referenceNow.getHours();
    const nowM = referenceNow.getMinutes();
    if (h < nowH || (h === nowH && m < nowM)) {
      return true;
    }
  }
  return false;
}

export function dueDateFromApi(value: string | null): string {
  return parseDueDateFromApi(value).date;
}
