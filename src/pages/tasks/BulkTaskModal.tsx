import {
  AlertOctagon,
  AlertTriangle,
  Flag,
  ListTodo,
  Timer,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { tasksApi } from "../../api/tasks";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
import { LookupField, TextAreaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useReceipts } from "../../context/useReceipts";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import { resolveStaffLabel, searchActiveStaff } from "../../lib/lookups";
import type { TaskPriority } from "../../types/tasks";

export type BulkModalMode = "asignar" | "prioridad" | "estado" | "completar" | "cancelar";

export interface BulkTaskModalProps {
  mode: BulkModalMode;
  taskIds: number[];
  onClose: () => void;
  onSuccess: (updatedCount: number) => void;
}

const PRIORITY_ITEMS: {
  value: TaskPriority;
  label: string;
  icon: typeof Flag;
  activeColor: string;
}[] = [
  { value: "Emergencia", label: "Emergencia", icon: AlertOctagon, activeColor: "text-brand-red" },
  { value: "Alta", label: "Alta", icon: AlertTriangle, activeColor: "text-amber-500" },
  { value: "Normal", label: "Normal", icon: Flag, activeColor: "text-blue-500" },
  { value: "Baja", label: "Baja", icon: Flag, activeColor: "text-zinc-400" },
];

const STATUS_ITEMS: {
  value: "Pendiente" | "EnProgreso";
  label: string;
  icon: typeof Timer;
  activeColor: string;
}[] = [
  { value: "Pendiente", label: "Pendiente", icon: ListTodo, activeColor: "text-zinc-600" },
  { value: "EnProgreso", label: "En progreso", icon: Timer, activeColor: "text-amber-600" },
];

function FormDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 first:border-0 first:pt-0">
      <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400 select-none">
        {title}
      </span>
      <div className="h-px flex-1 bg-zinc-100" />
    </div>
  );
}

export function BulkTaskModal({ mode, taskIds, onClose, onSuccess }: BulkTaskModalProps) {
  const receipts = useReceipts();
  const { isExiting, requestClose } = useModalAnimation();

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form field values
  const [staffId, setStaffId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Normal");
  const [status, setStatus] = useState<"Pendiente" | "EnProgreso">("EnProgreso");
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      autoResizeTextarea(textareaRef.current, 56);
    }
  }, [mode]);

  const count = taskIds.length;
  const countLabel = `${count} ${count === 1 ? "tarea seleccionada" : "tareas seleccionadas"}`;

  const bulkMissing = useMemo(() => {
    if (mode === "completar") {
      return buildValidationItems([
        {
          id: "bulk-task-comment",
          label: "Falta el comentario de cierre",
          short: "el comentario",
          valid: comment.trim().length > 0,
        },
      ]);
    }
    if (mode === "cancelar") {
      return buildValidationItems([
        {
          id: "bulk-task-reason",
          label: "Falta el motivo de cancelación (mín. 5 caracteres)",
          short: "el motivo",
          valid: reason.trim().length >= 5,
        },
      ]);
    }
    return [];
  }, [mode, comment, reason]);

  let title = "";
  let description = "";
  let submitLabel = "";
  let submitVariant: "primary" | "danger" = "primary";

  switch (mode) {
    case "asignar":
      title = "Asignar tareas en lote";
      description = "Elige un colaborador como responsable o déjalo sin asignar para desvincularlas.";
      submitLabel = staffId ? "Asignar colaborador" : "Desasignar colaborador";
      break;
    case "prioridad":
      title = "Cambiar prioridad en lote";
      description = "Establece el nuevo nivel de prioridad e importancia para las tareas seleccionadas.";
      submitLabel = "Aplicar prioridad";
      break;
    case "estado":
      title = "Cambiar estado en lote";
      description = "Actualiza el estado operativo activo de las tareas seleccionadas.";
      submitLabel = "Aplicar estado";
      break;
    case "completar":
      title = "Completar tareas en lote";
      description = "Las tareas seleccionadas pasarán al estado Completada de forma definitiva.";
      submitLabel = "Completar tareas";
      break;
    case "cancelar":
      title = "Cancelar tareas en lote";
      description = "Indica el motivo por el cual se cancelarán estas tareas. Esta acción no se puede revertir.";
      submitLabel = "Cancelar tareas";
      submitVariant = "danger";
      break;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldError(null);

    if (count === 0) {
      setFormError("No hay tareas seleccionadas para procesar.");
      return;
    }

    if (mode === "completar") {
      const trimmed = comment.trim();
      if (!trimmed) {
        setFieldError("El comentario de cierre es obligatorio.");
        return;
      }
    }

    if (mode === "cancelar") {
      const trimmed = reason.trim();
      if (!trimmed || trimmed.length < 5) {
        setFieldError("Ingresa un motivo explicativo de al menos 5 caracteres.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      let updatedCount = 0;

      if (mode === "asignar") {
        const res = await tasksApi.bulkAssign({
          taskIds,
          staffId: staffId ? Number(staffId) : null,
        });
        updatedCount = res.updatedCount;
        receipts.done({
          action: "bulk-asignar-tareas",
          title: staffId ? "Tareas asignadas" : "Tareas desasignadas",
          detail: `${updatedCount} ${updatedCount === 1 ? "tarea actualizada" : "tareas actualizadas"}`,
        });
      } else if (mode === "prioridad") {
        const res = await tasksApi.bulkPriority({
          taskIds,
          priority,
        });
        updatedCount = res.updatedCount;
        receipts.done({
          action: "bulk-prioridad-tareas",
          title: "Prioridad actualizada",
          detail: `${updatedCount} ${updatedCount === 1 ? "tarea actualizada" : "tareas actualizadas"} a prioridad ${priority}`,
        });
      } else if (mode === "estado") {
        const res = await tasksApi.bulkStatus({
          taskIds,
          status,
        });
        updatedCount = res.updatedCount;
        receipts.done({
          action: "bulk-estado-tareas",
          title: "Estado actualizado",
          detail: `${updatedCount} ${updatedCount === 1 ? "tarea actualizada" : "tareas actualizadas"} a estado ${status}`,
        });
      } else if (mode === "completar") {
        const res = await tasksApi.bulkComplete({
          taskIds,
          comment: comment.trim() || undefined,
        });
        updatedCount = res.updatedCount;
        receipts.done({
          action: "bulk-completar-tareas",
          title: "Tareas completadas",
          detail: `${updatedCount} ${updatedCount === 1 ? "tarea completada exitosamente" : "tareas completadas exitosamente"}`,
        });
      } else if (mode === "cancelar") {
        const res = await tasksApi.bulkCancel({
          taskIds,
          reason: reason.trim(),
        });
        updatedCount = res.updatedCount;
        receipts.done({
          action: "bulk-cancelar-tareas",
          title: "Tareas canceladas",
          detail: `${updatedCount} ${updatedCount === 1 ? "tarea cancelada" : "tareas canceladas"}`,
        });
      }

      onSuccess(updatedCount);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Ocurrió un error inesperado al procesar las tareas.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit(event);
    }
  }

  return (
    <Modal
      maxWidth="max-w-lg"
      eyebrow={`Acción en lote · ${countLabel}`}
      title={title}
      description={description}
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400 select-none">
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Enter
            </kbd>
            <span className="ml-0.5">para aplicar</span>
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <SubmitValidationButton
              formId="bulk-task-form"
              ready={bulkMissing.length === 0}
              busy={isSubmitting}
              missingItems={bulkMissing}
              onFocusField={focusFormField}
              variant={submitVariant}
              hintText="Para aplicar la acción en lote, completa lo siguiente:"
            >
              {submitLabel}
            </SubmitValidationButton>
          </div>
        </div>
      }
    >
      <form
        id="bulk-task-form"
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        {/* Resumen de impacto de la selección */}
        <div className="flex items-center gap-2.5 rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-[12px] text-zinc-600">
          <span className="inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-[5px] bg-brand-red px-1 font-heading text-[10.5px] font-bold leading-none tabular-nums text-white">
            {count}
          </span>
          <span>
            {count === 1
              ? "Se aplicará la acción a 1 tarea seleccionada."
              : `Se aplicará la acción a ${count} tareas seleccionadas.`}
          </span>
        </div>

        {/* 1. ASIGNAR */}
        {mode === "asignar" && (
          <>
            <FormDivider title="Responsable" />
            <LookupField
              size="sm"
              label="Colaborador responsable"
              value={staffId}
              onChange={(val) => setStaffId(val)}
              search={searchActiveStaff}
              resolveSelectedLabel={resolveStaffLabel}
              placeholder="Sin asignar"
              searchPlaceholder="Buscar colaborador…"
              clearLabel="Sin asignar"
              hint="Deja vacío este campo si deseas dejar las tareas sin asignar."
            />
          </>
        )}

        {/* 2. PRIORIDAD */}
        {mode === "prioridad" && (
          <>
            <FormDivider title="Nivel de prioridad" />
            <div className="flex flex-col gap-1">
              <label className="font-heading text-[11.5px] font-semibold text-faint">
                Prioridad <span className="text-brand-red">*</span>
              </label>
              <div
                role="radiogroup"
                aria-label="Prioridad"
                className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-lg border border-zinc-200 bg-zinc-50/70 p-0.5"
              >
                {PRIORITY_ITEMS.map((item) => {
                  const isSelected = priority === item.value;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setPriority(item.value)}
                      className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] transition-all cursor-pointer select-none ${
                        isSelected
                          ? "border border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                          : "border border-transparent font-medium text-zinc-600 hover:text-zinc-900 hover:bg-white/50"
                      }`}
                    >
                      <Icon
                        className={`h-3 w-3 shrink-0 ${isSelected ? item.activeColor : "text-zinc-400"}`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* 3. ESTADO */}
        {mode === "estado" && (
          <>
            <FormDivider title="Estado operativo" />
            <div className="flex flex-col gap-1">
              <label className="font-heading text-[11.5px] font-semibold text-faint">
                Estado <span className="text-brand-red">*</span>
              </label>
              <div
                role="radiogroup"
                aria-label="Estado"
                className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50/70 p-0.5"
              >
                {STATUS_ITEMS.map((item) => {
                  const isSelected = status === item.value;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setStatus(item.value)}
                      className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] transition-all cursor-pointer select-none ${
                        isSelected
                          ? "border border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                          : "border border-transparent font-medium text-zinc-600 hover:text-zinc-900 hover:bg-white/50"
                      }`}
                    >
                      <Icon
                        className={`h-3 w-3 shrink-0 ${isSelected ? item.activeColor : "text-zinc-400"}`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* 4. COMPLETAR */}
        {mode === "completar" && (
          <>
            <FormDivider title="Resolución" />
            <TextAreaField
              id="bulk-task-comment"
              ref={textareaRef}
              rows={1}
              required
              label="Comentario de cierre"
              placeholder="Indica qué se ejecutó y cómo quedaron las tareas seleccionadas…"
              value={comment}
              error={fieldError ?? undefined}
              className="resize-none overflow-hidden"
              onChange={(e) => {
                setComment(e.target.value);
                if (fieldError && e.target.value.trim().length > 0) setFieldError(null);
                autoResizeTextarea(e.target, 56);
              }}
              hint={
                <span className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span className={fieldError ? "text-brand-red font-medium" : ""}>
                    {fieldError ?? "El comentario de cierre es obligatorio para registrar la resolución"}
                  </span>
                  <span className={`tabular-nums ${comment.length > 3800 ? "text-brand-red font-medium" : ""}`}>
                    {comment.length} / 4000
                  </span>
                </span>
              }
            />
          </>
        )}

        {/* 5. CANCELAR */}
        {mode === "cancelar" && (
          <>
            <FormDivider title="Motivo de cancelación" />
            <TextAreaField
              id="bulk-task-reason"
              ref={textareaRef}
              rows={1}
              required
              label="Motivo de la cancelación"
              placeholder="Indica la razón por la que se cancelan las tareas seleccionadas…"
              value={reason}
              error={fieldError ?? undefined}
              onChange={(e) => {
                setReason(e.target.value);
                if (fieldError && e.target.value.trim().length >= 5) setFieldError(null);
                autoResizeTextarea(e.target, 56);
              }}
              hint="Se requiere un motivo explicativo de al menos 5 caracteres."
            />
          </>
        )}
      </form>
    </Modal>
  );
}
