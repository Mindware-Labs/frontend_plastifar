import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { claimsApi } from "../../api/claims";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { SelectField, TextAreaField } from "../../components/ui/Field";
import { FormSection } from "../../components/ui/FormSection";
import { Modal } from "../../components/ui/Modal";
import type { ClaimDetail, CustomerClaim } from "../../types/claims";

// Espejo de ClaimRules.ValidateTreatment: aquí solo largos. Qué hace falta para
// cerrar lo dice el servidor en la ficha, no este diálogo.
const schema = z.object({
  firstResponseCorrection: z.string().trim().max(4000, "Máximo 4000 caracteres"),
  requiresCorrectiveAction: z.string(),
  rootCauseAnalysis: z.string().trim().max(4000, "Máximo 4000 caracteres"),
  correctiveActions: z.string().trim().max(4000, "Máximo 4000 caracteres"),
  customerSatisfied: z.string(),
  observations: z.string().trim().max(4000, "Máximo 4000 caracteres"),
});

type FormValues = z.infer<typeof schema>;

const YES_NO = [
  { value: "", label: "Sin responder" },
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
];

const fromBool = (value: boolean | null) => (value === null ? "" : value ? "si" : "no");
const toBool = (value: string) => (value === "" ? null : value === "si");

interface ClaimTreatmentModalProps {
  claim: CustomerClaim;
  onClose: () => void;
  onSaved: (detail: ClaimDetail) => void;
}

/** RF-R5: la sección IV, «Para uso exclusivo del Depto. de Calidad». */
export function ClaimTreatmentModal({ claim, onClose, onSaved }: ClaimTreatmentModalProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      firstResponseCorrection: claim.firstResponseCorrection ?? "",
      requiresCorrectiveAction: fromBool(claim.requiresCorrectiveAction),
      rootCauseAnalysis: claim.rootCauseAnalysis ?? "",
      correctiveActions: claim.correctiveActions ?? "",
      customerSatisfied: fromBool(claim.customerSatisfied),
      observations: claim.observations ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const blank = (value: string) => (value.trim() === "" ? null : value.trim());
    try {
      const saved = await claimsApi.updateTreatment(claim.id, {
        firstResponseCorrection: blank(values.firstResponseCorrection),
        requiresCorrectiveAction: toBool(values.requiresCorrectiveAction),
        rootCauseAnalysis: blank(values.rootCauseAnalysis),
        correctiveActions: blank(values.correctiveActions),
        customerSatisfied: toBool(values.customerSatisfied),
        observations: blank(values.observations),
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar el tratamiento");
    }
  }

  return (
    <Modal
      title={`Tratamiento de ${claim.ticketNumber}`}
      description={
        claim.status === "Registrada"
          ? "Sección IV, uso exclusivo de Calidad. Al guardar por primera vez, la reclamación pasa a «En tratamiento»."
          : "Sección IV, uso exclusivo de Calidad. Para cerrar hacen falta la primera respuesta, la decisión sobre la acción correctiva y la satisfacción del cliente."
      }
      onClose={onClose}
      size="xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="claim-treatment-form" isLoading={isSubmitting}>
            Guardar tratamiento
          </Button>
        </>
      }
    >
      <form id="claim-treatment-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {formError && <Alert variant="error">{formError}</Alert>}

        <FormSection title="Respuesta">
          <TextAreaField
            label="Primera respuesta como corrección"
            rows={3}
            placeholder="Qué se hizo de inmediato: reposición, nota de crédito, recogida…"
            error={errors.firstResponseCorrection?.message}
            {...register("firstResponseCorrection")}
          />
          <Controller
            name="requiresCorrectiveAction"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Se requiere acción correctiva"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={YES_NO}
                hint="Con «Sí», la reclamación no se cierra hasta que exista una HCA ligada al ticket."
              />
            )}
          />
        </FormSection>

        <FormSection title="Análisis" hint="Resumen aquí; el detalle vive en la HCA (pregunta 5).">
          <TextAreaField
            label="Resultados del análisis de causa raíz"
            rows={3}
            error={errors.rootCauseAnalysis?.message}
            {...register("rootCauseAnalysis")}
          />
          <TextAreaField
            label="Acciones correctivas y/o preventivas tomadas"
            rows={3}
            error={errors.correctiveActions?.message}
            {...register("correctiveActions")}
          />
        </FormSection>

        <FormSection title="Cierre">
          <Controller
            name="customerSatisfied"
            control={control}
            render={({ field }) => (
              <SelectField
                label="¿Cliente satisfecho?"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={YES_NO}
              />
            )}
          />
          <TextAreaField
            label="Observaciones"
            rows={2}
            placeholder="Opcional"
            error={errors.observations?.message}
            {...register("observations")}
          />
        </FormSection>
      </form>
    </Modal>
  );
}
