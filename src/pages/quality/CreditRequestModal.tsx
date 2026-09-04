import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { qualityApi } from "../../api/quality";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import {
  SelectField,
  TextAreaField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { Client } from "../../types/clients";
import { CURRENCIES, type CreditRequest } from "../../types/quality";

// Espejo de la validacion del servidor de POST /api/quality/credit-requests.
const schema = z.object({
  clientId: z.string().min(1, "Elige el cliente"),
  amount: z
    .string()
    .min(1, "Indica el monto")
    .refine((value) => Number(value) > 0, "El monto tiene que ser mayor que cero")
    .refine((value) => Number(value) <= 10_000_000, "Monto fuera de rango"),
  currency: z.string().min(1, "Elige la moneda"),
  invoiceRef: z.string().trim().max(40, "Máximo 40 caracteres"),
  reason: z
    .string()
    .trim()
    .min(20, "Explica por qué procede el crédito: al menos 20 caracteres")
    .max(1000, "Máximo 1000 caracteres"),
});

type FormValues = z.infer<typeof schema>;

interface CreditRequestModalProps {
  clients: Client[];
  onClose: () => void;
  onSaved: (request: CreditRequest) => void;
}

/** RF-Q7: alta de solicitud con monto, motivo y referencia de factura. Nace de
 *  un ticket cuando exista la Bandeja; hasta entonces, alta manual. */
export function CreditRequestModal({ clients, onClose, onSaved }: CreditRequestModalProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      clientId: "",
      amount: "",
      currency: "DOP",
      invoiceRef: "",
      reason: "",
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const invoiceRef = values.invoiceRef.trim();

    try {
      const saved = await qualityApi.creditRequests.create({
        clientId: Number(values.clientId),
        amount: Number(values.amount),
        currency: values.currency,
        reason: values.reason.trim(),
        invoiceRef: invoiceRef === "" ? null : invoiceRef,
        ticketId: null,
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo crear la solicitud");
    }
  }

  return (
    <Modal
      title="Nueva solicitud de crédito"
      description="Autoriza una nota de crédito al cliente cuando la reclamación procede."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="credit-form" isLoading={isSubmitting}>
            Crear solicitud
          </Button>
        </>
      }
    >
      <form id="credit-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <Controller
          name="clientId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Cliente"
              required
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="Elige uno"
              options={clients.map((client) => ({ value: String(client.id), label: client.name }))}
              state={stateOf("clientId")}
              error={errors.clientId?.message}
            />
          )}
        />

        <div className="grid grid-cols-[1fr_140px] gap-3">
          <TextField
            label="Monto"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0.00"
            state={stateOf("amount")}
            error={errors.amount?.message}
            {...register("amount")}
          />

          <Controller
            name="currency"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Moneda"
                required
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={CURRENCIES.map((currency) => ({ value: currency, label: currency }))}
                state={stateOf("currency")}
                error={errors.currency?.message}
              />
            )}
          />
        </div>

        <TextField
          label="Referencia de factura"
          placeholder="Opcional. Ej. B0100004471"
          state={stateOf("invoiceRef")}
          error={errors.invoiceRef?.message}
          {...register("invoiceRef")}
        />

        <TextAreaField
          label="Motivo"
          required
          rows={4}
          placeholder="Qué se le acredita al cliente y por qué procede"
          error={errors.reason?.message}
          {...register("reason")}
        />

        <Alert variant="info">
          No podrás aprobar esta solicitud tú mismo: quien pide y quien aprueba deben ser personas
          distintas.
        </Alert>
      </form>
    </Modal>
  );
}
