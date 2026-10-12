import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { claimsApi } from "../../api/claims";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextAreaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { ClaimDetail, CustomerClaim } from "../../types/claims";

const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(15, "Explica por qué se reabre: al menos 15 caracteres")
    .max(1000, "Máximo 1000 caracteres"),
});

type FormValues = z.infer<typeof schema>;

interface ReopenClaimModalProps {
  claim: CustomerClaim;
  onClose: () => void;
  onSaved: (detail: ClaimDetail) => void;
}

/** RF-R6: reapertura con motivo. El motivo queda en la bitácora (regla 11). */
export function ReopenClaimModal({ claim, onClose, onSaved }: ReopenClaimModalProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { reason: "" },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const saved = await claimsApi.reopen(claim.id, values.reason.trim());
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo reabrir la reclamación");
    }
  }

  return (
    <Modal
      title={`Reabrir reclamación de ${claim.ticketNumber}`}
      description="Vuelve a «En tratamiento» y se puede corregir. El sello de cierre anterior se conserva en la bitácora."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="reopen-claim-form" isLoading={isSubmitting}>
            Reabrir
          </Button>
        </>
      }
    >
      <form id="reopen-claim-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextAreaField
          label="Motivo"
          required
          rows={3}
          placeholder="El cliente volvió a reportar el faltante tras la reposición"
          error={errors.reason?.message}
          {...register("reason")}
        />
      </form>
    </Modal>
  );
}
