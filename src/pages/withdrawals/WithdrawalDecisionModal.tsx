import { withdrawalsApi } from "../../api/withdrawals";
import { ReasonModal } from "../../components/app/ReasonModal";
import { Alert } from "../../components/ui/Alert";
import type { MerchandiseWithdrawal, WithdrawalDetail } from "../../types/withdrawals";

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
  const approving = decision === "aprobar";

  return (
    <ReasonModal
      title={`${approving ? "Aprobar" : "Rechazar"} ${withdrawal.number}`}
      description={
        approving
          ? `Solicitada por ${withdrawal.requestedByName}. Una vez aprobada, Almacén puede registrar el retiro.`
          : "El rechazo es final; quien solicitó recibe tu nota por correo."
      }
      field={
        approving
          ? { label: "Nota (opcional)", placeholder: "Observación para el expediente", max: 500 }
          : {
              label: "Motivo del rechazo",
              placeholder: "Por qué no procede el retiro",
              min: 10,
              minMessage: "Explica por qué se rechaza: al menos 10 caracteres",
              max: 500,
            }
      }
      submitLabel={approving ? "Aprobar" : "Rechazar"}
      submitVariant={approving ? "primary" : "danger"}
      fallbackError={approving ? "No se pudo aprobar" : "No se pudo rechazar"}
      onSubmit={async (note) => onSaved(await withdrawalsApi.decide(withdrawal.id, approving, note))}
      onClose={onClose}
      onConflict={onConflict}
    >
      {withdrawal.errorOrigin && (
        <Alert variant="info">
          Origen del error: {withdrawal.errorOrigin}. Esta aprobación corresponde a{" "}
          {withdrawal.approvalArea === "ALMACEN" ? "Almacén" : "Ventas Locales"}.
        </Alert>
      )}
    </ReasonModal>
  );
}
