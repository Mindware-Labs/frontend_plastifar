import { Ban, Check, CircleDashed, PackageCheck, X, type LucideIcon } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import type { WithdrawalStatus } from "../../types/withdrawals";

type Tone = "neutral" | "green" | "warn" | "red";

const tones: Record<WithdrawalStatus, { tone: Tone; icon: LucideIcon }> = {
  Solicitado: { tone: "neutral", icon: CircleDashed },
  Aprobado: { tone: "warn", icon: Check },
  Rechazado: { tone: "red", icon: X },
  Retirado: { tone: "green", icon: PackageCheck },
  Cancelado: { tone: "neutral", icon: Ban },
};

/** Icono siempre junto a la etiqueta: ningún estado se distingue solo por color. */
export function WithdrawalStatusBadge({ status }: { status: WithdrawalStatus }) {
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
