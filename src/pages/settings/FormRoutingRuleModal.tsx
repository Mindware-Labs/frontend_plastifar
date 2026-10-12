import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { departmentsApi } from "../../api/departments";
import { fetchAllPages } from "../../api/paging";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { departmentPathOptions } from "../../lib/departments";
import type { DepartmentResponse } from "../../types/api";
import {
  REQUIRED_FORMS,
  ROUTING_MOMENTS,
  type FormRoutingRule,
  type RequiredForm,
  type RoutingMoment,
  type Team,
} from "../../types/settings";

/**
 * Espejo de FormRoutingRulesController.ValidateAsync: formulario y momento
 * obligatorios; departamento o equipo, uno; bloqueante solo al completar la
 * tarea.
 */
const schema = z
  .object({
    form: z.string().min(1, "Elige el formulario"),
    moment: z.string().min(1, "Elige el momento"),
    target: z.enum(["departamento", "equipo"]),
    departmentId: z.string(),
    teamId: z.string(),
    isBlocking: z.boolean(),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.target === "departamento" && values.departmentId === "") {
      ctx.addIssue({ code: "custom", path: ["departmentId"], message: "Elige el departamento" });
    }
    if (values.target === "equipo" && values.teamId === "") {
      ctx.addIssue({ code: "custom", path: ["teamId"], message: "Elige el equipo" });
    }
    if (values.isBlocking && values.moment !== "AlCompletarTarea") {
      ctx.addIssue({ code: "custom", path: ["isBlocking"], message: "Solo una regla «al completar la tarea» puede bloquear el cierre" });
    }
  });

type FormValues = z.infer<typeof schema>;

interface FormRoutingRuleModalProps {
  /** Ausente = alta. */
  rule?: FormRoutingRule;
  onClose: () => void;
  onSaved: (rule: FormRoutingRule) => void;
}

export function FormRoutingRuleModal({ rule, onClose, onSaved }: FormRoutingRuleModalProps) {
  const isEdit = rule !== undefined;
  const [formError, setFormError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    departmentsApi.list({ includeInactive: true }).then(setDepartments).catch(() => setDepartments([]));
    fetchAllPages<Team>((page, pageSize) => settingsApi.teams.list({ page, pageSize })).then(setTeams).catch(() => setTeams([]));
  }, []);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      form: rule?.form ?? "",
      moment: rule?.moment ?? "",
      target: rule?.teamId ? "equipo" : "departamento",
      departmentId: rule?.departmentId ? String(rule.departmentId) : "",
      teamId: rule?.teamId ? String(rule.teamId) : "",
      isBlocking: rule?.isBlocking ?? false,
      isActive: rule?.isActive ?? true,
    },
  });

  const target = useWatch({ control, name: "target" });
  const moment = useWatch({ control, name: "moment" });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const request = {
      form: values.form as RequiredForm,
      moment: values.moment as RoutingMoment,
      departmentId: values.target === "departamento" ? Number(values.departmentId) : null,
      teamId: values.target === "equipo" ? Number(values.teamId) : null,
      isBlocking: values.moment === "AlCompletarTarea" && values.isBlocking,
      isActive: values.isActive,
    };

    try {
      const saved = isEdit ? await settingsApi.formRoutingRules.update(rule.id, request) : await settingsApi.formRoutingRules.create(request);
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar la regla");
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar regla" : "Nueva regla de formulario"}
      description="Quién llena o consulta un formulario y en qué momento. Un departamento incluye a sus hijos."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="routing-rule-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear regla"}
          </Button>
        </>
      }
    >
      <form id="routing-rule-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="form"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Formulario"
                required
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Elige uno"
                options={REQUIRED_FORMS}
                error={errors.form?.message}
              />
            )}
          />
          <Controller
            name="moment"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Momento"
                required
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Elige uno"
                options={ROUTING_MOMENTS}
                error={errors.moment?.message}
              />
            )}
          />
        </div>

        <Controller
          name="target"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Aplica a"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={[
                { value: "departamento", label: "Un departamento (y sus hijos)" },
                { value: "equipo", label: "Un equipo" },
              ]}
            />
          )}
        />

        {target === "departamento" ? (
          <Controller
            name="departmentId"
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
                options={departmentPathOptions(departments)}
                error={errors.departmentId?.message}
              />
            )}
          />
        ) : (
          <Controller
            name="teamId"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Equipo"
                required
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Elige uno"
                options={teams.filter((t) => t.isActive || String(t.id) === field.value).map((t) => ({ value: String(t.id), label: t.name }))}
                error={errors.teamId?.message}
              />
            )}
          />
        )}

        <CheckboxField
          label="Bloquea el cierre de la tarea"
          description={
            moment === "AlCompletarTarea"
              ? "La tarea no podrá completarse sin este formulario (lo comprobará la Bandeja al conectarse)."
              : "Solo aplica con el momento «Al completar la tarea»."
          }
          disabled={moment !== "AlCompletarTarea"}
          {...register("isBlocking")}
        />
        {errors.isBlocking && <p className="text-[12px] text-brand-red">{errors.isBlocking.message}</p>}

        {isEdit && <CheckboxField label="Activa" description="Si se desmarca, la regla deja de aplicar sin borrarse." {...register("isActive")} />}
      </form>
    </Modal>
  );
}
