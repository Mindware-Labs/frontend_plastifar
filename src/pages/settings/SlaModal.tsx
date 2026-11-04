import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  Flag,
  ListTodo,
  Ticket,
  Timer,
  Activity,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { Modal } from "../../components/ui/Modal";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
import { Select } from "../../components/ui/Select";
import { TimePicker } from "../../components/ui/TimePicker";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import {
  addWorkingMinutes,
  durationToMinutes,
  formatEquivalence,
  minutesToDuration,
  workdayMinutes,
  type DeadlineResult,
  type SlaTimeUnit,
} from "../../lib/sla";
import {
  WEEKDAYS,
  type Holiday,
  type SlaPolicy,
  type SlaPolicyType,
  type Weekday,
} from "../../types/settings";

const PRIORITY_OPTIONS = [
  {
    value: "Emergencia",
    label: "Emergencia",
    icon: <AlertOctagon className="h-3.5 w-3.5 text-brand-red shrink-0" />,
  },
  {
    value: "Alta",
    label: "Alta",
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
  },
  {
    value: "Normal",
    label: "Normal",
    icon: <Flag className="h-3.5 w-3.5 text-blue-500 shrink-0" />,
  },
  {
    value: "Baja",
    label: "Baja",
    icon: <Flag className="h-3.5 w-3.5 text-zinc-400 shrink-0" />,
  },
];

/** Cuatro aperturas y cuatro cierres en pareja (misma separación típica de jornada). */
const WORKDAY_OPEN_PRESETS = [
  { label: "07:00 a.m.", value: "07:00" },
  { label: "08:00 a.m.", value: "08:00" },
  { label: "08:30 a.m.", value: "08:30" },
  { label: "09:00 a.m.", value: "09:00" },
] as const;

const WORKDAY_CLOSE_PRESETS = [
  { label: "04:00 p.m.", value: "16:00" },
  { label: "05:00 p.m.", value: "17:00" },
  { label: "05:30 p.m.", value: "17:30" },
  { label: "06:00 p.m.", value: "18:00" },
] as const;

const TIME_UNIT_OPTIONS: { value: SlaTimeUnit; label: string; icon: React.ReactNode }[] = [
  {
    value: "minutos",
    label: "Minutos",
    icon: <Timer className="h-3.5 w-3.5 text-zinc-500 shrink-0" />,
  },
  {
    value: "horas",
    label: "Horas",
    icon: <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />,
  },
  {
    value: "dias",
    label: "Días",
    icon: <Calendar className="h-3.5 w-3.5 text-emerald-500 shrink-0" />,
  },
  {
    value: "semanas",
    label: "Semanas",
    icon: <CalendarDays className="h-3.5 w-3.5 text-purple-500 shrink-0" />,
  },
  {
    value: "meses",
    label: "Meses",
    icon: <CalendarRange className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
  },
];

const schema = z
  .object({
    name: z.string().trim().min(2, "Al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
    type: z.enum(["Ticket", "Tarea"]),
    priority: z.string().min(1, "Elige la prioridad"),
    resolutionQty: z
      .string()
      .trim()
      .min(1, "Indica el plazo de resolución")
      .regex(/^\d+$/, "Solo números enteros")
      .refine((value) => Number(value) > 0, "Mayor que cero"),
    resolutionUnit: z.enum(["minutos", "horas", "dias", "semanas", "meses"]),
    businessHoursOnly: z.boolean(),
    workdayStart: z.string().min(1, "Indica la hora de apertura"),
    workdayEnd: z.string().min(1, "Indica la hora de cierre"),
    workDays: z.array(z.string()),
    isDefault: z.boolean(),
    isActive: z.boolean(),
  })
  .refine((values) => !values.businessHoursOnly || values.workdayEnd > values.workdayStart, {
    path: ["workdayEnd"],
    message: "El cierre tiene que ser posterior a la apertura",
  })
  .refine((values) => !values.businessHoursOnly || values.workDays.length > 0, {
    path: ["workDays"],
    message: "Marca al menos un día laborable",
  });

type FormValues = z.infer<typeof schema>;

interface SlaModalProps {
  policy?: SlaPolicy;
  holidays: Holiday[];
  onClose: () => void;
  onSaved: (policy: SlaPolicy) => void;
}

const timeFormat = new Intl.DateTimeFormat("es-DO", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function FormDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 first:border-0 first:pt-0">
      <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400 select-none">
        {title}
      </span>
      <div className="h-px flex-1 bg-zinc-100" />
    </div>
  );
}

function skippedPhrase(leg: DeadlineResult): string {
  return [
    leg.skippedNonWorkdays > 0 &&
      `${leg.skippedNonWorkdays} ${
        leg.skippedNonWorkdays === 1 ? "día no laborable" : "días no laborables"
      }`,
    leg.skippedHolidays > 0 &&
      `${leg.skippedHolidays} ${leg.skippedHolidays === 1 ? "feriado" : "feriados"}`,
  ]
    .filter(Boolean)
    .join(" y ");
}

function SimulationRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5">
      <span className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
        {label}
      </span>
      <span className="text-[13px] font-semibold tabular-nums leading-snug text-zinc-900">{value}</span>
    </div>
  );
}

interface SlaLiveSimulationPanelProps {
  policyType: SlaPolicyType;
  now: Date;
  resolution: DeadlineResult;
  plazoLabel: string;
  onClose: () => void;
}

function SlaLiveSimulationPanel({
  policyType,
  now,
  resolution,
  plazoLabel,
  onClose,
}: SlaLiveSimulationPanelProps) {
  const resolutionLabel =
    policyType === "Tarea" ? "Fecha límite estimada" : "Resolución estimada";
  const skipped = skippedPhrase(resolution);

  return (
    <div aria-labelledby="sla-sim-title" className="flex w-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-zinc-200/90 pb-3">
        <div className="min-w-0">
          <p
            id="sla-sim-title"
            className="font-heading text-[11px] font-bold uppercase tracking-[0.08em] text-zinc-500"
          >
            Simulación en vivo
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
            Supone un {policyType === "Tarea" ? "registro de tarea" : "ticket"} creado ahora mismo.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-200/60 hover:text-zinc-700 cursor-pointer"
          aria-label="Ocultar simulación"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {resolution.impossible ? (
        <p className="py-3 text-[12px] leading-relaxed text-brand-red-dark">
          Con esta jornada no hay minutos laborables computables: el vencimiento nunca llegaría. Revisa
          horario y días marcados.
        </p>
      ) : (
        <dl className="divide-y divide-zinc-200/90" aria-live="polite">
          <SimulationRow label="Fecha de creación" value={timeFormat.format(now)} />
          <SimulationRow label={resolutionLabel} value={timeFormat.format(resolution.at)} />
          <SimulationRow label="Plazo configurado" value={plazoLabel} />
        </dl>
      )}

      {!resolution.impossible && skipped && (
        <p className="mt-3 border-t border-zinc-200/90 pt-3 text-[11px] leading-relaxed text-zinc-500">
          Hasta el cumplimiento se omiten {skipped}.
        </p>
      )}
    </div>
  );
}

const SIM_PANEL_WIDTH = 320;
const SIM_PANEL_GAP = 16;

function SlaSimulationModal({
  anchorRef,
  onClose,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;

      const anchorRect = anchor.getBoundingClientRect();
      const hostDialog = anchor.closest('[role="dialog"]');
      const hostRect = hostDialog?.getBoundingClientRect();
      const panelHeight = panel.getBoundingClientRect().height;
      if (panelHeight <= 0) return;

      const anchorCenterY = anchorRect.top + anchorRect.height / 2;
      const margin = 16;
      let top = anchorCenterY - panelHeight / 2;
      top = Math.min(Math.max(top, margin), window.innerHeight - panelHeight - margin);

      const preferredLeft = (hostRect?.right ?? anchorRect.right) + SIM_PANEL_GAP;
      const maxLeft = window.innerWidth - SIM_PANEL_WIDTH - margin;
      const left = Math.min(Math.max(preferredLeft, margin), maxLeft);

      setCoords({ top, left });
    };

    measure();
    const raf1 = requestAnimationFrame(measure);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(measure));

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    if (anchorRef.current) resizeObserver?.observe(anchorRef.current);
    if (panelRef.current) resizeObserver?.observe(panelRef.current);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <button
        type="button"
        aria-label="Cerrar simulación"
        className="absolute inset-0 bg-black/20 pointer-events-auto cursor-default"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="pointer-events-auto fixed w-[min(100vw-2rem,320px)] overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-[0_12px_36px_rgba(27,27,29,0.18)] transition-opacity duration-150"
        style={{
          left: coords?.left ?? -9999,
          top: coords?.top ?? -9999,
          opacity: coords ? 1 : 0,
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="animate-plf-side-panel-in p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

interface DurationFieldProps {
  label: string;
  required?: boolean;
  value: string;
  unit: SlaTimeUnit;
  onValueChange: (val: string) => void;
  onUnitChange: (unit: SlaTimeUnit) => void;
  error?: string;
  equivalenceText?: string;
  simulationControl?: {
    active: boolean;
    disabled?: boolean;
    onToggle: () => void;
  };
  inputAnchorRef?: RefObject<HTMLDivElement | null>;
}

function DurationField({
  label,
  required,
  value,
  unit,
  onValueChange,
  onUnitChange,
  error,
  equivalenceText,
  simulationControl,
  inputAnchorRef,
}: DurationFieldProps) {
  return (
    <div className="flex flex-col gap-1 text-left">
      <div className="flex items-center justify-between gap-2">
        <label className="font-heading text-[11.5px] font-semibold text-faint">
          {label} {required && <span className="text-brand-red">*</span>}
        </label>
        {simulationControl && (
          <button
            type="button"
            aria-label="Simulación en vivo"
            aria-pressed={simulationControl.active}
            title="Ver simulación en vivo"
            disabled={simulationControl.disabled}
            onClick={simulationControl.onToggle}
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
              simulationControl.active
                ? "border-brand-red/35 bg-brand-red/10 text-brand-red shadow-2xs"
                : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800"
            }`}
          >
            <Activity className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      <div
        ref={inputAnchorRef}
        className={`flex h-9 rounded-lg border bg-white transition-colors overflow-hidden ${
          error
            ? "border-brand-red ring-1 ring-brand-red/20"
            : "border-zinc-200 hover:border-zinc-300 focus-within:border-zinc-400"
        }`}
      >
        <input
          type="number"
          min={1}
          value={value}
          data-skip-autofocus
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="Ej. 8"
          className="w-full min-w-0 border-0 bg-transparent px-3 py-1.5 text-[13px] text-ink focus:outline-none placeholder:text-zinc-400 tabular-nums"
        />
        <div className="w-[120px] shrink-0 border-l border-zinc-200 flex items-center h-full">
          <Select
            size="sm"
            centered
            value={unit}
            onChange={(val) => onUnitChange(val as SlaTimeUnit)}
            options={TIME_UNIT_OPTIONS}
            className="w-full h-full"
            buttonClassName="border-0 rounded-none rounded-r-lg bg-zinc-50/70 hover:bg-zinc-100/80 focus:bg-white shadow-none h-full !py-0 !px-2.5"
          />
        </div>
      </div>

      {equivalenceText && (
        <span className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono mt-0.5">
          <Clock className="h-3 w-3 text-zinc-400 shrink-0" />
          <span className="truncate">{equivalenceText}</span>
        </span>
      )}

      {error && (
        <p className="flex items-center gap-1 text-[11px] font-medium text-brand-red-dark animate-plf-shake">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export function SlaModal({ policy, holidays, onClose, onSaved }: SlaModalProps) {
  const isEdit = policy !== undefined;
  const [formError, setFormError] = useState<string | null>(null);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const plazoInputAnchorRef = useRef<HTMLDivElement>(null);
  const { isExiting, requestClose } = useModalAnimation();

  // Initial duration decomposition
  const initialResDuration = useMemo(() => {
    if (!policy) return { value: "", unit: "horas" as SlaTimeUnit };
    const perDay = workdayMinutes(policy);
    return minutesToDuration(policy.resolutionMinutes, policy.businessHoursOnly, perDay, policy.workDays.length);
  }, [policy]);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, touchedFields, isSubmitted, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      name: policy?.name ?? "",
      type: (policy?.type ?? "Ticket") as SlaPolicyType,
      priority: policy?.priority ?? "Normal",
      resolutionQty:
        initialResDuration.value === "" ? "" : String(initialResDuration.value),
      resolutionUnit: initialResDuration.unit,
      businessHoursOnly: policy?.businessHoursOnly ?? true,
      workdayStart: policy?.workdayStart ?? "08:00",
      workdayEnd: policy?.workdayEnd ?? "17:00",
      workDays: policy?.workDays ?? ["L", "M", "X", "J", "V"],
      isDefault: policy?.isDefault ?? false,
      isActive: policy?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field] && (isSubmitted || touchedFields[field])) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  const selectedType = useWatch({ control, name: "type" });
  const selectedPriority = useWatch({ control, name: "priority" });
  const businessHoursOnly = useWatch({ control, name: "businessHoursOnly" });
  const workdayStart = useWatch({ control, name: "workdayStart" });
  const workdayEnd = useWatch({ control, name: "workdayEnd" });
  const workDays = useWatch({ control, name: "workDays" });

  const resolutionQty = useWatch({ control, name: "resolutionQty" });
  const resolutionUnit = useWatch({ control, name: "resolutionUnit" });
  const policyName = useWatch({ control, name: "name" }) ?? "";

  const slaFormMissing = useMemo(() => {
    const qty = Number(resolutionQty);
    const qtyValid = resolutionQty.trim().length > 0 && Number.isFinite(qty) && qty > 0;
    const hoursValid =
      !businessHoursOnly ||
      (workdayEnd > workdayStart && (workDays?.length ?? 0) > 0);
    return buildValidationItems([
      {
        id: "name",
        label: "Falta el nombre de la política",
        short: "el nombre",
        valid: policyName.trim().length >= 2,
      },
      {
        id: "priority",
        label: "Falta elegir la prioridad",
        short: "la prioridad",
        valid: Boolean(selectedPriority),
      },
      {
        id: "resolutionQty",
        label: "Falta el plazo de resolución",
        short: "el plazo de resolución",
        valid: qtyValid,
      },
      {
        id: "workdayStart",
        label: "Revisa la jornada laboral (apertura, cierre o días)",
        short: "la jornada laboral",
        valid: hoursValid,
      },
    ]);
  }, [
    policyName,
    selectedPriority,
    resolutionQty,
    businessHoursOnly,
    workdayEnd,
    workdayStart,
    workDays,
  ]);

  const perWorkday = workdayMinutes({
    businessHoursOnly,
    workdayStart,
    workdayEnd,
  });

  const computedResolutionMinutes = useMemo(() => {
    return durationToMinutes(
      Number(resolutionQty) || 0,
      resolutionUnit,
      businessHoursOnly,
      perWorkday,
      workDays?.length ?? 5,
    );
  }, [resolutionQty, resolutionUnit, businessHoursOnly, perWorkday, workDays]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!simulationOpen) return;
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [simulationOpen]);

  useEffect(() => {
    if (simulationOpen && computedResolutionMinutes <= 0) {
      setSimulationOpen(false);
    }
  }, [simulationOpen, computedResolutionMinutes]);

  // Evitar que el foco se coloque automáticamente en el primer campo al entrar
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLSelectElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        document.activeElement.blur();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const simulation = useMemo(() => {
    const shape = {
      businessHoursOnly,
      workdayStart,
      workdayEnd,
      workDays: workDays as Weekday[],
    };

    if (computedResolutionMinutes <= 0) return null;

    return {
      now,
      resolution: addWorkingMinutes(now, computedResolutionMinutes, shape, holidays),
    };
  }, [now, businessHoursOnly, workdayStart, workdayEnd, workDays, holidays, computedResolutionMinutes]);

  const plazoSummary = formatEquivalence(
    Number(resolutionQty) || 0,
    resolutionUnit,
    computedResolutionMinutes,
    businessHoursOnly,
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit(onSubmit)();
    }
  }

  async function onSubmit(form: FormValues) {
    setFormError(null);

    const resMins = durationToMinutes(
      Number(form.resolutionQty),
      form.resolutionUnit,
      form.businessHoursOnly,
      perWorkday,
      form.workDays.length,
    );

    const request = {
      name: form.name.trim(),
      type: form.type,
      priority: form.priority as SlaPolicy["priority"],
      firstResponseMinutes: resMins,
      resolutionMinutes: resMins,
      businessHoursOnly: form.businessHoursOnly,
      workdayStart: form.workdayStart,
      workdayEnd: form.workdayEnd,
      workDays: form.workDays as Weekday[],
      isDefault: form.isDefault,
      isActive: form.isActive,
    };

    try {
      const saved = isEdit
        ? await settingsApi.slaPolicies.update(policy.id, request)
        : await settingsApi.slaPolicies.create(request);
      onSaved(saved);
      requestClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar la política de SLA");
    }
  }

  return (
    <>
      <Modal
      maxWidth="max-w-xl"
      eyebrow={isEdit ? `Política #${policy.id} · ${policy.type}` : "Configuración de nivel de servicio"}
      title={isEdit ? `Editar ${policy.name}` : "Nueva política de SLA"}
      description={
        isEdit
          ? "Actualiza los tiempos comprometidos, jornada aplicable o alcance de la política."
          : "Define los plazos objetivos de atención y cumplimiento para tickets o tareas."
      }
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
            <span className="ml-0.5">para guardar</span>
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
              Cancelar
            </Button>
            <SubmitValidationButton
              formId="sla-form"
              ready={slaFormMissing.length === 0}
              busy={isSubmitting}
              missingItems={slaFormMissing}
              onFocusField={focusFormField}
              hintText="Para guardar la política SLA, completa lo siguiente:"
            >
              {isEdit ? "Guardar cambios" : "Crear política"}
            </SubmitValidationButton>
          </div>
        </div>
      }
    >
      <form
        id="sla-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        {/** 1. TIPO Y ALCANCE */}
        <FormDivider title="Tipo y alcance" />

        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <label className="font-heading text-[11.5px] font-semibold text-faint">
                Tipo de política SLA <span className="text-brand-red">*</span>
              </label>
              <div
                role="radiogroup"
                aria-label="Tipo de política"
                className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50/70 p-0.5"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={field.value === "Ticket"}
                  onClick={() => field.onChange("Ticket")}
                  className={`inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-[12.5px] transition-all cursor-pointer select-none ${
                    field.value === "Ticket"
                      ? "border border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                      : "border border-transparent font-medium text-zinc-600 hover:text-zinc-900 hover:bg-white/50"
                  }`}
                >
                  <Ticket
                    className={`h-3.5 w-3.5 shrink-0 ${field.value === "Ticket" ? "text-brand-red" : "text-zinc-400"}`}
                  />
                  <span>Tickets de clientes</span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={field.value === "Tarea"}
                  onClick={() => field.onChange("Tarea")}
                  className={`inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-[12.5px] transition-all cursor-pointer select-none ${
                    field.value === "Tarea"
                      ? "border border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                      : "border border-transparent font-medium text-zinc-600 hover:text-zinc-900 hover:bg-white/50"
                  }`}
                >
                  <ListTodo
                    className={`h-3.5 w-3.5 shrink-0 ${field.value === "Tarea" ? "text-brand-red" : "text-zinc-400"}`}
                  />
                  <span>Tareas operativas</span>
                </button>
              </div>
            </div>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <TextField
              size="sm"
              label="Nombre de la política"
              placeholder={
                selectedType === "Tarea"
                  ? "Ej. Tareas estándar · Normal"
                  : "Ej. Alta · Atención prioritaria"
              }
              required
              data-skip-autofocus
              state={stateOf("name")}
              error={(isSubmitted || touchedFields.name) ? errors.name?.message : undefined}
              {...register("name")}
            />
          </div>
          <div>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <SelectField
                  size="sm"
                  label="Prioridad"
                  required
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  options={PRIORITY_OPTIONS}
                  state={stateOf("priority")}
                  error={errors.priority?.message}
                />
              )}
            />
          </div>
        </div>

        {/** 2. COMPROMISO DE TIEMPO */}
        <FormDivider title="Compromiso de tiempo" />

        <Controller
          name="resolutionQty"
          control={control}
          render={({ field }) => (
            <DurationField
              label="Plazo de resolución / cumplimiento"
              required
              value={field.value}
              unit={resolutionUnit}
              onValueChange={(val) => field.onChange(val)}
              onUnitChange={(u) => setValue("resolutionUnit", u, { shouldValidate: true })}
              error={errors.resolutionQty?.message}
              inputAnchorRef={plazoInputAnchorRef}
              simulationControl={{
                active: simulationOpen,
                disabled: computedResolutionMinutes <= 0,
                onToggle: () => setSimulationOpen((open) => !open),
              }}
            />
          )}
        />

        {/** 3. HORARIO Y JORNADA */}
        <FormDivider title="Jornada y cómputo" />

        <CheckboxField
          label="Cómputo en horario laboral"
          description="Si se desmarca, el reloj corre continuo (24/7), incluyendo noches y fines de semana."
          {...register("businessHoursOnly")}
        />

        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            businessHoursOnly ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
          }`}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 text-left">
                  <label className="font-heading text-[11.5px] font-semibold text-faint">
                    Apertura <span className="text-brand-red">*</span>
                  </label>
                  <Controller
                    name="workdayStart"
                    control={control}
                    render={({ field }) => (
                      <TimePicker
                        value={field.value}
                        onChange={field.onChange}
                        state={stateOf("workdayStart")}
                        error={errors.workdayStart?.message}
                        preferDropUp
                        presets={[...WORKDAY_OPEN_PRESETS]}
                      />
                    )}
                  />
                  {errors.workdayStart?.message && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-brand-red-dark">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{errors.workdayStart.message}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1 text-left">
                  <label className="font-heading text-[11.5px] font-semibold text-faint">
                    Cierre <span className="text-brand-red">*</span>
                  </label>
                  <Controller
                    name="workdayEnd"
                    control={control}
                    render={({ field }) => (
                      <TimePicker
                        value={field.value}
                        onChange={field.onChange}
                        state={stateOf("workdayEnd")}
                        error={errors.workdayEnd?.message}
                        preferDropUp
                        presets={[...WORKDAY_CLOSE_PRESETS]}
                      />
                    )}
                  />
                  {errors.workdayEnd?.message && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-brand-red-dark">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{errors.workdayEnd.message}</span>
                    </p>
                  )}
                </div>
              </div>

              <Controller
                name="workDays"
                control={control}
                render={({ field }) => (
                  <div
                    role="group"
                    aria-labelledby="sla-workdays-label"
                    className="flex w-full flex-col gap-1 text-left"
                  >
                    <span
                      id="sla-workdays-label"
                      className="font-heading text-[11.5px] font-semibold text-faint"
                    >
                      Días laborables
                    </span>
                    <div className="grid w-full grid-cols-7 gap-2">
                      {WEEKDAYS.map((day) => {
                        const checked = (field.value as string[]).includes(day.key);

                        return (
                          <label
                            key={day.key}
                            className={`flex h-9 w-full cursor-pointer items-center justify-center rounded-lg border font-heading text-[12.5px] font-bold transition-all select-none
                              has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-red/30 ${
                                checked
                                  ? "border-brand-red bg-brand-red text-white shadow-xs"
                                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 shadow-2xs"
                              }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              aria-label={day.label}
                              aria-invalid={errors.workDays !== undefined}
                              aria-describedby={errors.workDays ? "workdays-error" : undefined}
                              onChange={(event) =>
                                field.onChange(
                                  event.target.checked
                                    ? [...(field.value as string[]), day.key]
                                    : (field.value as string[]).filter((value) => value !== day.key),
                                )
                              }
                            />
                            {day.key}
                          </label>
                        );
                      })}
                    </div>
                    {errors.workDays?.message && (
                      <span id="workdays-error" className="text-[11px] font-medium text-brand-red-dark animate-plf-shake">
                        {errors.workDays.message}
                      </span>
                    )}
                  </div>
                )}
              />
            </div>
          </div>
        </div>

        {/** 4. CONFIGURACIÓN */}
        <FormDivider title="Comportamiento" />

        <div className="flex flex-col gap-2">
          <CheckboxField
            label={`Predeterminada para ${selectedType === "Tarea" ? "tareas" : "tickets"} (${selectedPriority.toLowerCase()})`}
            description="Se aplica automáticamente cuando no se indique una política específica."
            {...register("isDefault")}
          />

          {isEdit && (
            <CheckboxField
              label="Política activa"
              description="Si se desmarca, deja de estar disponible para nuevas asignaciones."
              {...register("isActive")}
            />
          )}
        </div>
      </form>
      </Modal>

      {simulationOpen && simulation ? (
        <SlaSimulationModal anchorRef={plazoInputAnchorRef} onClose={() => setSimulationOpen(false)}>
          <SlaLiveSimulationPanel
            policyType={selectedType}
            now={simulation.now}
            resolution={simulation.resolution}
            plazoLabel={plazoSummary}
            onClose={() => setSimulationOpen(false)}
          />
        </SlaSimulationModal>
      ) : null}
    </>
  );
}
