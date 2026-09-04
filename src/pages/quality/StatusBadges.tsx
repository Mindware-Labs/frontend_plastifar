import {
  AlertTriangle,
  Check,
  CheckCheck,
  CircleDashed,
  CircleDot,
  Hourglass,
  Search,
  ShieldCheck,
  Slash,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import type { CreditStatus, HcaStatus, PlanItemStatus } from "../../types/quality";

type Tone = "neutral" | "red" | "green" | "warn";

/** Icono siempre junto a la etiqueta: ningun estado se distingue solo por color. */
function withIcon(Icon: LucideIcon, label: string) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon aria-hidden className="h-3 w-3" />
      {label}
    </span>
  );
}

const hcaTones: Record<HcaStatus, { tone: Tone; icon: LucideIcon }> = {
  Abierta: { tone: "neutral", icon: CircleDashed },
  "En análisis": { tone: "neutral", icon: Search },
  "En ejecución": { tone: "neutral", icon: CircleDot },
  "En verificación": { tone: "neutral", icon: ShieldCheck },
  Cerrada: { tone: "green", icon: Check },
};

/** El vencimiento no es un estado de la hoja, pero es lo primero que hay que
 *  ver: cuando aplica, sustituye a la pastilla de estado y la deja al lado. */
export function HcaStatusBadge({ status, overdue }: { status: HcaStatus; overdue?: boolean }) {
  const { tone, icon } = hcaTones[status];

  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge tone="red">{withIcon(AlertTriangle, "Vencida")}</Badge>
        <span className="whitespace-nowrap text-[11.5px] text-faint">{status}</span>
      </span>
    );
  }

  return <Badge tone={tone}>{withIcon(icon, status)}</Badge>;
}

const planTones: Record<PlanItemStatus, { tone: Tone; icon: LucideIcon }> = {
  Pendiente: { tone: "neutral", icon: CircleDashed },
  "En curso": { tone: "neutral", icon: CircleDot },
  Cumplida: { tone: "green", icon: Check },
  Anulada: { tone: "neutral", icon: Slash },
};

export function PlanItemStatusBadge({
  status,
  overdue,
}: {
  status: PlanItemStatus;
  overdue?: boolean;
}) {
  if (overdue) {
    return <Badge tone="red">{withIcon(AlertTriangle, "Vencida")}</Badge>;
  }

  const { tone, icon } = planTones[status];
  return <Badge tone={tone}>{withIcon(icon, status)}</Badge>;
}

const creditTones: Record<CreditStatus, { tone: Tone; icon: LucideIcon }> = {
  Solicitada: { tone: "warn", icon: Hourglass },
  Aprobada: { tone: "green", icon: Check },
  Rechazada: { tone: "red", icon: X },
  Aplicada: { tone: "neutral", icon: CheckCheck },
};

export function CreditStatusBadge({ status }: { status: CreditStatus }) {
  const { tone, icon } = creditTones[status];
  return <Badge tone={tone}>{withIcon(icon, status)}</Badge>;
}
