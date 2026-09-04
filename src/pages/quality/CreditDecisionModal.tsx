import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextAreaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { formatAmount } from "../../lib/quality";
import type { CreditRequest } from "../../types/quality";

interface CreditDecisionModalProps {
  request: CreditRequest;
  decision: "aprobar" | "rechazar";
  requesterName: string;
  clientName: string;
  /** Quien decide: queda sellado, y nunca puede ser el solicitante. */
  decidedByStaffId: number | null;
  onClose: () => void;
  onSave: (request: CreditRequest) => void;
}

/** RF-Q8: aprobacion y rechazo con nota. El motivo del rechazo es obligatorio;
 *  el de la aprobacion no, porque aprobar sin objeciones es una respuesta
 *  completa y forzar texto solo produce «ok». */
export function CreditDecisionModal({
  request,
  decision,
  requesterName,
  clientName,
  decidedByStaffId,
  onClose,
  onSave,
}: CreditDecisionModalProps) {
  const isReject = decision === "rechazar";

  const schema = z.object({
    decisionNote: isReject
      ? z
          .string()
          .trim()
          .min(15, "Explica el rechazo: al menos 15 caracteres")
          .max(1000, "Máximo 1000 caracteres")
      : z.string().trim().max(1000, "Máximo 1000 caracteres"),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { decisionNote: "" },
  });

  function onSubmit(values: z.infer<typeof schema>) {
    const note = values.decisionNote.trim();
    onSave({
      ...request,
      status: isReject ? "Rechazada" : "Aprobada",
      decidedByStaffId,
      decidedAt: new Date().toISOString(),
      decisionNote: note === "" ? null : note,
    });
    onClose();
  }

  return (
    <Modal
      title={isReject ? `Rechazar ${request.number}` : `Aprobar ${request.number}`}
      description={
        isReject
          ? "La solicitud queda rechazada con su motivo. Para cambiar el monto se rechaza y se crea otra."
          : "Una vez aprobada, el monto ya no se modifica: para cambiarlo hay que rechazarla y crear otra."
      }
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="credit-decision-form"
            variant={isReject ? "danger" : "primary"}
            isLoading={isSubmitting}
          >
            {isReject ? "Rechazar solicitud" : "Aprobar solicitud"}
          </Button>
        </>
      }
    >
      <form
        id="credit-decision-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <dl className="flex flex-col gap-2 rounded-edge bg-canvas px-3 py-2.5 text-[13px] text-brand-gray">
          <Line label="Cliente" value={clientName} />
          <Line label="Monto" value={formatAmount(request.amount, request.currency)} />
          <Line label="Solicitada por" value={requesterName} />
          <Line label="Factura" value={request.invoiceRef ?? "Sin referencia"} />
        </dl>

        <p className="max-w-[76ch] whitespace-pre-line text-[13px] leading-relaxed text-brand-gray">
          {request.reason}
        </p>

        <TextAreaField
          label={isReject ? "Motivo del rechazo" : "Nota de aprobación"}
          required={isReject}
          rows={3}
          placeholder={
            isReject
              ? "Por qué no procede, con el dato que lo sustenta"
              : "Opcional: qué sustenta la aprobación"
          }
          error={errors.decisionNote?.message}
          {...register("decisionNote")}
        />

        <Alert variant="info">
          Al decidir se notifica por correo al solicitante y al responsable de la hoja.
        </Alert>
      </form>
    </Modal>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
        {label}
      </dt>
      <dd className="text-right text-[12.5px] font-medium text-ink">{value}</dd>
    </div>
  );
}
