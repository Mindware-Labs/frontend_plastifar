import {
  AlertTriangle,
  Check,
  Circle,
  CircleDot,
  Hammer,
  Search,
  ShieldCheck,
  Slash,
} from "lucide-react";
import { IconBadge, type StatusStyle, type StatusStyles } from "../../components/ui/StatusBadge";
import type { HcaStatus, PlanItemStatus } from "../../types/quality";

/**
 * Tonos de una HCA por tramo del ciclo: registrada es base (neutral), los tres
 * pasos de trabajo son ambar —cada uno con su icono para distinguirlos sin
 * leer el color— y verde queda solo para la hoja cerrada.
 */
const hcaStyles: StatusStyles<HcaStatus> = {
  Abierta: { tone: "neutral", icon: Circle },
  "En análisis": { tone: "warn", icon: Search },
  "En ejecución": { tone: "warn", icon: Hammer },
  "En verificación": { tone: "warn", icon: ShieldCheck },
  Cerrada: { tone: "green", icon: Check },
};

/** Pendiente es base; en curso ya es trabajo en marcha y se pinta ambar. */
const planStyles: StatusStyles<PlanItemStatus> = {
  Pendiente: { tone: "neutral", icon: Circle },
  "En curso": { tone: "warn", icon: CircleDot },
  Cumplida: { tone: "green", icon: Check },
  Anulada: { tone: "neutral", icon: Slash },
};

/** Vencida no es un estado del dato: se superpone al estado mientras siga abierto. */
const overdueStyle: StatusStyle = { tone: "warn", icon: AlertTriangle };

/** «Abierta» se guarda así, pero en pantalla la hoja recién creada se lee «Registrada». */
function hcaLabel(status: HcaStatus): string {
  return status === "Abierta" ? "Registrada" : status;
}

function OverdueAwareBadge({
  style,
  label,
  overdue,
}: {
  style: StatusStyle;
  label: string;
  overdue: boolean;
}) {
  if (!overdue) return <IconBadge {...style}>{label}</IconBadge>;
  return (
    <IconBadge {...overdueStyle} title={`${label} · vencida`}>
      {label}
      <span className="sr-only"> (vencida)</span>
    </IconBadge>
  );
}

/** `overdue` lo decide quien llama (fecha comprometida pasada); una hoja cerrada nunca se pinta vencida. */
export function HcaStatusBadge({ status, overdue = false }: { status: HcaStatus; overdue?: boolean }) {
  return (
    <OverdueAwareBadge
      style={hcaStyles[status]}
      label={hcaLabel(status)}
      overdue={overdue && status !== "Cerrada"}
    />
  );
}

/** Una acción cumplida o anulada ya no vence, aunque su fecha haya pasado. */
export function PlanItemStatusBadge({ status, overdue = false }: { status: PlanItemStatus; overdue?: boolean }) {
  const settled = status === "Cumplida" || status === "Anulada";
  return (
    <OverdueAwareBadge style={planStyles[status]} label={status} overdue={overdue && !settled} />
  );
}
