import { ArrowLeft, ArrowRight, Calendar, Plus, UserCheck } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { DatePicker } from "../../components/ui/DatePicker";
import { TextField } from "../../components/ui/Field";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { prefersReducedMotion } from "../../hooks/motion";
import { useSettle } from "../../hooks/useSettle";
import type { CreateTicketTaskRequest, TicketStaffOptionResponse } from "../../types/api";

// Misma curva larga que el resto de paneles: arranca rápido y se asienta con suavidad.
const STEP_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const STEP_OUT_MS = 160;
const STEP_IN_MS = 420;
const STEP_SHIFT_PX = 28;

const STEPS = ["Detalle", "Responsable y fecha"] as const;

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (task: CreateTicketTaskRequest) => Promise<void>;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settle, triggerSettle] = useSettle();
  const [step, setStep] = useState<0 | 1>(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const transitionRef = useRef<{ fromHeight: number; dir: 1 | -1 } | null>(null);
  const changingRef = useRef(false);

  // Al cerrar, el próximo uso vuelve a empezar por el primer paso (ajuste durante el render).
  if (!open && step !== 0) setStep(0);

  // Las animaciones pendientes del paso se descartan al cerrar.
  useEffect(() => {
    if (!open) {
      transitionRef.current = null;
      changingRef.current = false;
    }
  }, [open]);

  // Entrada del paso nuevo: el contenido se desliza desde el lado de avance y la caja
  // cambia de altura de forma continua, para que el modal no dé un salto.
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
      await onCreate({
        title: title.trim(),
        description: description.trim() || null,
        assignedStaffId: assignedStaffId ? Number(assignedStaffId) : null,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la tarea");
      triggerSettle();
    } finally {
      setSaving(false);
    }
  };

  const isSelfAssigned = assignedStaffId === String(currentStaffId);

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
            <Button
              type="button"
              size="sm"
              tone={error ? "ink" : "primary"}
              toneLabel={error}
              onClick={handleNext}
            >
              Continuar
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              tone={error ? "ink" : "primary"}
              toneLabel={error}
              onClick={handleSubmit}
            >
              <Plus className="h-3.5 w-3.5" />
              {saving ? "Creando tarea..." : "Crear tarea"}
            </Button>
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

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="task-description"
                    className="font-heading text-[11px] font-semibold text-zinc-500"
                  >
                    Descripción o instrucciones
                  </label>
                  <textarea
                    id="task-description"
                    rows={9}
                    placeholder="Detalla qué se necesita averiguar, qué pruebas realizar o qué información recopilar..."
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      if (error) setError(null);
                    }}
                    className="min-h-[180px] w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-[12.5px] leading-relaxed text-zinc-800 shadow-2xs outline-none transition-colors focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 placeholder:text-zinc-400"
                  />
                </div>
              </>
            ) : (
              <>
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
                    onChange={(val) => {
                      setDueDate(val);
                      if (error) setError(null);
                    }}
                    placeholder="Seleccionar fecha límite..."
                    headerLabel="Fecha límite"
                    align="center"
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
