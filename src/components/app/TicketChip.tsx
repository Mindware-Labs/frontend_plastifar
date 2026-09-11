import { ArrowUpRight, Check, Ticket, TicketPlus } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { formatTicketCode } from "../../lib/format";

/**
 * El ticket de una conversación, en una sola pieza: invita a crearlo cuando no
 * existe y lleva hasta él cuando ya está. Papel y filete neutros; el rojo 185 C
 * vive solo en el sello, que se enciende al pasar el ratón.
 */

/** thread: la conversación nació en Tickets. manual: alguien lo creó desde este correo. */
export type TicketProvenance = "thread" | "manual";

interface TicketChipProps {
  ticketId: number | null;
  provenance?: TicketProvenance;
  /** Detalle del origen para el título, cuando el pie de una línea no basta. */
  note?: string | null;
  /** Compacto para filas de lista: solo sello y código, sin acción propia. */
  size?: "md" | "xs";
  /** Acaba de crearse: el sello confirma durante unos segundos y luego pide asentarse. */
  justCreated?: boolean;
  /** Se llama al terminar la confirmación: el padre apaga justCreated. */
  onSettled?: () => void;
  /** El formulario de creación está abierto: el chip queda pulsado. */
  active?: boolean;
  /** Creación en curso: el sello gira. */
  busy?: boolean;
  onCreate?: () => void;
  className?: string;
}

const SETTLE_MS = 2400;

const eyebrowByProvenance: Record<TicketProvenance, string> = {
  thread: "Hilo de ticket",
  manual: "Desde este correo",
};

const rootClass =
  "group/chip relative inline-flex shrink-0 select-none items-center rounded-lg border outline-none " +
  "transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out " +
  "focus-visible:ring-2 focus-visible:ring-brand-red/25 focus-visible:border-brand-red/40 " +
  "motion-reduce:transition-none";

const restingClass =
  "border-zinc-200 bg-white text-zinc-700 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900";

const pressedClass = "border-zinc-300 bg-zinc-100 text-zinc-900 shadow-none";

const createdClass = "border-brand-green/40 bg-brand-green/[0.06] text-zinc-900 shadow-2xs";

/** Cuadradito con el glifo: pálido en reposo, rojo pleno al pasar, verde al confirmar. */
function Seal({ tone, children }: { tone: "rest" | "created"; children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className={`flex size-5 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ease-out motion-reduce:transition-none ${
        tone === "created"
          ? "animate-plf-seal-pop bg-brand-green text-white"
          : "bg-brand-red/10 text-brand-red group-hover/chip:bg-brand-red group-hover/chip:text-white group-active/chip:bg-brand-red-dark"
      }`}
    >
      {children}
    </span>
  );
}

export function TicketChip({
  ticketId,
  provenance = "manual",
  note,
  size = "md",
  justCreated = false,
  onSettled,
  active = false,
  busy = false,
  onCreate,
  className = "",
}: TicketChipProps) {
  const confirming = justCreated;

  // onSettled suele ser una flecha nueva en cada render: por ref, para que el temporizador no se reinicie.
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    if (!justCreated) return;
    const timer = window.setTimeout(() => onSettledRef.current?.(), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [justCreated]);

  // Fila de lista: un punto rojo y el código, sin acción propia porque la fila ya es el enlace.
  if (size === "xs") {
    if (!ticketId) return null;
    return (
      <span
        title={`Ticket ${formatTicketCode(ticketId)}`}
        className={`inline-flex h-4 shrink-0 items-center gap-1 rounded-[5px] border border-zinc-200 bg-white pl-1 pr-1.5 font-heading text-[9.5px] font-bold tabular-nums tracking-[0.02em] text-zinc-700 ${className}`}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-brand-red" />
        {formatTicketCode(ticketId)}
      </span>
    );
  }

  if (!ticketId) {
    return (
      <button
        type="button"
        onClick={onCreate}
        disabled={busy}
        aria-busy={busy || undefined}
        data-active={active}
        className={`${rootClass} h-7 cursor-pointer gap-2 pl-1 pr-2.5 active:scale-[0.98] motion-reduce:active:scale-100 disabled:cursor-progress ${
          active ? pressedClass : restingClass
        } ${className}`}
      >
        <Seal tone="rest">
          {busy ? (
            <span className="size-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
          ) : (
            <TicketPlus className="size-3" strokeWidth={2.25} />
          )}
        </Seal>
        <span className="text-[12px] font-medium leading-none">{busy ? "Creando…" : "Crear ticket"}</span>
      </button>
    );
  }

  const code = formatTicketCode(ticketId);
  const eyebrow = confirming ? "Ticket creado" : eyebrowByProvenance[provenance];
  const title =
    note ?? (provenance === "thread" ? `Ver el ticket ${code}` : `Ticket ${code}, creado a partir de este correo`);

  return (
    <Link
      to={`/tickets/${ticketId}`}
      title={title}
      aria-label={`${eyebrow}: ver el ticket ${code}`}
      data-confirming={confirming}
      className={`${rootClass} h-7 gap-2 pl-1 pr-2 active:scale-[0.98] motion-reduce:active:scale-100 ${
        confirming ? createdClass : restingClass
      } ${className}`}
    >
      <Seal tone={confirming ? "created" : "rest"}>
        {confirming ? <Check className="size-3" strokeWidth={3} /> : <Ticket className="size-3" strokeWidth={2.25} />}
      </Seal>

      <span className="flex flex-col justify-center gap-[3px]">
        <span
          className={`font-heading text-[8.5px] font-bold uppercase leading-none tracking-[0.08em] transition-colors duration-300 ${
            confirming ? "text-brand-green" : "text-zinc-400 group-hover/chip:text-zinc-500"
          }`}
        >
          {eyebrow}
        </span>
        <span className="font-heading text-[11px] font-bold leading-none tabular-nums tracking-[0.01em] text-zinc-900">
          {code}
        </span>
      </span>

      <ArrowUpRight
        aria-hidden
        className="ml-0.5 size-3 shrink-0 text-zinc-400 opacity-0 -translate-x-0.5 translate-y-0.5 transition-[opacity,transform] duration-280 ease-plf-spring group-hover/chip:translate-x-0 group-hover/chip:translate-y-0 group-hover/chip:opacity-100 group-focus-visible/chip:opacity-100 motion-reduce:transition-none"
      />
    </Link>
  );
}
