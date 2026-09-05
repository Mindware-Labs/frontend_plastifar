import {
  ArrowRight,
  Clock,
  Inbox,
  Mail,
  PenLine,
  Tag,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { Logo } from "../../components/Logo";
import { Button as PfButton } from "../../components/ui/Button";
import type { EmailFolderCounts } from "../../types/api";
import type { FolderKey } from "./BandejaPage";

interface InboxTriageEmptyStateProps {
  folder: FolderKey;
  counts?: { all: number; unlinked: number; linked: number; unanswered: number };
  folderCounts?: EmailFolderCounts;
  onCompose: () => void;
  onSelectTicketFilter: (filter: "todos" | "sin-ticket" | "sin-responder") => void;
  activeTicketFilter: string;
}

function getGreeting(
  firstName?: string,
  lastName?: string,
  email?: string,
): { greeting: string; name: string } {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  const primerNombre = firstName?.trim().split(/\s+/)[0];
  const primerApellido = lastName?.trim().split(/\s+/)[0];

  if (primerNombre && primerApellido) {
    return { greeting, name: `${primerNombre} ${primerApellido}` };
  }
  if (primerNombre) {
    return { greeting, name: primerNombre };
  }
  if (email) {
    const raw = email.split("@")[0] ?? "";
    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    return { greeting, name };
  }
  return { greeting, name: "Equipo" };
}

export function InboxTriageEmptyState({
  folder,
  counts,
  folderCounts,
  onCompose,
  onSelectTicketFilter,
  activeTicketFilter,
}: InboxTriageEmptyStateProps) {
  const { user } = useAuth();
  const { greeting, name } = getGreeting(user?.firstName, user?.lastName, user?.email);

  const isInbox = folder === "inbox";
  const unansweredCount = counts?.unanswered ?? 0;
  const unlinkedCount = counts?.unlinked ?? 0;
  const totalCount = counts?.all ?? folderCounts?.[folder]?.total ?? 0;
  const linkedCount = counts?.linked ?? 0;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-y-auto overflow-x-hidden p-6">
      {/* Fondo con aros geométricos decorativos (eco sutil del isotipo Plastifar) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-red/[0.04]" />
        <div className="absolute left-1/2 top-1/2 h-[740px] w-[740px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-green/[0.04]" />
        <div className="absolute left-1/2 top-1/3 h-[240px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-red/[0.025] blur-[80px]" />
      </div>

      {/* Contenido principal centrado */}
      <div className="relative z-10 flex w-full max-w-[580px] flex-col items-center text-center">
        {/* Isotipo Plastifar con halo suave */}
        <div className="mb-3.5 flex h-13 w-13 items-center justify-center rounded-2xl border border-line-soft bg-white p-2.5 shadow-[0_8px_20px_-6px_rgba(228,0,43,0.14),0_2px_6px_rgba(27,27,29,0.04)]">
          <Logo variant="isotipo" height={32} />
        </div>

        {/* Saludo dinámico y subtítulo */}
        <h3 className="font-heading text-[21px] font-bold tracking-[-0.02em] text-ink">
          {greeting}, <span className="text-brand-red">{name}</span>
        </h3>
        <p className="mt-1 text-[12.5px] text-subtle">
          {isInbox
            ? "Centro de Operaciones y Mensajería · Plastifar"
            : folder === "sent"
            ? "Registro de correos salientes y respuestas enviadas"
            : folder === "archived"
            ? "Historial de conversaciones resueltas y archivadas"
            : folder === "trash"
            ? "Papelera de reciclaje y retención de historial"
            : "Carpeta de correo no deseado"}
        </p>

        {/* Tarjetas operativas de estado (solo en bandeja de entrada) */}
        {isInbox && counts && (
          <div className="mt-6 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-3">
            {/* 1. Sin responder */}
            <button
              type="button"
              onClick={() => onSelectTicketFilter("sin-responder")}
              className={`group flex flex-col rounded-edge border p-3 text-left transition-all
                hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-4px_rgba(228,0,43,0.12)]
                ${
                  activeTicketFilter === "sin-responder"
                    ? "border-brand-red/40 bg-brand-red/[0.04] shadow-xs ring-1 ring-brand-red/30"
                    : "border-line bg-white hover:border-brand-red/30"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-heading font-semibold uppercase tracking-[0.08em] text-brand-red">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-red animate-pulse" />
                  Prioritario
                </span>
                <Clock className="h-3.5 w-3.5 text-brand-red/60 transition-transform group-hover:scale-110" />
              </div>
              <p className="mt-2 font-heading text-[22px] font-bold tabular-nums leading-none text-ink group-hover:text-brand-red">
                {unansweredCount}
              </p>
              <p className="mt-1 text-[11.5px] font-medium text-ink">Sin responder</p>
              <p className="text-[10.5px] text-faint">Esperando respuesta</p>
            </button>

            {/* 2. Sin clasificar / Sin ticket */}
            <button
              type="button"
              onClick={() => onSelectTicketFilter("sin-ticket")}
              className={`group flex flex-col rounded-edge border p-3 text-left transition-all
                hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-4px_rgba(194,118,10,0.12)]
                ${
                  activeTicketFilter === "sin-ticket"
                    ? "border-warn/40 bg-warn/[0.04] shadow-xs ring-1 ring-warn/30"
                    : "border-line bg-white hover:border-warn/30"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-heading font-semibold uppercase tracking-[0.08em] text-warn">
                  <span className="h-1.5 w-1.5 rounded-full bg-warn" />
                  Por clasificar
                </span>
                <Tag className="h-3.5 w-3.5 text-warn/60 transition-transform group-hover:scale-110" />
              </div>
              <p className="mt-2 font-heading text-[22px] font-bold tabular-nums leading-none text-ink group-hover:text-warn">
                {unlinkedCount}
              </p>
              <p className="mt-1 text-[11.5px] font-medium text-ink">Sin ticket</p>
              <p className="text-[10.5px] text-faint">Pendientes de caso</p>
            </button>

            {/* 3. Todas las conversaciones */}
            <button
              type="button"
              onClick={() => onSelectTicketFilter("todos")}
              className={`group flex flex-col rounded-edge border p-3 text-left transition-all
                hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-4px_rgba(27,27,29,0.08)]
                ${
                  activeTicketFilter === "todos"
                    ? "border-line-strong bg-canvas shadow-xs ring-1 ring-line-strong"
                    : "border-line bg-white hover:border-line-strong"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-heading font-semibold uppercase tracking-[0.08em] text-subtle">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-gray" />
                  Total bandeja
                </span>
                <Mail className="h-3.5 w-3.5 text-faint transition-transform group-hover:scale-110" />
              </div>
              <p className="mt-2 font-heading text-[22px] font-bold tabular-nums leading-none text-ink">
                {totalCount}
              </p>
              <p className="mt-1 text-[11.5px] font-medium text-ink">Conversaciones</p>
              <p className="text-[10.5px] text-faint">
                {linkedCount > 0 ? `${linkedCount} con ticket PLT` : "Todo el historial"}
              </p>
            </button>
          </div>
        )}

        {/* Estado en otras carpetas que no sean bandeja */}
        {!isInbox && (
          <div className="mt-5 flex items-center gap-3 rounded-edge border border-line bg-white px-4 py-3 shadow-xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-brand-gray">
              <Inbox className="h-4.5 w-4.5 text-faint" />
            </div>
            <div className="text-left">
              <p className="font-heading text-[12.5px] font-bold text-ink">
                {totalCount} {totalCount === 1 ? "conversación" : "conversaciones"} en total
              </p>
              <p className="text-[11.5px] text-faint">
                Selecciona cualquier elemento de la lista lateral para ver su contenido completo.
              </p>
            </div>
          </div>
        )}

        {/* Botones de acción principal */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <PfButton size="md" className="h-9 px-5 shadow-sm" onClick={onCompose}>
            <PenLine className="h-4 w-4" />
            Escribir un correo
          </PfButton>

          {isInbox && unansweredCount > 0 && activeTicketFilter !== "sin-responder" && (
            <button
              type="button"
              onClick={() => onSelectTicketFilter("sin-responder")}
              className="inline-flex h-9 items-center gap-1.5 rounded-edge border border-line-strong
                bg-white px-3.5 font-heading text-[11.5px] font-semibold text-brand-gray
                transition-[background-color,border-color,color] hover:border-brand-red/35
                hover:bg-canvas hover:text-brand-red-dark focus-visible:ring-3
                focus-visible:ring-brand-red/20 outline-none"
            >
              <span>Ver pendientes urgentes ({unansweredCount})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
