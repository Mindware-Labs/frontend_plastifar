import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { discrepanciesApi } from "../../api/discrepancies";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextAreaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { DiscrepancyDetail, LoadDiscrepancy } from "../../types/discrepancies";

const schema = z.object({
  note: z.string().trim().max(500, "Máximo 500 caracteres"),
});

type FormValues = z.infer<typeof schema>;

interface DiscrepancyDecisionModalProps {
  discrepancy: LoadDiscrepancy;
  decision: "aprobar" | "devolver";
  onClose: () => void;
  onSaved: (detail: DiscrepancyDetail) => void;
}

/**
 * RF-D5: aprobar o devolver con nota. La nota es obligatoria al devolver
 * (sección 13); al aprobar es opcional. Si quien realizó puede aprobar está
 * abierto (pregunta 1): aquí no se impide, y el servidor tampoco.
 */
export function DiscrepancyDecisionModal({ discrepancy, decision, onClose, onSaved }: DiscrepancyDecisionModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const approving = decision === "aprobar";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(
      approving ? schema : schema.extend({ note: z.string().trim().min(10, "Explica por qué se devuelve: al menos 10 caracteres").max(500, "Máximo 500 caracteres") }),
    ),
    mode: "onTouched",
    defaultValues: { note: "" },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const note = values.note.trim();
    try {
      const saved = await discrepanciesApi.decide(discrepancy.id, approving, note === "" ? null : note);
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : approving ? "No se pudo aprobar" : "No se pudo devolver");
    }
  }

  return (
    <Modal
      title={approving ? `Aprobar ${discrepancy.number}` : `Devolver ${discrepancy.number}`}
      description={
        approving
          ? `Firmas como «Aprobado por». Realizada por ${discrepancy.performedByName ?? "—"}. Una investigación aprobada ya no se edita.`
          : "Vuelve a quien la realizó con tu nota; la reabre y corrige."
      }
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="discrepancy-decision-form" variant={approving ? "primary" : "danger"} isLoading={isSubmitting}>
            {approving ? "Aprobar" : "Devolver"}
          </Button>
        </>
      }
    >
      <form id="discrepancy-decision-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        {discrepancy.hasSecurityFinding && (
          <Alert variant="info">
            Esta investigación tiene un hallazgo de seguridad. Confirma que el punto 9 refleja la notificación formal.
          </Alert>
        )}
        <TextAreaField
          label={approving ? "Nota (opcional)" : "Motivo de la devolución"}
          required={!approving}
          rows={3}
          placeholder={approving ? "Observación para el expediente" : "Qué falta o qué está mal"}
          error={errors.note?.message}
          {...register("note")}
        />
      </form>
    </Modal>
  );
}
