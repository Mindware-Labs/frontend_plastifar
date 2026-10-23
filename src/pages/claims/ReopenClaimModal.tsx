import { claimsApi } from "../../api/claims";
import { ReasonModal } from "../../components/app/ReasonModal";
import type { ClaimDetail, CustomerClaim } from "../../types/claims";

interface ReopenClaimModalProps {
  claim: CustomerClaim;
  onClose: () => void;
  onSaved: (detail: ClaimDetail) => void;
}

/** RF-R6: reapertura con motivo. El motivo queda en la bitácora (regla 11). */
export function ReopenClaimModal({ claim, onClose, onSaved }: ReopenClaimModalProps) {
  return (
    <ReasonModal
      title={`Reabrir reclamación de ${claim.ticketNumber}`}
      description="Vuelve a «En tratamiento» y se puede corregir. El sello de cierre anterior se conserva en la bitácora."
      field={{
        label: "Motivo",
        placeholder: "El cliente volvió a reportar el faltante tras la reposición",
        min: 15,
        minMessage: "Explica por qué se reabre: al menos 15 caracteres",
        max: 1000,
      }}
      submitLabel="Reabrir"
      fallbackError="No se pudo reabrir la reclamación"
      onSubmit={async (reason) => onSaved(await claimsApi.reopen(claim.id, reason ?? ""))}
      onClose={onClose}
    />
  );
}
