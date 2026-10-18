import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { withdrawalsApi } from "../../api/withdrawals";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextAreaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { MerchandiseWithdrawal, WithdrawalDetail } from "../../types/withdrawals";

const schema = z.object({
  note: z.string().trim().max(500, "Máximo 500 caracteres"),
});

type FormValues = z.infer<typeof schema>;

interface WithdrawalDecisionModalProps {
  withdrawal: MerchandiseWithdrawal;
  decision: "aprobar" | "rechazar";
  onClose: () => void;
  onSaved: (detail: WithdrawalDetail) => void;
  /**
   * 409: la solicitud cambió en el servidor (otro la decidió, la retiró o la
   * canceló). Quien abre el modal recarga la ficha y muestra el mensaje.
   */
  onConflict?: (message: string) => void;
}

/**
 * RF-W3: aprobar o rechazar con nota. La nota es obligatoria al rechazar
 * (sección 13). Si quien solicitó puede aprobar lo suyo está abierto
 * (pregunta 9): aquí no se impide, y el servidor tampoco.
 */
export function WithdrawalDecisionModal({ withdrawal, decision, onClose, onSaved, onConflict }: WithdrawalDecisionModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const approving = decision === "aprobar";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(
      approving
        ? schema
        : schema.extend({ note: z.string().trim().min(10, "Explica por qué se rechaza: al menos 10 caracteres").max(500, "Máximo 500 caracteres") }),
    ),
    mode: "onTouched",
    defaultValues: { note: "" },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const note = values.note.trim();
    try {
      const saved = await withdrawalsApi.decide(withdrawal.id, approving, note === "" ? null : note);
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && onConflict) {
        onConflict(err.message);
        onClose();
        return;
      }
      setFormError(err instanceof ApiError ? err.message : approving ? "No se pudo aprobar" : "No se pudo rechazar");
    }
  }

  return (
    <Modal
      title={approving ? `Aprobar ${withdrawal.number}` : `Rechazar ${withdrawal.number}`}
      description={
        approving
          ? `Solicitada por ${withdrawal.requestedByName}. Una vez aprobada, Almacén puede registrar el retiro.`
          : "El rechazo es final; quien solicitó recibe tu nota por correo."
      }
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="withdrawal-decision-form" variant={approving ? "primary" : "danger"} isLoading={isSubmitting}>
            {approving ? "Aprobar" : "Rechazar"}
          </Button>
        </>
      }
    >
      <form id="withdrawal-decision-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        {withdrawal.errorOrigin && (
          <Alert variant="info">
            Origen del error: {withdrawal.errorOrigin}. La hoja SLA asigna esta aprobación a{" "}
            {withdrawal.approvalArea === "ALMACEN" ? "Almacén" : "Ventas Locales"}.
          </Alert>
        )}
        <TextAreaField
          label={approving ? "Nota (opcional)" : "Motivo del rechazo"}
          required={!approving}
          rows={3}
          placeholder={approving ? "Observación para el expediente" : "Por qué no procede el retiro"}
          error={errors.note?.message}
          {...register("note")}
        />
      </form>
    </Modal>
  );
}
