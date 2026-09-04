import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { addWorkingMinutes, humanizeMinutes, workdayMinutes } from "../../lib/sla";
import {
  PRIORITIES,
  WEEKDAYS,
  type Holiday,
  type SlaPolicy,
  type Weekday,
} from "../../types/settings";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/settings/sla-policies:
 * nombre unico, minutos positivos, jornada con cierre posterior a la apertura y
 * al menos un dia laborable cuando el reloj corre solo en horario laboral.
 */
const schema = z
  .object({
    name: z.string().trim().min(2, "Al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
    priority: z.string().min(1, "Elige la prioridad"),
    // Minutos como texto, igual que el resto de los formularios del panel: el
    // valor de un input siempre es string y coaccionarlo en el esquema rompe la
    // inferencia de tipos de react-hook-form.
    firstResponseMinutes: z
      .string()
      .regex(/^\d+$/, "Solo números enteros")
      .refine((value) => Number(value) > 0, "Tiene que ser mayor que cero"),
    resolutionMinutes: z
      .string()
      .regex(/^\d+$/, "Solo números enteros")
      .refine((value) => Number(value) > 0, "Tiene que ser mayor que cero"),
    businessHoursOnly: z.boolean(),
    workdayStart: z.string().min(1, "Indica la hora de apertura"),
    workdayEnd: z.string().min(1, "Indica la hora de cierre"),
    workDays: z.array(z.string()),
    isDefault: z.boolean(),
    isActive: z.boolean(),
  })
  .refine((values) => Number(values.resolutionMinutes) >= Number(values.firstResponseMinutes), {
    path: ["resolutionMinutes"],
    message: "No puede ser menor que la primera respuesta",
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

export function SlaModal({ policy, holidays, onClose, onSaved }: SlaModalProps) {
  const isEdit = policy !== undefined;
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: policy?.name ?? "",
      priority: policy?.priority ?? "Normal",
      firstResponseMinutes: String(policy?.firstResponseMinutes ?? 60),
      resolutionMinutes: String(policy?.resolutionMinutes ?? 480),
      businessHoursOnly: policy?.businessHoursOnly ?? true,
      workdayStart: policy?.workdayStart ?? "08:00",
      workdayEnd: policy?.workdayEnd ?? "17:00",
      workDays: policy?.workDays ?? ["L", "M", "X", "J", "V"],
      isDefault: policy?.isDefault ?? false,
      isActive: policy?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  // Campo a campo y como variables sueltas: watch() devuelve un objeto nuevo en
  // cada render, y agruparlas en uno propio deja al compilador de React sin poder
  // rastrear las dependencias del simulador.
  const businessHoursOnly = useWatch({ control, name: "businessHoursOnly" });
  const workdayStart = useWatch({ control, name: "workdayStart" });
  const workdayEnd = useWatch({ control, name: "workdayEnd" });
  const workDays = useWatch({ control, name: "workDays" });
  const firstResponseMinutes = useWatch({ control, name: "firstResponseMinutes" });
  const resolutionMinutes = useWatch({ control, name: "resolutionMinutes" });

  const perWorkday = workdayMinutes({
    businessHoursOnly: businessHoursOnly,
    workdayStart: workdayStart,
    workdayEnd: workdayEnd,
  });

  /**
   * El simulador: los minutos son una abstraccion que nadie puede comprobar de
   * cabeza. Se responde la pregunta que el administrador tiene de verdad —«si
   * entra un ticket ahora, cuando vence»— y se recalcula al cambiar la regla.
   */
  const simulation = useMemo(() => {
    const now = new Date();
    const shape = {
      businessHoursOnly: businessHoursOnly,
      workdayStart: workdayStart,
      workdayEnd: workdayEnd,
      workDays: workDays as Weekday[],
    };

    const first = Number(firstResponseMinutes);
    const resolution = Number(resolutionMinutes);

    if (!Number.isFinite(first) || !Number.isFinite(resolution) || first <= 0 || resolution <= 0) {
      return null;
    }

    return {
      now,
      firstResponse: addWorkingMinutes(now, first, shape, holidays),
      resolution: addWorkingMinutes(now, resolution, shape, holidays),
    };
  }, [businessHoursOnly, workdayStart, workdayEnd, workDays, firstResponseMinutes, resolutionMinutes, holidays]);

  async function onSubmit(form: FormValues) {
    setFormError(null);
    const request = {
      name: form.name.trim(),
      priority: form.priority as SlaPolicy["priority"],
      firstResponseMinutes: Number(form.firstResponseMinutes),
      resolutionMinutes: Number(form.resolutionMinutes),
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
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar la política");
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar política de SLA" : "Nueva política de SLA"}
      description="El compromiso de tiempo que se copia al ticket al crearlo, en forma de dos fechas de vencimiento."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="sla-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear política"}
          </Button>
        </>
      }
    >
      <form id="sla-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Nombre"
          placeholder="Ej. Alta · jornada laboral"
          required
          state={stateOf("name")}
          error={errors.name?.message}
          {...register("name")}
        />

        <Controller
          name="priority"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Prioridad"
              required
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={PRIORITIES.map((value) => ({ value, label: value }))}
              state={stateOf("priority")}
              error={errors.priority?.message}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Primera respuesta"
            type="number"
            min={1}
            required
            state={stateOf("firstResponseMinutes")}
            error={errors.firstResponseMinutes?.message}
            hint={humanizeMinutes(Number(firstResponseMinutes) || 0, perWorkday)}
            {...register("firstResponseMinutes")}
          />
          <TextField
            label="Resolución"
            type="number"
            min={1}
            required
            state={stateOf("resolutionMinutes")}
            error={errors.resolutionMinutes?.message}
            hint={humanizeMinutes(Number(resolutionMinutes) || 0, perWorkday)}
            {...register("resolutionMinutes")}
          />
        </div>

        <CheckboxField
          label="El reloj corre solo en horario laboral"
          description="Si se desmarca, el tiempo corre continuo, también de noche y en fin de semana."
          {...register("businessHoursOnly")}
        />

        {businessHoursOnly && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Apertura"
                type="time"
                required
                state={stateOf("workdayStart")}
                error={errors.workdayStart?.message}
                {...register("workdayStart")}
              />
              <TextField
                label="Cierre"
                type="time"
                required
                state={stateOf("workdayEnd")}
                error={errors.workdayEnd?.message}
                {...register("workdayEnd")}
              />
            </div>

            <Controller
              name="workDays"
              control={control}
              render={({ field }) => (
                <fieldset
                  className="flex flex-col gap-1.5"
                  aria-invalid={errors.workDays !== undefined}
                  aria-describedby={errors.workDays ? "workdays-error" : undefined}
                >
                  <legend className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
                    Días laborables
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((day) => {
                      const checked = (field.value as string[]).includes(day.key);

                      return (
                        <label
                          key={day.key}
                          className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-edge border
                            font-heading text-[12px] font-semibold transition-colors
                            has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand-red/25 ${
                              checked
                                ? "border-brand-red bg-brand-red text-white"
                                : "border-line-strong bg-white text-muted hover:border-zinc-400 hover:text-ink"
                            }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            aria-label={day.label}
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
                    <span id="workdays-error" className="text-[11.5px] font-medium text-brand-red-dark">
                      {errors.workDays.message}
                    </span>
                  )}
                </fieldset>
              )}
            />
          </>
        )}

        {/* El simulador: la regla se vuelve observable antes de guardarla. */}
        {simulation && (
          <div
            aria-live="polite"
            className="rounded-edge border border-dashed border-line-strong bg-canvas px-3.5 py-3"
          >
            <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
              Si entra un ticket ahora · {timeFormat.format(simulation.now)}
            </p>

            {simulation.firstResponse.impossible || simulation.resolution.impossible ? (
              <p className="mt-2 text-[12.5px] leading-relaxed text-brand-red-dark">
                Con esta jornada no hay minutos laborables que consumir: el vencimiento nunca
                llegaría. Revisa el horario y los días marcados.
              </p>
            ) : (
              <dl className="mt-2 flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[12.5px] text-brand-gray">Primera respuesta</dt>
                  <dd className="text-[12.5px] font-medium tabular-nums text-ink">
                    {timeFormat.format(simulation.firstResponse.at)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[12.5px] text-brand-gray">Resolución</dt>
                  <dd className="text-[12.5px] font-medium tabular-nums text-ink">
                    {timeFormat.format(simulation.resolution.at)}
                  </dd>
                </div>

                {(simulation.resolution.skippedHolidays > 0 ||
                  simulation.resolution.skippedNonWorkdays > 0) && (
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-faint">
                    En el camino salta{" "}
                    {[
                      simulation.resolution.skippedNonWorkdays > 0 &&
                        `${simulation.resolution.skippedNonWorkdays} ${
                          simulation.resolution.skippedNonWorkdays === 1
                            ? "día no laborable"
                            : "días no laborables"
                        }`,
                      simulation.resolution.skippedHolidays > 0 &&
                        `${simulation.resolution.skippedHolidays} ${
                          simulation.resolution.skippedHolidays === 1 ? "feriado" : "feriados"
                        }`,
                    ]
                      .filter(Boolean)
                      .join(" y ")}
                    .
                  </p>
                )}
              </dl>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <CheckboxField
            label="Predeterminada de su prioridad"
            description="Se aplica a los motivos que no tengan una política propia. Solo puede haber una por prioridad."
            {...register("isDefault")}
          />

          {isEdit && (
            <CheckboxField
              label="Activa"
              description="Si se desmarca, deja de poder asignarse a motivos y a tickets nuevos."
              {...register("isActive")}
            />
          )}
        </div>
      </form>
    </Modal>
  );
}
