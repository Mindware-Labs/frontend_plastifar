import { Check, CheckCircle2, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { chipToneOf, IconBadge, StatusBadge, type StatusStyles } from "../../components/ui/StatusBadge";
import { normalizeDiscrepancyStatus } from "../../lib/discrepancies";
import type { DiscrepancyStatus } from "../../types/discrepancies";

// Vive en lib para que la hoja imprimible lo use sin importar una pagina.
export { normalizeDiscrepancyStatus };


const styles: StatusStyles<string> = {
  Registrada: { tone: "neutral", icon: CheckCircle2 },
  "En investigación": { tone: "neutral", icon: CheckCircle2 },
  Completada: { tone: "warn", icon: ShieldCheck },
  Aprobada: { tone: "green", icon: Check },
  Devuelta: { tone: "red", icon: RotateCcw },
};

/** Tono del filtro de cabecera de un estado, del mismo mapa que la pastilla. */
export function discrepancyStatusChipTone(status: DiscrepancyStatus | string) {
  return chipToneOf(styles, normalizeDiscrepancyStatus(status));
}

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
