import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { cannedApi } from "../../api/canned";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import type { CannedResponseResponse } from "../../types/api";

const schema = z.object({
  title: z.string().trim().min(2, "Al menos 2 caracteres").max(120, "Máximo 120 caracteres"),
  body: z.string().trim().min(1, "Escribe el texto de la respuesta").max(20000, "Demasiado larga"),
});

type FormValues = z.infer<typeof schema>;

interface CannedResponseModalProps {
  /** Presente = edicion; ausente = alta. */
  item?: CannedResponseResponse;
  onClose: () => void;
  onSaved: () => void;
}

export function CannedResponseModal({ item, onClose, onSaved }: CannedResponseModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = item !== undefined;
  const { isExiting, requestClose } = useModalAnimation(onClose);

  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { title: item?.title ?? "", body: item?.body ?? "" },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      if (isEdit) await cannedApi.update(item.id, values.title, values.body);
      else await cannedApi.create(values.title, values.body);
      onSaved();
      requestClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar la respuesta");
    }
  }

  return (
    <Modal
      eyebrow="Correo · Respuestas"
      title={isEdit ? "Editar respuesta" : "Nueva respuesta"}
      description="Texto plano; los párrafos se separan con una línea en blanco. Al insertarla se puede ajustar antes de enviar."
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={requestClose}>
            Cancelar
          </Button>
          <Button type="submit" form="canned-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear respuesta"}
          </Button>
        </>
      }
    >
      <form id="canned-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Título"
          placeholder="Ej. Pedir número de pedido"
          required
          autoFocus
          state={stateOf("title")}
          error={errors.title?.message}
          {...register("title")}
        />

        <label className="flex flex-col gap-1.5">
          <span className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
            Texto <span className="text-brand-red">*</span>
          </span>
          <textarea
            rows={8}
            placeholder="Hola, gracias por escribirnos…"
            className={`w-full resize-y rounded-edge border bg-white px-3 py-2 text-[13px] text-ink outline-none
              placeholder:text-faint focus-visible:border-brand-red/40 ${
                errors.body ? "border-brand-red" : "border-line"
              }`}
            {...register("body")}
          />
          {errors.body && <span className="text-[11.5px] text-brand-red-dark">{errors.body.message}</span>}
        </label>
      </form>
    </Modal>
  );
}
