import {
  ArrowRight,
  Clock,
  HelpCircle,
  Inbox,
  Mail,
  PenLine,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { Logo } from "../../components/Logo";
import { Button as PfButton } from "../../components/ui/Button";
import { formatDisplayName } from "../../lib/format";
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

  const name = formatDisplayName(firstName, lastName, email);
  return { greeting, name: name || "Equipo" };
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
        <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white p-2.5 shadow-2xs">
          <Logo variant="isotipo" height={30} />
        </div>

        {/* Saludo dinámico y subtítulo */}
        <h3 className="font-heading text-[20px] font-bold tracking-[-0.02em] text-zinc-900">
          {greeting}, <span className="text-brand-red">{name}</span>
        </h3>
        <p className="mt-1 text-[12.5px] text-zinc-500">
          {isInbox
            ? "Centro de Operaciones y Mensajería · Plastifar"
            : folder === "sent"
            ? "Registro de correos salientes y respuestas enviadas"
            : folder === "archived"
            ? "Historial de conversaciones resueltas y archivadas"
            : folder === "trash"
            ? "Papelera de reciclaje y retención de historial"
            : folder === "starred"
            ? "Conversaciones marcadas con estrella para acceso rápido"
            : "Bandeja de correo"}
        </p>

        {/* Tarjetas operativas de estado (solo en bandeja de entrada) */}
        {isInbox && counts && (
          <div className="mt-6 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-3">
            {/* 1. Sin responder */}
            <button
              type="button"
              onClick={() => onSelectTicketFilter("sin-responder")}
              className={`group flex flex-col rounded-xl border p-3.5 text-left transition-all
                hover:-translate-y-0.5 hover:shadow-xs
                ${
                  activeTicketFilter === "sin-responder"
                    ? "border-brand-red/40 bg-red-50/40 shadow-xs ring-1 ring-brand-red/30"
                    : "border-zinc-200/80 bg-white hover:border-brand-red/30 shadow-2xs"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-heading font-semibold uppercase tracking-[0.08em] text-brand-red">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-red animate-pulse" />
                  Prioritario
                </span>
                <Clock className="h-3.5 w-3.5 text-brand-red/60 transition-transform group-hover:scale-110" />
              </div>
              <p className="mt-2 font-heading text-[22px] font-bold tabular-nums leading-none text-zinc-900 group-hover:text-brand-red">
                {unansweredCount}
              </p>
              <p className="mt-1 text-[11.5px] font-semibold text-zinc-800">Sin responder</p>
              <p className="text-[10.5px] text-zinc-400">Esperando respuesta</p>
            </button>

            {/* 2. Sin clasificar / Sin ticket */}
            <button
              type="button"
              onClick={() => onSelectTicketFilter("sin-ticket")}
              className={`group flex flex-col rounded-xl border p-3.5 text-left transition-all
                hover:-translate-y-0.5 hover:shadow-xs
                ${
                  activeTicketFilter === "sin-ticket"
                    ? "border-amber-300 bg-amber-50/40 shadow-xs ring-1 ring-amber-300"
                    : "border-zinc-200/80 bg-white hover:border-amber-300 shadow-2xs"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-heading font-semibold uppercase tracking-[0.08em] text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Por clasificar
                </span>
                <HelpCircle className="h-3.5 w-3.5 text-amber-600/60 transition-transform group-hover:scale-110" />
              </div>
              <p className="mt-2 font-heading text-[22px] font-bold tabular-nums leading-none text-zinc-900 group-hover:text-amber-700">
                {unlinkedCount}
              </p>
              <p className="mt-1 text-[11.5px] font-semibold text-zinc-800">Sin ticket</p>
              <p className="text-[10.5px] text-zinc-400">Pendientes de caso</p>
            </button>

            {/* 3. Todas las conversaciones */}
            <button
              type="button"
              onClick={() => onSelectTicketFilter("todos")}
              className={`group flex flex-col rounded-xl border p-3.5 text-left transition-all
                hover:-translate-y-0.5 hover:shadow-xs
                ${
                  activeTicketFilter === "todos"
                    ? "border-zinc-300 bg-zinc-100/70 shadow-xs ring-1 ring-zinc-300"
                    : "border-zinc-200/80 bg-white hover:border-zinc-300 shadow-2xs"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-heading font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                  Total bandeja
                </span>
                <Mail className="h-3.5 w-3.5 text-zinc-400 transition-transform group-hover:scale-110" />
              </div>
              <p className="mt-2 font-heading text-[22px] font-bold tabular-nums leading-none text-zinc-900">
                {totalCount}
              </p>
              <p className="mt-1 text-[11.5px] font-semibold text-zinc-800">Conversaciones</p>
              <p className="text-[10.5px] text-zinc-400">
                {linkedCount > 0 ? `${linkedCount} con ticket PLT` : "Todo el historial"}
              </p>
            </button>
          </div>
        )}

        {/* Estado en otras carpetas que no sean bandeja */}
        {!isInbox && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white px-4 py-3 shadow-2xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
              <Inbox className="h-4.5 w-4.5 text-zinc-400" />
            </div>
            <div className="text-left">
              <p className="font-heading text-[12.5px] font-bold text-zinc-900">
                {totalCount} {totalCount === 1 ? "conversación" : "conversaciones"} en total
              </p>
              <p className="text-[11.5px] text-zinc-400">
                Selecciona cualquier elemento de la lista lateral para ver su contenido completo.
              </p>
            </div>
          </div>
        )}

        {/* Botones de acción principal */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <PfButton size="sm" className="h-8 px-4 gap-1.5 text-[12.5px] font-semibold shadow-2xs active:scale-[0.98]" onClick={onCompose}>
            <PenLine className="h-4 w-4" />
            Escribir un correo
          </PfButton>

          {isInbox && unansweredCount > 0 && activeTicketFilter !== "sin-responder" && (
            <button
              type="button"
              onClick={() => onSelectTicketFilter("sin-responder")}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200
                bg-white px-3 text-[12px] font-semibold text-zinc-700 shadow-2xs
                transition-all hover:border-brand-red/30
                hover:bg-red-50/50 hover:text-brand-red focus-visible:ring-2
                focus-visible:ring-brand-red/20 outline-none active:scale-[0.98]"
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
