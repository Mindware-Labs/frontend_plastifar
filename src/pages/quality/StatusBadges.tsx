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
} from "lucide-react";
import { IconBadge, StatusBadge, type StatusStyles } from "../../components/ui/StatusBadge";
import type { CreditStatus, HcaStatus, PlanItemStatus } from "../../types/quality";

const hcaStyles: StatusStyles<HcaStatus> = {
  Abierta: { tone: "neutral", icon: CircleDashed },
  "En análisis": { tone: "neutral", icon: Search },
  "En ejecución": { tone: "neutral", icon: CircleDot },
  "En verificación": { tone: "neutral", icon: ShieldCheck },
  Cerrada: { tone: "green", icon: Check },
};

const planStyles: StatusStyles<PlanItemStatus> = {
  Pendiente: { tone: "neutral", icon: CircleDashed },
  "En curso": { tone: "neutral", icon: CircleDot },
  Cumplida: { tone: "green", icon: Check },
  Anulada: { tone: "neutral", icon: Slash },
};

const creditStyles: StatusStyles<CreditStatus> = {
  Solicitada: { tone: "warn", icon: Hourglass },
  Aprobada: { tone: "green", icon: Check },
  Rechazada: { tone: "red", icon: X },
  Aplicada: { tone: "neutral", icon: CheckCheck },
};

function OverdueBadge() {
  return (
    <IconBadge tone="red" icon={AlertTriangle}>
      Vencida
    </IconBadge>
  );
}

/** El vencimiento no es un estado de la HCA, pero es lo primero que hay que
 *  ver: cuando aplica, sustituye a la pastilla de estado y la deja al lado. */
export function HcaStatusBadge({ status, overdue }: { status: HcaStatus; overdue?: boolean }) {
  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <OverdueBadge />
        <span className="whitespace-nowrap text-[11.5px] text-faint">{status}</span>
      </span>
    );
  }

  return <StatusBadge status={status} styles={hcaStyles} />;
}

export function PlanItemStatusBadge({ status, overdue }: { status: PlanItemStatus; overdue?: boolean }) {
  return overdue ? <OverdueBadge /> : <StatusBadge status={status} styles={planStyles} />;
}

export function CreditStatusBadge({ status }: { status: CreditStatus }) {
  return <StatusBadge status={status} styles={creditStyles} />;
}
