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
    <span className={`text-[12px] font-medium ${norm === "baja" ? "text-zinc-400" : "text-zinc-600"}`}>
      {priority}
    </span>
  );
}

/** Los estados vivos llevan punto de color; los terminales, un icono gris. */
const liveStatusDot: Record<string, string> = {
  abierto: "bg-emerald-500",
  "en espera del cliente": "bg-amber-500",
  "en espera": "bg-amber-500",
  "reenvio de producto": "bg-blue-500",
};

const shortStatus: Record<string, string> = {
  "en espera del cliente": "En espera",
  "reenvio de producto": "Reenvío",
};

export function StatusCell({ status }: { status: string }) {
  const norm = normalize(status);

  if (norm === "solucionado" || norm === "solucionada") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-emerald-700">
        <Check aria-hidden className="h-3 w-3 text-emerald-600" strokeWidth={2.5} />
        Solucionado
      </span>
    );
  }
  if (norm === "cancelado" || norm === "cerrado") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-zinc-400">
        <Slash aria-hidden className="h-3 w-3 text-zinc-300" />
        {norm === "cerrado" ? "Cerrado" : "Cancelado"}
      </span>
    );
  }

  return (
    <span title={status} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-zinc-800">
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${liveStatusDot[norm] ?? "bg-zinc-300"}`} />
      {shortStatus[norm] ?? status}
    </span>
  );
}

/** Vencido y por vencer van con pastilla; el resto en texto tabular limpio. */
export function SlaCell({ sla }: { sla: Sla }) {
  switch (sla.tone) {
    case "overdue":
      return <Badge tone="red">{sla.text}</Badge>;
    case "warning":
      return <Badge tone="amber">{sla.text}</Badge>;
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-emerald-700">
          <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} />
          {sla.text}
        </span>
      );
    case "paused":
      if (sla.text === "Cancelado") {
        return <span title="Sin SLA: el ticket se canceló" className="text-[12px] text-zinc-400">—</span>;
      }
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] text-zinc-500">
          <Pause aria-hidden className="h-3 w-3" />
          {sla.text}
        </span>
      );
    default:
      if (sla.text === "Sin SLA") {
        return <span title="Sin compromiso de resolución" className="text-[12px] text-zinc-400">—</span>;
      }
      return <span className="whitespace-nowrap text-[12px] tabular-nums font-medium text-zinc-600">{sla.text}</span>;
  }
}

export function AssigneeCell({ id, name }: { id: number | null; name: string | null }) {
  if (!name || id === null) {
    return <span className="text-[11.5px] text-zinc-400 italic">Sin asignar</span>;
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={name}>
      <Avatar name={name} seed={id} size={18} />
      <span className="truncate text-[12px] font-medium text-zinc-800">{name}</span>
    </span>
  );
}
