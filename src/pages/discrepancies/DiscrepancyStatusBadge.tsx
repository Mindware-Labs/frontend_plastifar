import { Check, CheckCircle2, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { IconBadge, StatusBadge, type StatusStyles } from "../../components/ui/StatusBadge";
import type { DiscrepancyStatus } from "../../types/discrepancies";

/** Normaliza la presentación del estado inicial: "En investigación" se muestra como "Registrada" ya que el formulario está completo. */
export function normalizeDiscrepancyStatus(status: DiscrepancyStatus | string): string {
  if (status === "En investigación") return "Registrada";
  return status;
}

const styles: StatusStyles<string> = {
  Registrada: { tone: "neutral", icon: CheckCircle2 },
  "En investigación": { tone: "neutral", icon: CheckCircle2 },
  Completada: { tone: "warn", icon: ShieldCheck },
  Aprobada: { tone: "green", icon: Check },
  Devuelta: { tone: "red", icon: RotateCcw },
};

export function DiscrepancyStatusBadge({ status }: { status: DiscrepancyStatus | string }) {
  const displayStatus = normalizeDiscrepancyStatus(status);
  return <StatusBadge status={displayStatus} styles={styles} />;
}

/** El hallazgo no es un estado, pero es lo primero que hay que ver (sección 15). */
export function SecurityFindingBadge() {
  return (
    <IconBadge tone="red" icon={ShieldAlert}>
      Hallazgo de seguridad
    </IconBadge>
  );
}
