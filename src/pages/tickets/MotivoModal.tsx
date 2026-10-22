import { zodResolver } from "@hookform/resolvers/zod";
import { AlertOctagon, AlertTriangle, Check, Clock, Flag, Power } from "lucide-react";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { ticketTopicsApi } from "../../api/ticketTopics";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { departmentPathOptions } from "../../lib/departments";
import type { DepartmentResponse, SaveTicketTopicRequest, TicketTopicResponse } from "../../types/api";

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
  requiresProductLine: z.boolean(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

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
      requiresProductLine: topic?.requiresProductLine ?? false,
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
      requiresProductLine: values.requiresProductLine,
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
      if (err instanceof ApiError && err.status === 409) {
        setError("name", { message: err.message });
        setFocus("name");
        return;
      }
      const fallback = isEdit ? "No se pudo guardar el motivo" : "No se pudo crear el motivo";
      setFormError(err instanceof ApiError ? err.message : fallback);
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
      maxWidth="max-w-xl"
      eyebrow={isEdit ? `Tickets · Motivo #${topic.id}` : "Tickets · Motivos"}
      title={isEdit ? `Editar ${topic.name}` : "Nuevo motivo"}
      description={
        isEdit
          ? "Actualiza el motivo, departamento asignado y parámetros operativos."
          : "El departamento que elijas aquí se asignará de forma predeterminada al crear un ticket."
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
            <Button type="submit" form="motivo-form" size="sm" isLoading={isSubmitting}>
              {isEdit ? "Guardar cambios" : "Crear motivo"}
            </Button>
          </div>
        </div>
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
          placeholder="Ej. Faltante, Defecto de impresión, Avería en transporte…"
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
              label="Departamento que lo atiende"
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
              hint="Al seleccionar este motivo en un ticket nuevo, se asignará a este departamento por defecto."
            />
          )}
        />

        {/* 2. COMPORTAMIENTO Y SLA */}
        <FormDivider title="Comportamiento y SLA" />

        <Controller
          name="priority"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <label className="font-heading text-[11.5px] font-semibold text-faint">
                Prioridad por defecto <span className="text-brand-red">*</span>
              </label>
              <div
                role="radiogroup"
                aria-label="Prioridad por defecto"
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
              <span className="text-[11px] text-zinc-400">
                Se hereda automáticamente al ticket y condiciona sus tiempos objetivo de resolución.
              </span>
            </div>
          )}
        />

        <CheckboxField
          label="Exige línea de producto"
          description="Obliga a especificar la línea de producto al abrir tickets con este motivo (indicado para reclamaciones de calidad)."
          {...register("requiresProductLine")}
        />

        {/* 3. DISPONIBILIDAD (SI SE EDITA) */}
        {isEdit && (
          <>
            <FormDivider title="Disponibilidad" />
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-1">
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
                  <span className="text-[11px] text-zinc-400">
                    {field.value
                      ? "Disponible para ser seleccionado al crear o reclasificar tickets."
                      : "Oculto para nuevas aperturas; los tickets abiertos lo conservan."}
                  </span>
                </div>
              )}
            />

            {topic.ticketCount > 0 && (
              <Alert variant="info">
                {topic.ticketCount === 1
                  ? "1 ticket usa este motivo actualmente. Modificar el departamento no afectará los tickets existentes."
                  : `${topic.ticketCount} tickets usan este motivo actualmente. Modificar el departamento no afectará los tickets existentes.`}
              </Alert>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
