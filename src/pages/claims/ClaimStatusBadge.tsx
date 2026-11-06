import { Check, CircleDashed } from "lucide-react";
import { StatusBadge, type StatusStyles } from "../../components/ui/StatusBadge";
import type { ClaimStatus } from "../../types/claims";

const styles: StatusStyles<"Registrada" | "Cerrada"> = {
  Registrada: { tone: "neutral", icon: CircleDashed },
  Cerrada: { tone: "green", icon: Check },
};

/** El ciclo solo expone Registrada o Cerrada; «En tratamiento» quedó obsoleto en UI. */
export function normalizeClaimStatus(status: ClaimStatus): "Registrada" | "Cerrada" {
  return status === "Cerrada" ? "Cerrada" : "Registrada";
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <StatusBadge status={normalizeClaimStatus(status)} styles={styles} />;
}
