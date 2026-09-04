import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { qualityApi } from "../../api/quality";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextAreaField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { today } from "../../lib/quality";
import type { CorrectiveActionSheet } from "../../types/quality";

const schema = z.object({
  checkedOn: z.string().min(1, "Indica cuándo se verificó"),
  effectivenessNotes: z
    .string()
    .trim()
    .min(20, "Escribe qué se comprobó y con qué resultado: al menos 20 caracteres")
    .max(2000, "Máximo 2000 caracteres"),
});

type FormValues = z.infer<typeof schema>;

interface EffectivenessModalProps {
  sheet: CorrectiveActionSheet;
  onClose: () => void;
  onSaved: (sheet: CorrectiveActionSheet) => void;
}

/**
 * RF-Q5: la verificacion de eficacia es obligatoria para cerrar. Se registra
 * aparte del cierre a proposito — comprobar que la accion funciono y dar la
 * hoja por cerrada son dos actos distintos, y en el tiempo suelen serlo por
 * semanas.
 */
export function EffectivenessModal({ sheet, onClose, onSaved }: EffectivenessModalProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      checkedOn: sheet.effectivenessCheckAt?.slice(0, 10) ?? today(),
      effectivenessNotes: sheet.effectivenessNotes ?? "",
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const saved = await qualityApi.sheets.registerEffectiveness(
        sheet.id,
        values.checkedOn,
        values.effectivenessNotes.trim(),
      );
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo registrar la verificación");
    }
  }

  return (
    <Modal
      title="Verificación de eficacia"
      description="Qué se comprobó después de aplicar el plan, y si la no conformidad dejó de repetirse."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="effectiveness-form" isLoading={isSubmitting}>
            Registrar verificación
          </Button>
        </>
      }
    >
      <form
        id="effectiveness-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Verificada el"
          type="date"
          required
          state={stateOf("checkedOn")}
          error={errors.checkedOn?.message}
          {...register("checkedOn")}
        />

        <TextAreaField
          label="Resultado"
          required
          rows={4}
          placeholder="Qué se revisó, sobre cuántos casos, y qué se encontró"
          error={errors.effectivenessNotes?.message}
          {...register("effectivenessNotes")}
        />
      </form>
    </Modal>
  );
}
