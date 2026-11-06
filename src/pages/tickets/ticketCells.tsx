import { Check, Lock, Pause, Slash } from "lucide-react";
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
      <Badge tone="green" className="gap-1.5 px-2 py-0.5 font-heading text-[11px] font-semibold text-emerald-800 shadow-2xs">
        <Check aria-hidden className="size-3 text-emerald-600" strokeWidth={2.5} />
        Solucionado
      </Badge>
    );
  }
  if (norm === "cancelado" || norm === "cerrado") {
    return (
      <Badge tone="neutral" className="gap-1.5 px-2 py-0.5 font-heading text-[11px] font-medium text-zinc-600 shadow-2xs">
        {norm === "cerrado" ? (
          <Lock aria-hidden className="size-3 text-zinc-400" strokeWidth={2} />
        ) : (
          <Slash aria-hidden className="size-3 text-zinc-400" strokeWidth={2} />
        )}
        {norm === "cerrado" ? "Cerrado" : "Cancelado"}
      </Badge>
    );
  }

  return (
    <span title={status} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-zinc-800">
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${liveStatusDot[norm] ?? "bg-zinc-300"}`} />
      {shortStatus[norm] ?? status}
    </span>
  );
}

const priorityTone: Record<string, string> = {
  emergencia: "text-red-700",
  alta: "text-amber-800",
  baja: "text-zinc-500",
};

function statusLabel(norm: string, status: string) {
  if (norm === "solucionado" || norm === "solucionada") return "Solucionado";
  if (norm === "cerrado") return "Cerrado";
  if (norm === "cancelado") return "Cancelado";
  return shortStatus[norm] ?? status;
}

function statusTone(norm: string) {
  if (norm === "solucionado" || norm === "solucionada") return "text-emerald-800";
  if (norm === "cerrado" || norm === "cancelado") return "text-zinc-500";
  return "text-zinc-800";
}

/**
 * Prioridad y estado de la ficha, en la misma caja de 20px.
 * El estado siempre reserva el mismo hueco para el punto o el icono, así
 * «Abierto» y «Solucionado» comparten línea, tamaño y eje.
 */
export function CardPriorityStatus({ priority, status }: { priority: string; status: string }) {
  const priorityNorm = normalize(priority);
  const statusNorm = normalize(status);

  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-2 whitespace-nowrap">
      <span
        className={`inline-flex h-5 items-center text-[12px] leading-none ${
          priorityNorm === "emergencia" || priorityNorm === "alta" ? "font-semibold" : "font-medium"
        } ${priorityTone[priorityNorm] ?? "text-zinc-600"}`}
      >
        {priority}
      </span>
      <span aria-hidden className="h-3 w-px shrink-0 bg-line" />
      <span
        title={status}
        className={`inline-flex h-5 items-center gap-1.5 text-[12px] font-medium leading-none ${statusTone(statusNorm)}`}
      >
        <span className="flex size-3.5 shrink-0 items-center justify-center">
          <StatusMark status={statusNorm} />
        </span>
        {statusLabel(statusNorm, status)}
      </span>
    </span>
  );
}

function StatusMark({ status }: { status: string }) {
  if (status === "solucionado" || status === "solucionada") {
    return <Check aria-hidden className="size-3 text-emerald-600" strokeWidth={2.5} />;
  }
  if (status === "cerrado") {
    return <Lock aria-hidden className="size-3 text-zinc-400" strokeWidth={2} />;
  }
  if (status === "cancelado") {
    return <Slash aria-hidden className="size-3 text-zinc-400" strokeWidth={2} />;
  }
  return <span aria-hidden className={`size-2 rounded-full ${liveStatusDot[status] ?? "bg-zinc-300"}`} />;
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
        <Badge tone="completed" className="gap-1.5 px-2 py-0.5 font-heading text-[11px] font-semibold text-emerald-800 shadow-2xs">
          <Check aria-hidden className="size-3 text-emerald-600" strokeWidth={2.5} />
          {sla.text}
        </Badge>
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
      <span className="truncate whitespace-nowrap text-[12px] font-medium text-zinc-800">{name}</span>
    </span>
  );
}
