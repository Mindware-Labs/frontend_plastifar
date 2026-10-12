import { Check, CircleDashed, Stethoscope, type LucideIcon } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import type { ClaimStatus } from "../../types/claims";

type Tone = "neutral" | "green" | "warn";

const tones: Record<ClaimStatus, { tone: Tone; icon: LucideIcon }> = {
  Registrada: { tone: "neutral", icon: CircleDashed },
  "En tratamiento": { tone: "warn", icon: Stethoscope },
  Cerrada: { tone: "green", icon: Check },
};

/** Icono siempre junto a la etiqueta: ningún estado se distingue solo por color. */
export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
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
