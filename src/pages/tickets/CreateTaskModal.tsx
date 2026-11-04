import { ArrowLeft, ArrowRight, Calendar, FileText, Plus, UserCheck } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { Button } from "../../components/ui/Button";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
import { DatePicker } from "../../components/ui/DatePicker";
import { TextAreaField, TextField } from "../../components/ui/Field";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { prefersReducedMotion } from "../../hooks/motion";
import { useSettle } from "../../hooks/useSettle";
import { TaskEvidenceUpload } from "../../components/app/TaskEvidenceUpload";
import { formatBytes } from "../../lib/format";
import type { TicketStaffOptionResponse } from "../../types/api";
import { isPastDueDate } from "../tasks/taskSchema";

// Misma curva larga que el resto de paneles: arranca rápido y se asienta con suavidad.
const STEP_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const STEP_OUT_MS = 160;
const STEP_IN_MS = 420;
const STEP_SHIFT_PX = 28;

const STEPS = ["Detalle", "Responsable y fecha"] as const;

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (formData: FormData) => Promise<void>;
  assignableStaff: TicketStaffOptionResponse[];
  currentStaffId: number;
}

export function CreateTaskModal({
  open,
  onClose,
  onCreate,
  assignableStaff,
  currentStaffId,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settle, triggerSettle] = useSettle();
  const [step, setStep] = useState<0 | 1>(0);
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const dueDateIsPast = dueDate !== "" && isPastDueDate(dueDate);

  const createTaskMissing = useMemo(
    () =>
      buildValidationItems([
        {
          id: "task-title",
          label: "Falta el título de la tarea",
          short: "el título",
          valid: title.trim().length > 0,
        },
        {
          id: "task-due-date",
          label: "La fecha límite no puede ser una fecha que ya pasó",
          short: "una fecha límite válida",
          valid: !dueDateIsPast,
        },
      ]),
    [title, dueDateIsPast],
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const transitionRef = useRef<{ fromHeight: number; dir: 1 | -1 } | null>(null);
  const changingRef = useRef(false);

  // Al cerrar (crear, cancelar o clic fuera) el formulario queda en blanco para la próxima tarea.
  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setAssignedStaffId("");
      setDueDate("");
      setEvidenceFiles([]);
      setError(null);
      setStep(0);
      transitionRef.current = null;
      changingRef.current = false;
    }
  }, [open]);

  // Desliza el paso nuevo y anima la altura de forma continua para evitar saltos en el modal.
  useLayoutEffect(() => {
    const pending = transitionRef.current;
    const wrap = wrapRef.current;
    const panel = panelRef.current;
    if (!pending || !wrap || !panel) return;
    transitionRef.current = null;

    panel.getAnimations().forEach((a) => a.cancel());
    const toHeight = wrap.offsetHeight;

    wrap.style.overflow = "hidden";
    const release = () => {
      wrap.style.overflow = "";
      changingRef.current = false;
    };
    const heightAnim = wrap.animate(
      [{ height: `${pending.fromHeight}px` }, { height: `${toHeight}px` }],
      { duration: STEP_IN_MS, easing: STEP_EASING },
    );
    heightAnim.onfinish = release;
    heightAnim.oncancel = release;
    panel.animate(
      [
        { opacity: 0, transform: `translateX(${pending.dir * STEP_SHIFT_PX}px)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: STEP_IN_MS, easing: STEP_EASING },
    );
  }, [step]);

  if (!open) return null;

  const goTo = (next: 0 | 1) => {
    if (next === step || changingRef.current) return;
    const wrap = wrapRef.current;
    const panel = panelRef.current;
    if (!wrap || !panel || prefersReducedMotion()) {
      setStep(next);
      return;
    }
    changingRef.current = true;
    const dir: 1 | -1 = next > step ? 1 : -1;
    transitionRef.current = { fromHeight: wrap.offsetHeight, dir };
    const out = panel.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: `translateX(${-dir * STEP_SHIFT_PX}px)` },
      ],
      { duration: STEP_OUT_MS, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" },
    );
    out.onfinish = () => setStep(next);
  };

  const handleNext = () => {
    if (!title.trim()) {
      setError("Título requerido");
      triggerSettle();
      return;
    }
    setError(null);
    goTo(1);
  };

  const handleAutoassign = () => {
    setAssignedStaffId(String(currentStaffId));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Enter en el primer paso avanza al siguiente; solo el último paso crea la tarea.
    if (step === 0) {
      handleNext();
      return;
    }
    if (!title.trim()) {
      setError("Título requerido");
      triggerSettle();
      goTo(0);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const formData = new FormData();
      formData.append("Title", title.trim());
      if (description.trim()) formData.append("Description", description.trim());
      if (assignedStaffId) formData.append("AssignedStaffId", assignedStaffId);
      if (dueDate) formData.append("DueDate", new Date(`${dueDate}T23:59:59`).toISOString());
      evidenceFiles.forEach((f) => formData.append("EvidenceFiles", f));

      await onCreate(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la tarea");
      triggerSettle();
    } finally {
      setSaving(false);
    }
  };

  const isSelfAssigned = assignedStaffId === String(currentStaffId);
  const assigneeLabel =
    assignedStaffId === ""
      ? "Sin asignar"
      : assignableStaff.find((s) => String(s.id) === assignedStaffId)?.fullName ?? "Colaborador";

  return (
    <Modal
      settle={settle}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Nueva tarea para este ticket"
      description="Asigna una acción interna (investigación, verificación, reclamo con fábrica) a ti o a otro colaborador."
      eyebrow="Tareas internas"
      maxWidth="max-w-xl"
      footer={
        <>
          {step === 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => goTo(0)}
              disabled={saving}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Atrás
            </Button>
          )}
          {step === 0 ? (
            <SubmitValidationButton
              ready={createTaskMissing.length === 0}
              busy={false}
              missingItems={createTaskMissing}
              onSubmit={handleNext}
              onFocusField={focusFormField}
              tone={error ? "ink" : "primary"}
              toneLabel={error}
              hintText="Para continuar, completa lo siguiente:"
            >
              Continuar
              <ArrowRight className="h-3.5 w-3.5" />
            </SubmitValidationButton>
          ) : (
            <SubmitValidationButton
              ready={createTaskMissing.length === 0}
              busy={saving}
              missingItems={createTaskMissing}
              onSubmit={() => void handleSubmit({ preventDefault: () => {} } as FormEvent)}
              onFocusField={focusFormField}
              tone={error ? "ink" : "primary"}
              toneLabel={error}
              hintText="Para crear la tarea en el ticket, completa lo siguiente:"
            >
              <Plus className="h-3.5 w-3.5" />
              {saving ? "Creando tarea..." : "Crear tarea"}
            </SubmitValidationButton>
          )}
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Indicador de progreso: dos segmentos, el activo se rellena. */}
        <div className="flex items-center gap-3" aria-label={`Paso ${step + 1} de ${STEPS.length}`}>
          <div className="flex flex-1 gap-1.5" aria-hidden>
            {STEPS.map((label, index) => (
              <span
                key={label}
                className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                  index <= step ? "bg-brand-red" : "bg-zinc-200"
                }`}
              />
            ))}
          </div>
          <span className="shrink-0 font-heading text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
            Paso {step + 1} de {STEPS.length} · {STEPS[step]}
          </span>
        </div>

        <div ref={wrapRef} className="-mx-1 -mb-1 px-1 pb-1">
          <div ref={panelRef} className="space-y-4">
            {step === 0 ? (
              <>
                <TextField
                  id="task-title"
                  label="Título de la tarea *"
                  placeholder="Ej.: Investigar lote reportado con almacén"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError(null);
                  }}
                  state={error && !title.trim() ? "error" : "idle"}
                  size="sm"
                  autoFocus
                />

                <TextAreaField
                  id="task-description"
                  label="Descripción o instrucciones"
                  placeholder="Detalla qué se necesita averiguar, qué pruebas realizar o qué información recopilar..."
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (error) setError(null);
                  }}
                  autoGrow
                  className="text-[12.5px] shadow-2xs"
                />

                <TaskEvidenceUpload
                  files={evidenceFiles}
                  onFilesChange={setEvidenceFiles}
                  label="Documentos adjuntos (opcional)"
                  dropzoneTitle="Haz clic o arrastra documentos de referencia"
                  dropzoneHint="Instrucciones, fotos del lote, correos o cualquier archivo útil para quien ejecute la tarea."
                  onReportError={(message) => {
                    if (message) {
                      setError(message);
                      triggerSettle();
                    } else if (error) setError(null);
                  }}
                />
              </>
            ) : (
              <>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 space-y-2">
                  <p className="font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-zinc-400">
                    Vista previa
                  </p>
                  <p className="font-heading text-[13px] font-semibold text-zinc-900 leading-tight">{title}</p>
                  {description.trim() && (
                    <p className="text-[12px] leading-relaxed text-zinc-600 line-clamp-4 whitespace-pre-line">
                      {description.trim()}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-zinc-600">
                    <span>
                      <span className="text-zinc-400">Asignada a:</span>{" "}
                      <strong className="font-semibold text-zinc-800">{assigneeLabel}</strong>
                    </span>
                    {dueDate && (
                      <span>
                        <span className="text-zinc-400">Vence:</span>{" "}
                        <strong className="font-semibold text-zinc-800 tabular-nums">{dueDate}</strong>
                      </span>
                    )}
                  </div>
                  {evidenceFiles.length > 0 && (
                    <div className="pt-1 border-t border-zinc-200/80">
                      <p className="mt-2 font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-zinc-500">
                        Documentos adjuntos ({evidenceFiles.length})
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {evidenceFiles.map((file, idx) => (
                          <li
                            key={`${file.name}-${idx}`}
                            className="flex items-center gap-1.5 text-[12px] text-zinc-700"
                          >
                            <FileText className="size-3 shrink-0 text-zinc-400" />
                            <span className="truncate font-medium">{file.name}</span>
                            <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
                              ({formatBytes(file.size)})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Asignación y autoasignación rápida */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="task-assignee"
                      className="font-heading text-[11px] font-semibold text-zinc-500"
                    >
                      Asignar a
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoassign}
                      className={`inline-flex items-center gap-1 text-[11.5px] font-medium transition-colors ${
                        isSelfAssigned
                          ? "text-brand-red font-semibold cursor-default"
                          : "text-zinc-500 hover:text-zinc-900 cursor-pointer hover:underline"
                      }`}
                    >
                      <UserCheck className="size-3.5 text-brand-red" />
                      {isSelfAssigned ? "Asignada a mí ✓" : "Autoasignarme a mí"}
                    </button>
                  </div>

                  <Select
                    id="task-assignee"
                    value={assignedStaffId}
                    onChange={(val: string) => {
                      setAssignedStaffId(val);
                      if (error) setError(null);
                    }}
                    options={[
                      { value: "", label: "Sin asignar (cualquiera del equipo)" },
                      ...assignableStaff.map((staff) => ({
                        value: String(staff.id),
                        label: staff.id === currentStaffId ? `${staff.fullName} (Tú)` : staff.fullName,
                      })),
                    ]}
                    size="sm"
                  />
                </div>

                {/* Fecha límite opcional */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="task-due-date"
                    className="font-heading text-[11px] font-semibold text-zinc-500 flex items-center gap-1.5"
                  >
                    <Calendar className="size-3.5 text-zinc-400" />
                    Fecha límite de entrega (opcional)
                  </label>
                  <DatePicker
                    id="task-due-date"
                    value={dueDate}
                    minDate={todayStr}
                    onChange={(val) => {
                      setDueDate(val);
                      if (error) setError(null);
                    }}
                    placeholder="Seleccionar fecha límite..."
                    headerLabel="Fecha límite"
                    align="center"
                    state={dueDateIsPast ? "error" : "idle"}
                    error={dueDateIsPast ? "La fecha límite no puede ser una fecha que ya pasó." : undefined}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
