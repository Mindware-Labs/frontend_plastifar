import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Gavel, Power } from "lucide-react";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { ticketVerdictsApi } from "../../api/ticketVerdicts";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import type { SaveTicketVerdictRequest, TicketVerdictResponse } from "../../types/api";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Al menos 2 caracteres")
    .max(120, "Máximo 120 caracteres"),
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

interface VeredictoModalProps {
  /** Sin veredicto = alta. */
  verdict?: TicketVerdictResponse;
  onClose: () => void;
  onSaved: () => void;
}

export function VeredictoModal({ verdict, onClose, onSaved }: VeredictoModalProps) {
  const isEdit = verdict !== undefined;
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
      name: verdict?.name ?? "",
      isActive: verdict?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);

    const input: SaveTicketVerdictRequest = {
      name: values.name.trim(),
      isActive: values.isActive,
    };

    try {
      if (isEdit) {
        await ticketVerdictsApi.update(verdict.id, input);
      } else {
        await ticketVerdictsApi.create(input);
      }
      onSaved();
      requestClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("name", { message: err.message });
        setFocus("name");
        return;
      }
      const fallback = isEdit ? "No se pudo guardar el veredicto" : "No se pudo crear el veredicto";
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
      eyebrow={isEdit ? `Tickets · Veredicto #${verdict.id}` : "Tickets · Veredictos"}
      title={isEdit ? `Editar ${verdict.name}` : "Nuevo veredicto"}
      description={
        isEdit
          ? "Actualiza el término del veredicto para el cierre y resolución de tickets."
          : "Define una opción de veredicto que se ofrecerá al marcar un ticket como solucionado."
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
            <Button type="submit" form="veredicto-form" size="sm" isLoading={isSubmitting}>
              {isEdit ? "Guardar cambios" : "Crear veredicto"}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="veredicto-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        {/* 1. IDENTIFICACIÓN */}
        <FormDivider title="Identificación" />

        <TextField
          size="sm"
          label="Nombre del veredicto"
          placeholder="Ej. Procedente, Reemplazo de producto, No procede…"
          required
          maxLength={120}
          state={stateOf("name")}
          error={errors.name?.message}
          hint="Se presenta como opción técnica/operativa al marcar un ticket como solucionado."
          {...register("name")}
        />

        {/* 2. DISPONIBILIDAD (SI SE EDITA) */}
        {isEdit && (
          <>
            <FormDivider title="Disponibilidad" />
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <label className="font-heading text-[11.5px] font-semibold text-faint">
                    Estado del veredicto
                  </label>
                  <div
                    role="radiogroup"
                    aria-label="Estado del veredicto"
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
                      ? "Disponible para ser seleccionado en la resolución de tickets."
                      : "No aparecerá en el selector de veredictos para nuevos cierres."}
                  </span>
                </div>
              )}
            />

            {verdict.ticketCount > 0 && (
              <Alert variant="info">
                {verdict.ticketCount === 1
                  ? "1 ticket ha sido solucionado con este veredicto."
                  : `${verdict.ticketCount} tickets han sido solucionados con este veredicto.`}
              </Alert>
            )}
          </>
        )}

        {/* 3. PROPÓSITO */}
        <FormDivider title="Uso en resolución" />

        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 p-3 text-left">
          <div className="flex items-start gap-2.5">
            <Gavel className="h-4 w-4 shrink-0 text-brand-red mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-[12px] font-medium text-zinc-800">
                Clasificación de solución
              </p>
              <p className="text-[11.5px] leading-relaxed text-zinc-500">
                El veredicto documenta formalmente la conclusión técnica u operativa antes de dar por completado un ticket en el sistema.
              </p>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
