import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { departmentsApi } from "../../api/departments";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, LookupField, SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { FormSection } from "../../components/ui/FormSection";
import { Modal } from "../../components/ui/Modal";
import { departmentPaths } from "../../lib/departments";
import { resolveStaffLabel, searchActiveStaff } from "../../lib/lookups";
import type { DepartmentResponse } from "../../types/api";
import { REQUIRED_FORMS, type RequiredForm, type TaskType } from "../../types/settings";

/**
 * Espejo de la validación del servidor en POST/PUT /api/settings/task-types
 * (TaskTypesController.ValidateAsync): nombre de 3 a 120 y único, plazo entre
 * 1 y 365, al menos un departamento, formulario conocido si viene.
 */
const schema = z.object({
  name: z.string().trim().min(3, "Al menos 3 caracteres").max(120, "Máximo 120 caracteres"),
  slaDays: z
    .string()
    .trim()
    .refine((value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 365, "Un número de días entre 1 y 365"),
  businessDays: z.enum(["indefinido", "laborables", "calendario"]),
  requiredForm: z.string(),
  departmentIds: z.array(z.string()).min(1, "Elige al menos un departamento"),
  assigneeStaffIds: z.array(z.object({ id: z.string(), name: z.string() })),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const DAYS_OPTIONS = [
  { value: "indefinido", label: "Por definir (pregunta 1 de Plastifar)" },
  { value: "laborables", label: "Días laborables" },
  { value: "calendario", label: "Días calendario" },
];

interface TaskTypeModalProps {
  /** Ausente = alta. */
  taskType?: TaskType;
  onClose: () => void;
  onSaved: (taskType: TaskType) => void;
}

export function TaskTypeModal({ taskType, onClose, onSaved }: TaskTypeModalProps) {
  const isEdit = taskType !== undefined;
  const [formError, setFormError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentResponse[] | null>(null);
  const [assigneePick, setAssigneePick] = useState("");

  // Los departamentos son unidades de la empresa, del orden de la decena: se traen enteros.
  useEffect(() => {
    departmentsApi
      .list({ includeInactive: true })
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: taskType?.name ?? "",
      slaDays: taskType ? String(taskType.slaDays) : "",
      businessDays: taskType?.businessDaysOnly === null || taskType === undefined ? "indefinido" : taskType.businessDaysOnly ? "laborables" : "calendario",
      requiredForm: taskType?.requiredForm ?? "",
      departmentIds: taskType?.departments.map((d) => String(d.id)) ?? [],
      assigneeStaffIds: taskType?.assignees.map((a) => ({ id: String(a.staffId), name: a.name })) ?? [],
      isActive: taskType?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  const paths = departments ? departmentPaths(departments) : new Map<number, string>();

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const request = {
      name: values.name.trim(),
      slaDays: Number(values.slaDays),
      businessDaysOnly: values.businessDays === "indefinido" ? null : values.businessDays === "laborables",
      requiredForm: values.requiredForm === "" ? null : (values.requiredForm as RequiredForm),
      departmentIds: values.departmentIds.map(Number),
      assigneeStaffIds: values.assigneeStaffIds.map((a) => Number(a.id)),
      isActive: values.isActive,
    };

    try {
      const saved = isEdit ? await settingsApi.taskTypes.update(taskType.id, request) : await settingsApi.taskTypes.create(request);
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("name", { message: err.message });
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar el tipo de tarea");
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar tipo de tarea" : "Nuevo tipo de tarea"}
      description="Una acción de la hoja SLA con su plazo. Lo que se guarde aquí lo heredará cada tarea que nazca con este tipo."
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="task-type-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear tipo"}
          </Button>
        </>
      }
    >
      <form id="task-type-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <FormSection title="La acción">
          <TextField
            label="Nombre"
            placeholder="Ej. INVESTIGACION DE CALIDAD"
            required
            state={stateOf("name")}
            error={errors.name?.message}
            {...register("name")}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Plazo en días"
              type="number"
              min="1"
              max="365"
              inputMode="numeric"
              required
              state={stateOf("slaDays")}
              error={errors.slaDays?.message}
              {...register("slaDays")}
            />
            <Controller
              name="businessDays"
              control={control}
              render={({ field }) => (
                <SelectField
                  label="Cómo se cuentan"
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  options={DAYS_OPTIONS}
                  hint="La hoja SLA dice solo «DIAS». Hasta que Plastifar responda, ningún vencimiento se calcula."
                />
              )}
            />
          </div>
          <Controller
            name="requiredForm"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Formulario exigido para completar la tarea"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={[{ value: "", label: "Ninguno" }, ...REQUIRED_FORMS]}
                error={errors.requiredForm?.message}
              />
            )}
          />
        </FormSection>

        <FormSection title="Departamentos" hint="A quién corresponde la tarea. Al menos uno.">
          <Controller
            name="departmentIds"
            control={control}
            render={({ field }) => (
              <div>
                {departments === null ? (
                  <p className="text-[12.5px] text-faint">Cargando departamentos…</p>
                ) : (
                  <div className="grid max-h-[220px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                    {departments
                      .filter((d) => d.isActive || field.value.includes(String(d.id)))
                      .map((d) => {
                        const id = String(d.id);
                        const checked = field.value.includes(id);
                        return (
                          <CheckboxField
                            key={d.id}
                            label={paths.get(d.id) ?? d.name}
                            checked={checked}
                            onBlur={field.onBlur}
                            onChange={() => field.onChange(checked ? field.value.filter((v) => v !== id) : [...field.value, id])}
                          />
                        );
                      })}
                  </div>
                )}
                {errors.departmentIds && <p className="mt-1.5 text-[12px] text-brand-red">{errors.departmentIds.message}</p>}
              </div>
            )}
          />
        </FormSection>

        <FormSection title="Responsables habituales" hint="Opcional. Con uno solo, la tarea nacerá asignada; con varios, sin asignar y visible para todos.">
          <Controller
            name="assigneeStaffIds"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                {field.value.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {field.value.map((person) => (
                      <li key={person.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[12.5px] text-ink">
                        {person.name}
                        <button
                          type="button"
                          aria-label={`Quitar a ${person.name}`}
                          onClick={() => field.onChange(field.value.filter((v) => v.id !== person.id))}
                          className="inline-flex size-4 items-center justify-center rounded-full text-faint hover:bg-fill hover:text-ink"
                        >
                          <X className="size-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <LookupField
                      label="Agregar persona"
                      name="assignee-pick"
                      value={assigneePick}
                      onChange={(value, option) => {
                        setAssigneePick("");
                        if (value === "" || option === null || field.value.some((v) => v.id === value)) return;
                        field.onChange([...field.value, { id: value, name: option.label }]);
                      }}
                      placeholder="Buscar en el personal activo…"
                      searchPlaceholder="Nombre o correo…"
                      search={searchActiveStaff}
                      resolveSelectedLabel={resolveStaffLabel}
                    />
                  </div>
                  <span aria-hidden className="pb-2 text-faint">
                    <Plus className="size-4" />
                  </span>
                </div>
              </div>
            )}
          />
        </FormSection>

        {isEdit && (
          <CheckboxField
            label="Activo"
            description="Si se desmarca, deja de ofrecerse al crear tareas. Lo ya creado lo conserva."
            {...register("isActive")}
          />
        )}
      </form>
    </Modal>
  );
}
