import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { withdrawalsApi } from "../../api/withdrawals";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { FormSection } from "../../components/ui/FormSection";
import { Modal } from "../../components/ui/Modal";
import { formatQuantity } from "../../lib/claims";
import { MAX_LINE_INPUT } from "../../lib/withdrawals";
import type { MerchandiseWithdrawal, WithdrawalDetail } from "../../types/withdrawals";

// Espejo de WithdrawalRules.ValidateComplete (sección 13).
const schema = z.object({
  customerSignerName: z
    .string()
    .trim()
    .min(3, "Escribe quién entrega por parte del cliente: al menos 3 caracteres")
    .max(160, "Máximo 160 caracteres"),
  lines: z.array(
    z.object({
      lineId: z.number(),
      withdrawnQuantity: z
        .string()
        .trim()
        .refine((value) => value !== "" && !Number.isNaN(Number(value)) && Number(value) >= 0, "Número de cero en adelante")
        .refine((value) => !(Number(value) > MAX_LINE_INPUT), "Máximo mil millones")
        .refine((value) => value === "" || Number((Number(value) * 100).toFixed(6)) % 1 === 0, "Hasta dos decimales"),
    }),
  ),
});

type FormValues = z.infer<typeof schema>;

interface WithdrawalCompleteModalProps {
  withdrawal: MerchandiseWithdrawal;
  onClose: () => void;
  onSaved: (detail: WithdrawalDetail) => void;
  /**
   * 409: la solicitud cambió en el servidor (otro la decidió, la retiró o la
   * canceló). Quien abre el modal recarga la ficha y muestra el mensaje.
   */
  onConflict?: (message: string) => void;
}

/**
 * RF-W5: registrar el retiro efectuado. Cada línea lleva la cantidad que se
 * recogió de verdad; si difiere de la solicitada, la diferencia queda visible
 * en la ficha (regla 10). Quien registra firma como Almacén; la firma del
 * cliente va en el papel y aquí se guarda su nombre (pregunta 6).
 *
 * Integración diferida (docs/plan/02, módulo de tickets y tareas): RF-W4 pide
 * llegar aquí desde la tarea de retiro de Almacén, con «Imprimir» y
 * «Registrar retiro». Ese acceso vive en el detalle de la tarea, que es del
 * módulo de tickets; por ahora se registra desde la ficha de la solicitud.
 */
export function WithdrawalCompleteModal({ withdrawal, onClose, onSaved, onConflict }: WithdrawalCompleteModalProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      customerSignerName: "",
      lines: withdrawal.lines.map((line) => ({ lineId: line.id, withdrawnQuantity: String(line.quantity) })),
    },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const saved = await withdrawalsApi.complete(withdrawal.id, {
        customerSignerName: values.customerSignerName.trim(),
        lines: values.lines.map((line) => ({ lineId: line.lineId, withdrawnQuantity: Number(line.withdrawnQuantity) })),
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && onConflict) {
        onConflict(err.message);
        onClose();
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo registrar el retiro");
    }
  }

  return (
    <Modal
      title={`Registrar el retiro de ${withdrawal.number}`}
      eyebrow="PF-FOR-068"
      description={`${withdrawal.clientName}. Firmas como Almacén; la solicitud queda retirada y ya no se edita.`}
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="withdrawal-complete-form" isLoading={isSubmitting}>
            Registrar retiro
          </Button>
        </>
      }
    >
      <form id="withdrawal-complete-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Entregó por el cliente"
          required
          placeholder="Nombre de quien firma por el cliente"
          error={errors.customerSignerName?.message}
          {...register("customerSignerName")}
        />

        <FormSection title="Cantidad recogida" hint="Viene la solicitada; corrígela si se recogió otra cantidad.">
          <div className="flex flex-col gap-2">
            {withdrawal.lines.map((line, index) => (
              <div key={line.id} className="grid grid-cols-[1fr_auto_140px] items-start gap-3 rounded-edge border border-line px-3 py-2">
                <span className="min-w-0 pt-6">
                  <span className="block truncate text-[13px] text-ink" title={line.productName}>
                    {line.productName}
                  </span>
                  <span className="font-mono text-[11px] text-faint">{line.productCode}</span>
                </span>
                <span className="whitespace-nowrap pt-6 text-[12.5px] tabular-nums text-brand-gray">
                  Solicitado {formatQuantity(line.quantity)} {line.quantityUnit}
                </span>
                <TextField
                  label="Recogido"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  error={errors.lines?.[index]?.withdrawnQuantity?.message}
                  {...register(`lines.${index}.withdrawnQuantity`)}
                />
              </div>
            ))}
          </div>
        </FormSection>
      </form>
    </Modal>
  );
}
