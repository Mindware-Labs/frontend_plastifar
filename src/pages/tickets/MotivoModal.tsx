import { zodResolver } from "@hookform/resolvers/zod";
import { AlertOctagon, AlertTriangle, Check, Clock, Flag, Power } from "lucide-react";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ticketTopicsApi } from "../../api/ticketTopics";
import { Alert } from "../../components/ui/Alert";
import { SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { FormModalFooter } from "../../components/ui/FormModalFooter";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { departmentPathOptions } from "../../lib/departments";
import { applyServerError } from "../../lib/formErrors";
import type { DepartmentResponse, SaveTicketTopicRequest, TicketTopicResponse } from "../../types/api";
import { FormDivider } from "../../components/ui/FormDivider";

const PRIORITIES: {
  value: "Emergencia" | "Alta" | "Normal" | "Baja";
  label: string;
  icon: typeof AlertOctagon;
  activeColor: string;
}[] = [
  { value: "Emergencia", label: "Emergencia", icon: AlertOctagon, activeColor: "text-red-600" },
  { value: "Alta", label: "Alta", icon: AlertTriangle, activeColor: "text-amber-600" },
  { value: "Normal", label: "Normal", icon: Clock, activeColor: "text-zinc-700" },
  { value: "Baja", label: "Baja", icon: Flag, activeColor: "text-zinc-500" },
];

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Al menos 2 caracteres")
    .max(120, "Máximo 120 caracteres"),
  departmentId: z.string().min(1, "Elige un departamento"),
  priority: z.enum(["Emergencia", "Alta", "Normal", "Baja"]),
  suggestedForm: z.string().nullable().optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface MotivoModalProps {
  /** Sin motivo = alta. */
  topic?: TicketTopicResponse;
  departments: DepartmentResponse[];
  onClose: () => void;
  onSaved: () => void;
}

export function MotivoModal({ topic, departments, onClose, onSaved }: MotivoModalProps) {
  const isEdit = topic !== undefined;
  const [formError, setFormError] = useState<string | null>(null);
  const { isExiting, requestClose } = useModalAnimation();

  const {
    control,
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: topic?.name ?? "",
      departmentId: topic ? String(topic.defaultDepartmentId) : "",
      priority: (topic?.defaultPriority as FormValues["priority"]) ?? "Normal",
      suggestedForm: topic?.suggestedForm ?? "",
      isActive: topic?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);

    const input: SaveTicketTopicRequest = {
      name: values.name.trim(),
      defaultDepartmentId: Number(values.departmentId),
      defaultPriority: values.priority,
      suggestedForm: values.suggestedForm || null,
      isActive: values.isActive,
    };

    try {
      if (isEdit) {
        await ticketTopicsApi.update(topic.id, input);
      } else {
        await ticketTopicsApi.create(input);
      }
      onSaved();
      requestClose();
    } catch (err) {
      const fallback = isEdit ? "No se pudo guardar el motivo" : "No se pudo crear el motivo";
      setFormError(
        applyServerError(err, {
          setError,
          setFocus,
          rules: [{ field: "name" }],
          statuses: [409],
          focusable: ["name"],
          fallback,
        }),
      );
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit(onSubmit)();
    }
  }

  return (
    <Modal
      size="lg"
      title={isEdit ? `Editar ${topic.name}` : "Nuevo motivo"}
      description={
        isEdit
          ? "Configura la clasificación, el departamento asignado y las reglas del motivo."
          : "Define un motivo para clasificar y enrutar los tickets en el sistema."
      }
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <FormModalFooter
          shortcut
          formId="motivo-form"
          isEdit={isEdit}
          createLabel="Crear motivo"
          isSubmitting={isSubmitting}
          onCancel={requestClose}
        />
      }
    >
      <form
        id="motivo-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        {/* 1. IDENTIFICACIÓN Y ASIGNACIÓN */}
        <FormDivider title="Identificación" />

        <TextField
          size="sm"
          label="Nombre del motivo"
          placeholder="Ej. Reclamación de calidad, Devolución, Faltante de despacho…"
          required
          maxLength={120}
          state={stateOf("name")}
          error={errors.name?.message}
          {...register("name")}
        />

        <Controller
          name="departmentId"
          control={control}
          render={({ field }) => (
            <SelectField
              size="sm"
              label="Departamento predeterminado"
              required
              searchable
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="Elige un departamento…"
              options={departmentPathOptions(departments)}
              state={stateOf("departmentId")}
              error={errors.departmentId?.message}
            />
          )}
        />

        {/* 2. COMPORTAMIENTO Y SLA */}
        <FormDivider title="Comportamiento y Reglas" />

        <Controller
          name="priority"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <label className="font-heading text-[11.5px] font-semibold text-faint">
                Prioridad predeterminada <span className="text-brand-red">*</span>
              </label>
              <div
                role="radiogroup"
                aria-label="Prioridad predeterminada"
                className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-lg border border-zinc-200 bg-zinc-50/70 p-0.5"
              >
                {PRIORITIES.map((item) => {
                  const isSelected = field.value === item.value;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => field.onChange(item.value)}
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
          )}
        />

        <Controller
          name="suggestedForm"
          control={control}
          render={({ field }) => (
            <SelectField
              size="sm"
              label="Formulario sugerido (Opcional)"
              value={field.value ?? ""}
              onChange={(val) => field.onChange(val ? val : null)}
              options={[
                { value: "", label: "Ninguno (ticket estándar)" },
                { value: "Reclamacion", label: "PF-FOR-034 · Reclamación de clientes" },
                { value: "RetiroMercancia", label: "PF-FOR-068 · Solicitud de retiro de mercancía" },
                { value: "DiscrepanciaCarga", label: "PF-FOR-291 · Discrepancia de carga" },
                { value: "Hca", label: "PF-FOR-109 · Hecho, Causa y Acción (HCA)" },
              ]}
              state={stateOf("suggestedForm")}
              error={errors.suggestedForm?.message}
            />
          )}
        />

        {/* 3. DISPONIBILIDAD (SI SE EDITA) */}
        {isEdit && (
          <>
            <FormDivider title="Disponibilidad" />
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-1.5">
                  <label className="font-heading text-[11.5px] font-semibold text-faint">
                    Estado del motivo
                  </label>
                  <div
                    role="radiogroup"
                    aria-label="Estado del motivo"
                    className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50/70 p-0.5"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={field.value === true}
                      onClick={() => field.onChange(true)}
                      className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] transition-all cursor-pointer select-none ${
                        field.value === true
                          ? "border border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                          : "border border-transparent font-medium text-zinc-600 hover:text-zinc-900 hover:bg-white/50"
                      }`}
                    >
                      <Check
                        className={`h-3 w-3 shrink-0 ${
                          field.value === true ? "text-emerald-600" : "text-zinc-400"
                        }`}
                      />
                      <span>Activo</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={field.value === false}
                      onClick={() => field.onChange(false)}
                      className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] transition-all cursor-pointer select-none ${
                        field.value === false
                          ? "border border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                          : "border border-transparent font-medium text-zinc-600 hover:text-zinc-900 hover:bg-white/50"
                      }`}
                    >
                      <Power
                        className={`h-3 w-3 shrink-0 ${
                          field.value === false ? "text-brand-red" : "text-zinc-400"
                        }`}
                      />
                      <span>Inactivo</span>
                    </button>
                  </div>
                </div>
              )}
            />

            {topic.ticketCount > 0 && (
              <p className="text-[11.5px] text-zinc-500">
                {topic.ticketCount === 1
                  ? "1 ticket usa este motivo actualmente."
                  : `${topic.ticketCount} tickets usan este motivo actualmente.`}
              </p>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
