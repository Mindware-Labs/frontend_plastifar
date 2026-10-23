import { withdrawalsApi } from "../../api/withdrawals";
import { ReasonModal } from "../../components/app/ReasonModal";
import type { MerchandiseWithdrawal, WithdrawalDetail } from "../../types/withdrawals";

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
  return (
    <ReasonModal
      title={`Cancelar ${withdrawal.number}`}
      description="La cancelación es final. La solicitud no se borra: queda visible como cancelada, con tu motivo."
      // Espejo de WithdrawalRules.ValidateCancel (sección 13).
      field={{
        label: "Motivo de la cancelación",
        placeholder: "Por qué ya no procede el retiro",
        min: 10,
        minMessage: "Explica por qué se cancela: al menos 10 caracteres",
        max: 500,
      }}
      submitLabel="Cancelar solicitud"
      submitVariant="danger"
      cancelLabel="Volver"
      fallbackError="No se pudo cancelar la solicitud"
      onSubmit={async (reason) => onSaved(await withdrawalsApi.cancel(withdrawal.id, reason ?? ""))}
      onClose={onClose}
      onConflict={onConflict}
    />
  );
}
