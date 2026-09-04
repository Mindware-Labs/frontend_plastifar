import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { NEW_ID } from "../../lib/catalog";
import { PRIORITIES, type SlaPolicy, type TicketTopic } from "../../types/settings";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/settings/topics: nombre
 * unico y obligatorio, departamento y prioridad obligatorios, y el padre no
 * puede ser el propio motivo ni un motivo que ya sea hijo (solo dos niveles).
 */
const schema = z.object({
  name: z.string().trim().min(2, "Al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
  parentId: z.string(),
  defaultDepartmentId: z.string().min(1, "Elige a qué departamento se encola"),
  defaultPriority: z.string().min(1, "Elige la prioridad con la que nace"),
  slaPolicyId: z.string(),
  requiresProductLine: z.boolean(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface TopicModalProps {
  topic?: TicketTopic;
  topics: TicketTopic[];
  policies: SlaPolicy[];
  departments: { id: number; name: string }[];
  onClose: () => void;
  onSave: (topic: TicketTopic) => void;
}

export function TopicModal({
  topic,
  topics,
  policies,
  departments,
  onClose,
  onSave,
}: TopicModalProps) {
  const isEdit = topic !== undefined;

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: topic?.name ?? "",
      parentId: topic?.parentId === null || topic === undefined ? "" : String(topic.parentId),
      defaultDepartmentId: topic ? String(topic.defaultDepartmentId) : "",
      defaultPriority: topic?.defaultPriority ?? "Normal",
      slaPolicyId: topic?.slaPolicyId === null || topic === undefined ? "" : String(topic.slaPolicyId),
      requiresProductLine: topic?.requiresProductLine ?? false,
      isActive: topic?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  const priority = useWatch({ control, name: "defaultPriority" });

  // Solo dos niveles: un motivo que ya es hijo no puede ser padre de otro,
  // nadie puede ser su propio padre, y un motivo que ya tiene hijos no puede
  // pasar a tener padre (eso crearía una cadena de tres niveles).
  const hasChildren = topic !== undefined && topics.some((candidate) => candidate.parentId === topic.id);
  const possibleParents = hasChildren
    ? []
    : topics.filter((candidate) => candidate.parentId === null && candidate.id !== topic?.id);

  const defaultForPriority = policies.find(
    (policy) => policy.priority === priority && policy.isDefault,
  );

  function onSubmit(values: FormValues) {
    onSave({
      id: topic?.id ?? NEW_ID,
      name: values.name.trim(),
      parentId: values.parentId === "" ? null : Number(values.parentId),
      defaultDepartmentId: Number(values.defaultDepartmentId),
      defaultPriority: values.defaultPriority as TicketTopic["defaultPriority"],
      slaPolicyId: values.slaPolicyId === "" ? null : Number(values.slaPolicyId),
      requiresProductLine: values.requiresProductLine,
      isActive: values.isActive,
      ticketCount: topic?.ticketCount ?? 0,
    });
    onClose();
  }

  return (
    <Modal
      title={isEdit ? "Editar motivo" : "Nuevo motivo"}
      description="El motivo decide a qué cola entra el ticket, con qué prioridad nace y bajo qué compromiso de tiempo."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="topic-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear motivo"}
          </Button>
        </>
      }
    >
      <form id="topic-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Nombre"
          placeholder="Ej. Producto defectuoso"
          required
          state={stateOf("name")}
          error={errors.name?.message}
          hint="Lo elige quien abre el ticket: que se entienda sin contexto."
          {...register("name")}
        />

        <Controller
          name="parentId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Motivo padre"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="Ninguno · es de primer nivel"
              options={[
                { value: "", label: "Ninguno · es de primer nivel" },
                ...possibleParents.map((parent) => ({
                  value: String(parent.id),
                  label: parent.name,
                })),
              ]}
              state={stateOf("parentId")}
              error={errors.parentId?.message}
              hint="El catálogo admite dos niveles: un motivo con padre ya no puede tener hijos."
            />
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="defaultDepartmentId"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Departamento"
                required
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Elige uno"
                options={departments.map((department) => ({
                  value: String(department.id),
                  label: department.name,
                }))}
                state={stateOf("defaultDepartmentId")}
                error={errors.defaultDepartmentId?.message}
              />
            )}
          />

          <Controller
            name="defaultPriority"
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
                state={stateOf("defaultPriority")}
                error={errors.defaultPriority?.message}
              />
            )}
          />
        </div>

        <Controller
          name="slaPolicyId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Política de SLA"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="La predeterminada de la prioridad"
              options={[
                {
                  value: "",
                  label: defaultForPriority
                    ? `La de ${priority.toLowerCase()} · ${defaultForPriority.name}`
                    : `La predeterminada de ${priority.toLowerCase()}`,
                },
                ...policies
                  .filter((policy) => policy.isActive)
                  .map((policy) => ({ value: String(policy.id), label: policy.name })),
              ]}
              state={stateOf("slaPolicyId")}
              error={errors.slaPolicyId?.message}
              hint="Sin política propia se aplica la predeterminada de la prioridad elegida arriba."
            />
          )}
        />

        <div className="flex flex-col gap-2">
          <CheckboxField
            label="Exige indicar línea de producto"
            description="Para reclamaciones de calidad, que se siguen por línea."
            {...register("requiresProductLine")}
          />

          {isEdit && (
            <CheckboxField
              label="Activo"
              description="Si se desmarca, deja de ofrecerse al abrir un ticket."
              {...register("isActive")}
            />
          )}
        </div>
      </form>
    </Modal>
  );
}
