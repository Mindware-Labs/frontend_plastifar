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
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
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

interface DurationFieldProps {
  label: string;
  required?: boolean;
  value: string;
  unit: SlaTimeUnit;
  onValueChange: (val: string) => void;
  onUnitChange: (unit: SlaTimeUnit) => void;
  error?: string;
  equivalenceText?: string;
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
}: DurationFieldProps) {
  return (
    <div className="flex flex-col gap-1 text-left">
      <label className="font-heading text-[11.5px] font-semibold text-faint">
        {label} {required && <span className="text-brand-red">*</span>}
      </label>

      <div
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
  const { isExiting, requestClose } = useModalAnimation();

  // Initial duration decomposition
  const initialResDuration = useMemo(() => {
    if (!policy) return { value: 8, unit: "horas" as SlaTimeUnit };
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
      resolutionQty: String(initialResDuration.value),
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

  // Live timer for simulation
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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
            <Button type="submit" form="sla-form" size="sm" isLoading={isSubmitting}>
              {isEdit ? "Guardar cambios" : "Crear política"}
            </Button>
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

        {/* 1. TIPO Y ALCANCE */}
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

        {/* 2. COMPROMISO DE TIEMPO */}
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
              equivalenceText={formatEquivalence(
                Number(resolutionQty) || 0,
                resolutionUnit,
                computedResolutionMinutes,
                businessHoursOnly,
              )}
            />
          )}
        />

        {/* 3. HORARIO Y JORNADA */}
        <FormDivider title="Jornada y cómputo" />

        <CheckboxField
          label="Cómputo en horario laboral"
          description="Si se desmarca, el reloj corre continuo (24/7), incluyendo noches y fines de semana."
          {...register("businessHoursOnly")}
        />

        {businessHoursOnly && (
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                size="sm"
                label="Apertura"
                type="time"
                required
                data-skip-autofocus
                state={stateOf("workdayStart")}
                error={errors.workdayStart?.message}
                {...register("workdayStart")}
              />
              <TextField
                size="sm"
                label="Cierre"
                type="time"
                required
                data-skip-autofocus
                state={stateOf("workdayEnd")}
                error={errors.workdayEnd?.message}
                {...register("workdayEnd")}
              />
            </div>

            <Controller
              name="workDays"
              control={control}
              render={({ field }) => (
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="font-heading text-[11px] font-semibold text-faint">
                    Días laborables
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((day) => {
                      const checked = (field.value as string[]).includes(day.key);

                      return (
                        <label
                          key={day.key}
                          className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border
                            font-heading text-[12px] font-semibold transition-all
                            has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-red/30 ${
                              checked
                                ? "border-brand-red bg-brand-red text-white shadow-2xs"
                                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
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
                </fieldset>
              )}
            />
          </div>
        )}

        {/* 4. SIMULADOR */}
        {simulation && (
          <div
            aria-live="polite"
            className="rounded-lg border border-zinc-200/90 bg-zinc-50/70 px-3.5 py-2.5 text-left"
          >
            <p className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-zinc-500">
              Simulación en vivo · {timeFormat.format(simulation.now)}
            </p>

            {simulation.resolution.impossible ? (
              <p className="mt-1.5 text-[12px] leading-relaxed text-brand-red-dark">
                Con esta jornada no hay minutos laborables computables: el vencimiento nunca
                llegaría. Revisa el horario y los días marcados.
              </p>
            ) : (
              <dl className="mt-2 flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-[12px]">
                  <dt className="text-zinc-500">
                    {selectedType === "Tarea" ? "Fecha límite estimada" : "Resolución estimada"}
                  </dt>
                  <dd className="font-semibold tabular-nums text-zinc-900">
                    {timeFormat.format(simulation.resolution.at)}
                  </dd>
                </div>

                {(() => {
                  const targetPhrase = skippedPhrase(simulation.resolution);
                  if (!targetPhrase) return null;

                  return (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                      Hasta el cumplimiento salta {targetPhrase}.
                    </p>
                  );
                })()}
              </dl>
            )}
          </div>
        )}

        {/* 5. CONFIGURACIÓN */}
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
  );
}
