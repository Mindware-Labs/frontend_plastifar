import { z } from "zod";

export const TASK_PRIORITIES = ["Emergencia", "Alta", "Normal", "Baja"] as const;
export const OPEN_TASK_STATUSES = ["Pendiente", "EnProgreso"] as const;

const calendarDate = z
  .string()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Fecha inválida");

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
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(OPEN_TASK_STATUSES),
  clientId: z.string(),
  contactId: z.string(),
  dueDate: calendarDate,
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const taskCommentSchema = z.object({
  comment: z.string().trim().min(1, "El comentario es obligatorio").max(4000, "Máximo 4000 caracteres"),
});

export const taskReasonSchema = z.object({
  reason: z.string().trim().min(1, "El motivo es obligatorio").max(500, "Máximo 500 caracteres"),
});

export function dueDateToApi(value: string): string | null {
  return value === "" ? null : `${value}T00:00:00Z`;
}

export function dueDateFromApi(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}
