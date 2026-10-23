import { Check, CircleDashed, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { IconBadge, StatusBadge, type StatusStyles } from "../../components/ui/StatusBadge";
import type { DiscrepancyStatus } from "../../types/discrepancies";

const styles: StatusStyles<DiscrepancyStatus> = {
  "En investigación": { tone: "neutral", icon: CircleDashed },
  Completada: { tone: "warn", icon: ShieldCheck },
  Aprobada: { tone: "green", icon: Check },
  Devuelta: { tone: "red", icon: RotateCcw },
};

export function DiscrepancyStatusBadge({ status }: { status: DiscrepancyStatus }) {
  return <StatusBadge status={status} styles={styles} />;
}

/** El hallazgo no es un estado, pero es lo primero que hay que ver (sección 15). */
export function SecurityFindingBadge() {
  return (
    <IconBadge tone="red" icon={ShieldAlert}>
      Hallazgo de seguridad
    </IconBadge>
  );
}
