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

// Espejo de WithdrawalRules.ValidateCancel (sección 13).
const schema = z.object({
  reason: z.string().trim().min(10, "Explica por qué se cancela: al menos 10 caracteres").max(500, "Máximo 500 caracteres"),
});

type FormValues = z.infer<typeof schema>;

interface WithdrawalCancelModalProps {
  withdrawal: MerchandiseWithdrawal;
  onClose: () => void;
  onSaved: (detail: WithdrawalDetail) => void;
  /**
   * 409: la solicitud cambió en el servidor (otro la decidió, la retiró o la
   * canceló). Quien abre el modal recarga la ficha y muestra el mensaje.
   */
  onConflict?: (message: string) => void;
}

/** Cancelar con motivo (8.1). No hay borrado: la solicitud queda visible como cancelada (regla 9). */
export function WithdrawalCancelModal({ withdrawal, onClose, onSaved, onConflict }: WithdrawalCancelModalProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: { reason: "" } });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const saved = await withdrawalsApi.cancel(withdrawal.id, values.reason.trim());
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && onConflict) {
        onConflict(err.message);
        onClose();
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo cancelar la solicitud");
    }
  }

  return (
    <Modal
      title={`Cancelar ${withdrawal.number}`}
      description="La cancelación es final. La solicitud no se borra: queda visible como cancelada, con tu motivo."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Volver
          </Button>
          <Button type="submit" form="withdrawal-cancel-form" variant="danger" isLoading={isSubmitting}>
            Cancelar solicitud
          </Button>
        </>
      }
    >
      <form id="withdrawal-cancel-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextAreaField
          label="Motivo de la cancelación"
          required
          rows={3}
          placeholder="Por qué ya no procede el retiro"
          error={errors.reason?.message}
          {...register("reason")}
        />
      </form>
    </Modal>
  );
}
