import {
  Check,
  CircleDot,
  Search,
  ShieldCheck,
  Slash,
} from "lucide-react";
import { StatusBadge, type StatusStyles } from "../../components/ui/StatusBadge";
import type { HcaStatus, PlanItemStatus } from "../../types/quality";

const hcaStyles: StatusStyles<HcaStatus> = {
  Abierta: { tone: "green", icon: Check },
  "En análisis": { tone: "neutral", icon: Search },
  "En ejecución": { tone: "neutral", icon: CircleDot },
  "En verificación": { tone: "neutral", icon: ShieldCheck },
  Cerrada: { tone: "green", icon: Check },
};

const planStyles: StatusStyles<PlanItemStatus> = {
  Pendiente: { tone: "neutral", icon: CircleDot },
  "En curso": { tone: "neutral", icon: CircleDot },
  Cumplida: { tone: "green", icon: Check },
  Anulada: { tone: "neutral", icon: Slash },
};

export function HcaStatusBadge({ status }: { status: HcaStatus; overdue?: boolean }) {
  const displayStatus = status === "Abierta" ? "Registrada" : status;
  return (
    <StatusBadge
      status={displayStatus as any}
      styles={{
        ...hcaStyles,
        Registrada: { tone: "green", icon: Check },
      }}
    />
  );
}

export function PlanItemStatusBadge({ status }: { status: PlanItemStatus; overdue?: boolean }) {
  return <StatusBadge status={status} styles={planStyles} />;
}
