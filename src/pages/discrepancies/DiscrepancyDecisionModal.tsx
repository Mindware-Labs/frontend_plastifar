import { discrepanciesApi } from "../../api/discrepancies";
import { ReasonModal } from "../../components/app/ReasonModal";
import { Alert } from "../../components/ui/Alert";
import type { DiscrepancyDetail, LoadDiscrepancy } from "../../types/discrepancies";

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
  const approving = decision === "aprobar";

  return (
    <ReasonModal
      title={`${approving ? "Aprobar" : "Devolver"} ${discrepancy.number}`}
      description={
        approving
          ? `Firmas como «Aprobado por». Realizada por ${discrepancy.performedByName ?? "—"}. Una investigación aprobada ya no se edita.`
          : "Vuelve a quien la realizó con tu nota; la reabre y corrige."
      }
      field={
        approving
          ? { label: "Nota (opcional)", placeholder: "Observación para el expediente", max: 500 }
          : {
              label: "Motivo de la devolución",
              placeholder: "Qué falta o qué está mal",
              min: 10,
              minMessage: "Explica por qué se devuelve: al menos 10 caracteres",
              max: 500,
            }
      }
      submitLabel={approving ? "Aprobar" : "Devolver"}
      submitVariant={approving ? "primary" : "danger"}
      fallbackError={approving ? "No se pudo aprobar" : "No se pudo devolver"}
      onSubmit={async (note) => onSaved(await discrepanciesApi.decide(discrepancy.id, approving, note))}
      onClose={onClose}
    >
      {discrepancy.hasSecurityFinding && (
        <Alert variant="info">
          Esta investigación tiene un hallazgo de seguridad. Confirma que el punto 9 refleja la notificación formal.
        </Alert>
      )}
    </ReasonModal>
  );
}
