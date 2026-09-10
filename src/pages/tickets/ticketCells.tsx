import { Check, Pause, Slash } from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import type { formatSlaRemaining } from "../../lib/format";

type Sla = ReturnType<typeof formatSlaRemaining>;

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Solo lo que mete prisa lleva pastilla: Normal y Baja van en texto para que el ojo caiga en lo urgente. */
export function PriorityCell({ priority }: { priority: string }) {
  const norm = normalize(priority);
  if (norm === "emergencia") return <Badge tone="red">Emergencia</Badge>;
  if (norm === "alta") return <Badge tone="amber">Alta</Badge>;
  return (
    <span className={`text-[12.5px] ${norm === "baja" ? "text-faint" : "text-brand-gray"}`}>
      {priority}
    </span>
  );
}

/** Los estados vivos llevan punto de color; los terminales, un icono gris: lo cerrado no compite. */
const liveStatusDot: Record<string, string> = {
  abierto: "bg-brand-green",
  "en espera del cliente": "bg-warn",
  "en espera": "bg-warn",
  "reenvio de producto": "bg-brand-bio",
};

const shortStatus: Record<string, string> = {
  "en espera del cliente": "En espera",
  "reenvio de producto": "Reenvío",
};

export function StatusCell({ status }: { status: string }) {
  const norm = normalize(status);

  if (norm === "solucionado" || norm === "solucionada") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-subtle">
        <Check aria-hidden className="h-3.5 w-3.5 text-brand-green" strokeWidth={2.5} />
        Solucionado
      </span>
    );
  }
  if (norm === "cancelado" || norm === "cerrado") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-subtle">
        <Slash aria-hidden className="h-3.5 w-3.5 text-faint" />
        {norm === "cerrado" ? "Cerrado" : "Cancelado"}
      </span>
    );
  }

  return (
    <span title={status} className="inline-flex items-center gap-[7px] whitespace-nowrap text-[12.5px] text-ink">
      <span aria-hidden className={`h-[7px] w-[7px] shrink-0 rounded-full ${liveStatusDot[norm] ?? "bg-zinc-300"}`} />
      {shortStatus[norm] ?? status}
    </span>
  );
}

/** Vencido y por vencer son lo unico que grita en la fila; el resto informa en texto. */
export function SlaCell({ sla }: { sla: Sla }) {
  switch (sla.tone) {
    case "overdue":
      return <Badge tone="red">{sla.text}</Badge>;
    case "warning":
      return <Badge tone="amber">{sla.text}</Badge>;
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-brand-green">
          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
          {sla.text}
        </span>
      );
    case "paused":
      if (sla.text === "Cancelado") {
        return <span title="Sin SLA: el ticket se canceló" className="text-[12.5px] text-faint">—</span>;
      }
      return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-subtle">
          <Pause aria-hidden className="h-3.5 w-3.5" />
          {sla.text}
        </span>
      );
    default:
      if (sla.text === "Sin SLA") {
        return <span title="Sin compromiso de resolución" className="text-[12.5px] text-faint">—</span>;
      }
      return <span className="whitespace-nowrap text-[12.5px] tabular-nums text-brand-gray">{sla.text}</span>;
  }
}

export function AssigneeCell({ id, name }: { id: number | null; name: string | null }) {
  if (!name || id === null) {
    return <span className="text-[12.5px] text-faint">Sin asignar</span>;
  }
  return (
    <span className="flex min-w-0 items-center gap-2" title={name}>
      <Avatar name={name} seed={id} size={22} />
      <span className="truncate text-[12.5px] text-ink">{name}</span>
    </span>
  );
}
