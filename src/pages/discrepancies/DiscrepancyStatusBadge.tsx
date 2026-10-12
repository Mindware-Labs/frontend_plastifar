import { Check, CircleDashed, RotateCcw, ShieldAlert, ShieldCheck, type LucideIcon } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import type { DiscrepancyStatus } from "../../types/discrepancies";

type Tone = "neutral" | "green" | "warn" | "red";

const tones: Record<DiscrepancyStatus, { tone: Tone; icon: LucideIcon }> = {
  "En investigación": { tone: "neutral", icon: CircleDashed },
  Completada: { tone: "warn", icon: ShieldCheck },
  Aprobada: { tone: "green", icon: Check },
  Devuelta: { tone: "red", icon: RotateCcw },
};

/** Icono siempre junto a la etiqueta: ningún estado se distingue solo por color. */
export function DiscrepancyStatusBadge({ status }: { status: DiscrepancyStatus }) {
  const { tone, icon: Icon } = tones[status];
  return (
    <Badge tone={tone}>
      <span className="inline-flex items-center gap-1.5">
        <Icon aria-hidden className="h-3 w-3" />
        {status}
      </span>
    </Badge>
  );
}

/** El hallazgo no es un estado, pero es lo primero que hay que ver (sección 15). */
export function SecurityFindingBadge() {
  return (
    <Badge tone="red">
      <span className="inline-flex items-center gap-1.5">
        <ShieldAlert aria-hidden className="h-3 w-3" />
        Hallazgo de seguridad
      </span>
    </Badge>
  );
}
