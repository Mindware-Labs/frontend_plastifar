import { qualityApi } from "../../api/quality";
import { ReasonModal } from "../../components/app/ReasonModal";
import { Alert } from "../../components/ui/Alert";
import { formatAmount } from "../../lib/numbers";
import type { CreditRequest } from "../../types/quality";

interface CreditDecisionModalProps {
  request: CreditRequest;
  decision: "aprobar" | "rechazar";
  requesterName: string;
  clientName: string;
  onClose: () => void;
  onSaved: (request: CreditRequest) => void;
}

/** RF-Q8: aprobacion y rechazo con nota. El motivo del rechazo es obligatorio;
 *  el de la aprobacion no, porque aprobar sin objeciones es una respuesta
 *  completa y forzar texto solo produce «ok». */
export function CreditDecisionModal({
  request,
  decision,
  requesterName,
  clientName,
  onClose,
  onSaved,
}: CreditDecisionModalProps) {
  const isReject = decision === "rechazar";

  async function decide(note: string | null) {
    const saved = isReject
      ? await qualityApi.creditRequests.reject(request.id, note)
      : await qualityApi.creditRequests.approve(request.id, note);
    onSaved(saved);
  }

  return (
    <ReasonModal
      title={`${isReject ? "Rechazar" : "Aprobar"} ${request.number}`}
      description={
        isReject
          ? "La solicitud queda rechazada con su motivo. Para cambiar el monto se rechaza y se crea otra."
          : "Una vez aprobada, el monto ya no se modifica: para cambiarlo hay que rechazarla y crear otra."
      }
      field={
        isReject
          ? {
              label: "Motivo del rechazo",
              placeholder: "Por qué no procede, con el dato que lo sustenta",
              min: 15,
              minMessage: "Explica el rechazo: al menos 15 caracteres",
              max: 1000,
            }
          : { label: "Nota de aprobación", placeholder: "Opcional: qué sustenta la aprobación", max: 1000 }
      }
      submitLabel={isReject ? "Rechazar solicitud" : "Aprobar solicitud"}
      submitVariant={isReject ? "danger" : "primary"}
      fallbackError={isReject ? "No se pudo rechazar la solicitud" : "No se pudo aprobar la solicitud"}
      onSubmit={decide}
      onClose={onClose}
      afterField={
        <Alert variant="info">Al decidir se notifica por correo al solicitante y al responsable de la hoja.</Alert>
      }
    >
      {/* Sin caja teñida: una sección se marca con un filete, no con un fondo. */}
      <dl className="flex flex-col gap-2 border-y border-line-soft py-2.5 text-[13px] text-brand-gray">
        <Line label="Cliente" value={clientName} />
        <Line label="Monto" value={formatAmount(request.amount, request.currency)} />
        <Line label="Solicitada por" value={requesterName} />
        <Line label="Factura" value={request.invoiceRef ?? "Sin referencia"} />
      </dl>

      <p className="max-w-[76ch] whitespace-pre-line text-[13px] leading-relaxed text-brand-gray">{request.reason}</p>
    </ReasonModal>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">{label}</dt>
      <dd className="text-right text-[12.5px] font-medium text-ink">{value}</dd>
    </div>
  );
}
