import { Check, CircleDashed, Stethoscope } from "lucide-react";
import { StatusBadge, type StatusStyles } from "../../components/ui/StatusBadge";
import type { ClaimStatus } from "../../types/claims";

const styles: StatusStyles<ClaimStatus> = {
  Registrada: { tone: "neutral", icon: CircleDashed },
  "En tratamiento": { tone: "warn", icon: Stethoscope },
  Cerrada: { tone: "green", icon: Check },
};

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <StatusBadge status={status} styles={styles} />;
}
