import {
  Bell,
  BellOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { emailsApi, type EmailQuery } from "../../api/emails";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { NotificationsModal } from "../../components/app/NotificationsModal";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../components/shadcn/resizable";
import { ScrollArea } from "../../components/shadcn/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/shadcn/tooltip";
import { useAuth } from "../../context/useAuth";
import { useEmailCounts } from "../../context/useEmailCounts";
import { useReceipts } from "../../context/useReceipts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useNotifyPrefs } from "../../hooks/useNotifyPrefs";
import { usePagedList } from "../../hooks/usePagedList";
import type { EmailBulkAction, EmailListResponse, EmailSummaryResponse } from "../../types/api";
import { ConversationRow } from "./ConversationRow";
import { EmailDetailPane } from "./EmailDetailPane";
import { NewEmailComposer } from "./NewEmailComposer";
import { FilterButton, FilterChips } from "./SearchFilters";
import { EMPTY_FILTERS, countActive, toQueryParams, type AdvancedFilters } from "./filterCriteria";
import { SelectionBar } from "./SelectionBar";
import { InboxTriageEmptyState } from "./InboxTriageEmptyState";

export type FolderKey = "inbox" | "archived" | "starred" | "trash" | "sent";
type TicketFilter = "todos" | "sin-ticket" | "sin-responder" | "mios";

const folderMeta: Record<FolderKey, { title: string; emptyText: string }> = {
  inbox: { title: "Bandeja", emptyText: "Todavía no llegó ningún correo." },
  starred: { title: "Destacados", emptyText: "No tienes correos destacados. Marca cualquier correo con la estrella para encontrarlo aquí." },
  archived: { title: "Archivados", emptyText: "No hay correos archivados." },
  trash: { title: "Papelera", emptyText: "La papelera está vacía." },
  sent: { title: "Enviados", emptyText: "Todavía no enviaste ningún correo." },
};

const primaryFilters: {
  key: TicketFilter;
  label: string;
  countKey: keyof EmailListResponse["counts"];
}[] = [
  { key: "todos", label: "Todos", countKey: "all" },
  { key: "sin-responder", label: "Sin responder", countKey: "unanswered" },
];

const secondaryFilters: {
  key: TicketFilter;
  label: string;
  countKey: keyof EmailListResponse["counts"];
}[] = [
  { key: "sin-ticket", label: "Sin ticket", countKey: "unlinked" },
  { key: "mios", label: "Míos", countKey: "mine" },
];

const STATUS_MENU_WIDTH = 200;

interface EmailFilterMenuProps {
  options: typeof secondaryFilters;
  activeKey: TicketFilter;
  counts?: EmailListResponse["counts"];
  assignedUnseen?: number;
  onSelect: (key: TicketFilter) => void;
  className?: string;
}

function EmailFilterMenu({
  options,
  activeKey,
  counts,
  assignedUnseen,
  onSelect,
  className = "",
}: EmailFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function handleViewportChange() {
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ top: rect.bottom + 6, left: Math.max(8, rect.right - STATUS_MENU_WIDTH) });
    setOpen(true);
  }

  const active = options.find((option) => option.key === activeKey);
  const activeCount = active && counts ? counts[active.countKey] : 0;
  const hasUnseen = Boolean(assignedUnseen && assignedUnseen > 0);

  return (
    <div className={`relative min-w-0 w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={active ? `Más filtros (activo: ${active.label})` : "Más filtros"}
        title={active ? `Filtro activo: ${active.label}` : "Más filtros"}
        className={`inline-flex h-8 w-full min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[12px] shadow-2xs transition-all outline-none select-none cursor-pointer active:scale-[0.98] ${
          active
            ? "border border-zinc-300 bg-zinc-100 font-semibold text-zinc-900"
            : "border border-zinc-200 bg-white font-medium text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
        }`}
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          <span className="truncate">{active ? active.label : "Más"}</span>
          {active ? (
            <span className="rounded-full bg-zinc-200 px-1.5 py-0.2 text-[10px] font-bold text-zinc-800 tabular-nums">
              {activeCount}
            </span>
          ) : (
            hasUnseen && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" title="Tienes correos asignados sin ver" />
            )
          )}
        </span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform duration-150 ${open ? "rotate-180 text-zinc-700" : ""}`}
        />
      </button>

      {open &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label="Más filtros de correo"
            style={{ position: "fixed", top: anchor.top, left: anchor.left, width: STATUS_MENU_WIDTH }}
            className="animate-plf-popover-in z-[60] flex flex-col gap-0.5 rounded-lg border border-zinc-200/90
              bg-white p-1 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)]"
          >
            <div className="select-none px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-400">
              Vistas secundarias
            </div>
            {options.map(({ key, label, countKey }) => {
              const isActive = key === activeKey;
              const count = counts?.[countKey] ?? 0;
              const showDot = key === "mios" && hasUnseen;
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onSelect(key);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left
                    text-[12.5px] transition-colors cursor-pointer ${
                      isActive
                        ? "bg-zinc-100 font-semibold text-zinc-900"
                        : "font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                    }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {showDot && (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-red shadow-[0_0_6px_rgba(228,0,43,0.5)]" />
                    )}
                    <span>{label}</span>
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10.5px] font-bold tabular-nums ${
                      isActive ? "bg-zinc-200 text-zinc-800" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Cada pagina se pide al servidor: entra lo que se ve, no la bandeja entera. */
const PAGE_SIZE = 15;

function conversations(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? `conversación ${singular}` : `conversaciones ${plural}`}`;
}

interface BulkMeta {
  /** Clave de fusion de los recibos: dos archivados seguidos se cuentan juntos. */
  receipt: string;
  done: (count: number) => string;
  failed: string;
  undo?: { action: EmailBulkAction; label: string };
  /** La conversacion abierta deja de pertenecer a la carpeta: se cierra el panel. */
  closesOpen: boolean;
}

const BULK: Record<EmailBulkAction, BulkMeta> = {
  archive: {
    receipt: "archivar",
    done: (n) => conversations(n, "archivada", "archivadas"),
    failed: "No se pudo archivar",
    undo: { action: "restore", label: "Devolver a la bandeja" },
    closesOpen: true,
  },
  star: {
    receipt: "destacar",
    done: (n) => conversations(n, "destacada", "destacadas"),
    failed: "No se pudo destacar",
    undo: { action: "unstar", label: "Quitar de destacados" },
    closesOpen: false,
  },
  unstar: {
    receipt: "quitar-destacado",
    done: (n) => conversations(n, "quitada de destacados", "quitadas de destacados"),
    failed: "No se pudo quitar de destacados",
    undo: { action: "star", label: "Destacar" },
    closesOpen: false,
  },
  trash: {
    receipt: "papelera",
    done: (n) => conversations(n, "movida a la papelera", "movidas a la papelera"),
    failed: "No se pudo mover a la papelera",
    undo: { action: "restore", label: "Devolver a la bandeja" },
    closesOpen: true,
  },
  restore: {
    receipt: "restaurar",
    done: (n) => conversations(n, "devuelta a la bandeja", "devueltas a la bandeja"),
    failed: "No se pudo restaurar",
    closesOpen: true,
  },
  read: {
    receipt: "leer",
    done: (n) => conversations(n, "marcada como leída", "marcadas como leídas"),
    failed: "No se pudo marcar como leído",
    undo: { action: "unread", label: "Marcar no leídas" },
    closesOpen: false,
  },
  unread: {
    receipt: "no-leer",
    done: (n) => conversations(n, "marcada como no leída", "marcadas como no leídas"),
    failed: "No se pudo marcar como no leído",
    undo: { action: "read", label: "Marcar leídas" },
    closesOpen: false,
  },
  delete: {
    receipt: "eliminar",
    done: (n) => conversations(n, "eliminada definitivamente", "eliminadas definitivamente"),
    failed: "No se pudo eliminar",
    closesOpen: true,
  },
};

interface BandejaPageProps {
  folder: FolderKey;
}

export function BandejaPage({ folder }: BandejaPageProps) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>("todos");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);
  const [editingAlerts, setEditingAlerts] = useState(false);
  const lastToggled = useRef<number | null>(null);
  const [params, setParams] = useSearchParams();
  const { counts, refresh: refreshCounts, onInboxChanged } = useEmailCounts();
  const receipts = useReceipts();
  // Eliminar definitivamente y vaciar la papelera son de administradores.
  const isAdmin = Boolean(useAuth().user?.isAdmin);
  const prefs = useNotifyPrefs();
  const debouncedSearch = useDebouncedValue(search).trim();
  const meta = folderMeta[folder];
  const selectable = folder !== "sent";

  const { data, isStale, error, page, setPage, refresh } = usePagedList<EmailQuery, EmailListResponse>(
    {
      fetch: emailsApi.list,
      criteria: {
        pageSize: PAGE_SIZE,
        folder,
        filter: ticketFilter,
        search: debouncedSearch || undefined,
        ...toQueryParams(filters),
      },
      fallbackError: "No se pudo cargar la bandeja",
    },
  );

  // El aviso llega en cualquier momento: se guarda la recarga vigente para no resuscribirse.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => onInboxChanged(() => refreshRef.current()), [onInboxChanged]);

  // Un aviso del sistema trae el correo en la URL: se abre y la marca se borra para no reabrirlo al recargar.
  const requestedId = Number(params.get("correo")) || null;
  if (requestedId !== null && requestedId !== selectedId) setSelectedId(requestedId);

  useEffect(() => {
    if (requestedId !== null) setParams({}, { replace: true });
  }, [requestedId, setParams]);

  const rows = data?.items ?? [];
  const unfiltered = !debouncedSearch && countActive(filters) === 0;

  // Lo marcado que ya no esta en pantalla (cambio de pagina, de carpeta o de filtro) deja de contar.
  const visibleKey = rows.map((email) => email.id).join(",");
  const [prunedFor, setPrunedFor] = useState(visibleKey);
  if (prunedFor !== visibleKey) {
    setPrunedFor(visibleKey);
    const visible = new Set(rows.map((email) => email.id));
    const kept = new Set([...checked].filter((id) => visible.has(id)));
    if (kept.size !== checked.size) setChecked(kept);
  }

  useEffect(() => {
    if (checked.size === 0) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !confirmation) setChecked(new Set());
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [checked.size, confirmation]);

  function refreshAll() {
    refresh();
    refreshCounts();
  }

  // Un correo movido a otra carpeta ya no pertenece a esta vista: se cierra el panel de lectura.
  function handleMoved() {
    setSelectedId(null);
    refreshAll();
  }

  // Abrir una conversacion la marca leida, y si se la acaban de asignar, tambien "vista".
  function handleOpen(email: EmailSummaryResponse) {
    setSelectedId(email.id);

    if (email.unread) {
      emailsApi
        .markRead(email.id)
        .then(refreshAll)
        .catch(() => undefined);
    }

    if (email.assignedUnseen) {
      emailsApi
        .markAssignmentSeen(email.id)
        .then(refreshAll)
        .catch(() => undefined);
    }
  }

  async function handleToggleStar(id: number) {
    const target = rows.find((row) => row.id === id);
    if (!target) return;
    const nextStarred = !target.starred;
    try {
      await emailsApi.toggleStar(id, nextStarred);
      refresh();
      refreshCounts();
    } catch {
      receipts.failed({
        action: "destacar",
        title: "No se pudo actualizar destacados",
      });
    }
  }

  /** Shift extiende la marca desde la ultima fila tocada, como en cualquier lista de archivos. */
  function toggleChecked(email: EmailSummaryResponse, shiftKey: boolean) {
    const index = rows.findIndex((row) => row.id === email.id);
    const anchor = lastToggled.current === null ? -1 : rows.findIndex((row) => row.id === lastToggled.current);
    lastToggled.current = email.id;

    setChecked((current) => {
      const next = new Set(current);

      if (shiftKey && anchor >= 0 && index >= 0) {
        const [start, end] = anchor < index ? [anchor, index] : [index, anchor];
        const adding = !current.has(email.id);
        for (let at = start; at <= end; at += 1) {
          if (adding) next.add(rows[at].id);
          else next.delete(rows[at].id);
        }
        return next;
      }

      if (next.has(email.id)) next.delete(email.id);
      else next.add(email.id);
      return next;
    });
  }

  const pageChecked = rows.filter((row) => checked.has(row.id)).length;
  const pageState: boolean | "mixed" =
    pageChecked === 0 ? false : pageChecked === rows.length ? true : "mixed";

  function togglePage() {
    setChecked(pageState === true ? new Set() : new Set(rows.map((row) => row.id)));
  }

  const isSelecting = selectable && checked.size > 0;
  const [prevSelecting, setPrevSelecting] = useState(isSelecting);
  const [selectionExiting, setSelectionExiting] = useState(false);
  const [tabsExiting, setTabsExiting] = useState(false);
  const [hasExitedOnce, setHasExitedOnce] = useState(false);
  const [preservedSelection, setPreservedSelection] = useState({
    count: checked.size,
    pageState,
  });

  if (isSelecting && (preservedSelection.count !== checked.size || preservedSelection.pageState !== pageState)) {
    setPreservedSelection({ count: checked.size, pageState });
  }

  if (prevSelecting !== isSelecting) {
    setPrevSelecting(isSelecting);
    if (isSelecting) {
      setSelectionExiting(false);
      setTabsExiting(true);
    } else {
      setSelectionExiting(true);
      setTabsExiting(false);
      setHasExitedOnce(true);
    }
  }

  useEffect(() => {
    if (!selectionExiting) return;
    const timer = setTimeout(() => {
      setSelectionExiting(false);
    }, 180);
    return () => clearTimeout(timer);
  }, [selectionExiting]);

  useEffect(() => {
    if (!tabsExiting) return;
    const timer = setTimeout(() => {
      setTabsExiting(false);
    }, 160);
    return () => clearTimeout(timer);
  }, [tabsExiting]);

  const showSelection = isSelecting || selectionExiting;
  const showTabs = !isSelecting || tabsExiting;

  async function runBulk(action: EmailBulkAction, ids: number[]) {
    const info = BULK[action];
    setBusy(true);

    try {
      const { affected } = await emailsApi.bulk(ids, action);
      const kept = ids.length - affected;

      receipts.done({
        action: info.receipt,
        title: info.done(affected),
        detail: action === "delete" && kept > 0 ? `${kept} con ticket se conservan como historial` : undefined,
        undo: info.undo
          ? {
              label: info.undo.label,
              run: async () => {
                await emailsApi.bulk(ids, info.undo!.action);
                refreshAll();
              },
            }
          : undefined,
      });

      if ((info.closesOpen || (folder === "starred" && action === "unstar")) && selectedId !== null && ids.includes(selectedId)) {
        setSelectedId(null);
      }
      setChecked(new Set());
      refreshAll();
    } catch (err) {
      receipts.failed({
        action: info.receipt,
        title: info.failed,
        detail: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  function handleBulk(action: EmailBulkAction) {
    const ids = [...checked];
    if (ids.length === 0 || busy) return;

    if (action !== "delete") {
      void runBulk(action, ids);
      return;
    }

    setConfirmation({
      eyebrow: "Papelera",
      title: "Eliminar definitivamente",
      description: (
        <>
          {ids.length === 1
            ? "Se borrará la conversación seleccionada"
            : `Se borrarán las ${ids.length} conversaciones seleccionadas`}{" "}
          con sus adjuntos. Las que pertenecen a un ticket se conservan como historial del caso. Esto no se
          puede deshacer.
        </>
      ),
      confirmLabel: "Eliminar",
      icon: Trash2,
      onConfirm: () => runBulk("delete", ids),
    });
  }

  function confirmEmptyTrash() {
    const total = counts?.trash.total ?? data?.total ?? 0;

    setConfirmation({
      eyebrow: "Papelera",
      title: "Vaciar la papelera",
      description: (
        <>
          {total === 1
            ? "Se eliminará definitivamente la única conversación que hay"
            : `Se eliminarán definitivamente las ${total} conversaciones que hay`}{" "}
          en la papelera, con sus adjuntos. Las que pertenecen a un ticket se conservan como historial del
          caso. Esto no se puede deshacer.
        </>
      ),
      confirmLabel: "Vaciar papelera",
      icon: Trash2,
      onConfirm: async () => {
        const result = await emailsApi.emptyTrash();
        receipts.done({
          action: "vaciar",
          title: "Papelera vaciada",
          detail:
            result.kept > 0
              ? `${result.deleted} eliminadas · ${result.kept} con ticket se conservan`
              : `${conversations(result.deleted, "eliminada", "eliminadas")}`,
        });
        setSelectedId(null);
        setChecked(new Set());
        refreshAll();
      },
    });
  }

  const alertsOn = prefs.sound || prefs.desktop;
  const trashTotal = counts?.trash.total ?? data?.total ?? 0;
  const folderTotal = counts?.[folder]?.total ?? data?.total ?? 0;
  const folderUnread = counts?.[folder]?.unread ?? 0;

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <ModuleHeader
          title={meta.title}
          summary={
            data ? (
              <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                {/* Total correos en carpeta */}
                <button
                  type="button"
                  onClick={() => setTicketFilter("todos")}
                  title={`Mostrar todos los correos de ${meta.title}`}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-medium transition-all cursor-pointer select-none active:scale-[0.98] ${
                    ticketFilter === "todos"
                      ? "border border-zinc-300 bg-zinc-100 text-zinc-900 shadow-2xs font-semibold"
                      : "border border-zinc-200/80 bg-white text-zinc-600 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  <span className="font-semibold text-zinc-900">{folderTotal}</span>
                  <span>{folderTotal === 1 ? "conversación" : "conversaciones"}</span>
                </button>

                {/* No leídos (con pulso verde animado) */}
                {folderUnread > 0 && (
                  <>
                    <span aria-hidden className="text-zinc-300">·</span>
                    <span
                      title={`${folderUnread} correos sin leer`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11.5px] font-semibold text-emerald-800 shadow-2xs"
                    >
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      <span className="font-semibold text-zinc-900">{folderUnread}</span>
                      <span>sin leer</span>
                    </span>
                  </>
                )}

                {/* En bandeja: Sin responder */}
                {folder === "inbox" && (data.counts.unanswered > 0 || ticketFilter === "sin-responder") && (
                  <>
                    <span aria-hidden className="text-zinc-300">·</span>
                    <button
                      type="button"
                      onClick={() => setTicketFilter("sin-responder")}
                      title="Filtrar por correos sin responder"
                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-medium transition-all cursor-pointer select-none active:scale-[0.98] ${
                        ticketFilter === "sin-responder"
                          ? "border border-red-300 bg-red-100/90 text-brand-red shadow-2xs font-bold ring-1 ring-red-300/40"
                          : "border border-zinc-200/80 bg-white text-zinc-600 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${data.counts.unanswered > 0 ? "bg-brand-red" : "bg-zinc-300"}`} />
                      <span className={data.counts.unanswered > 0 ? "font-bold text-brand-red" : "font-semibold text-zinc-800"}>
                        {data.counts.unanswered}
                      </span>
                      <span>sin responder</span>
                    </button>
                  </>
                )}

                {/* En bandeja: Míos o Asignados sin ver */}
                {folder === "inbox" && (Boolean(counts?.assignedUnseen) || ticketFilter === "mios") && (
                  <>
                    <span aria-hidden className="text-zinc-300">·</span>
                    <button
                      type="button"
                      onClick={() => setTicketFilter("mios")}
                      title="Filtrar por mis conversaciones asignadas"
                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-medium transition-all cursor-pointer select-none active:scale-[0.98] ${
                        ticketFilter === "mios"
                          ? "border border-zinc-300 bg-zinc-100 text-zinc-900 shadow-2xs font-semibold"
                          : "border border-zinc-200/80 bg-white text-zinc-600 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                      }`}
                    >
                      {Boolean(counts?.assignedUnseen) && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red shadow-[0_0_6px_rgba(228,0,43,0.5)]" />
                      )}
                      <span className="font-semibold text-zinc-900">{data.counts.mine}</span>
                      <span>míos</span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
                Cargando correos…
              </span>
            )
          }
          action={
            <div className="flex items-center gap-2">
              {folder === "trash" && isAdmin && (
                <button
                  type="button"
                  onClick={confirmEmptyTrash}
                  disabled={trashTotal === 0 || busy}
                  title="Vaciar la papelera"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[12.5px] font-medium text-zinc-700 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 hover:text-brand-red transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Vaciar papelera</span>
                </button>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setEditingAlerts(true)}
                    aria-label="Avisos de correo nuevo"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-red/20 active:scale-95"
                  >
                    {alertsOn ? (
                      <Bell className="h-4 w-4 text-brand-red" />
                    ) : (
                      <BellOff className="h-4 w-4 text-zinc-400" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {alertsOn ? "Avisos activados" : "Avisos desactivados"}
                </TooltipContent>
              </Tooltip>

              <Button
                size="sm"
                onClick={() => setComposing(true)}
                className="h-8 gap-1.5 px-3.5 text-[12.5px] font-semibold shadow-2xs active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                <span>Redactar</span>
              </Button>
            </div>
          }
        />

        {error && (
          <div className="mb-3 shrink-0">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {data === null ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className={`min-h-0 flex-1 pb-6 transition-opacity ${isStale ? "opacity-60" : ""}`}>
            <ResizablePanelGroup className="h-full rounded-xl border border-zinc-200/80 bg-white shadow-2xs overflow-hidden">
              <ResizablePanel defaultSize="26%" minSize="20%" maxSize="45%" className="flex flex-col">
                <div className="flex shrink-0 flex-col gap-2.5 px-3.5 pt-3 pb-2.5">
                  <div className="flex items-center gap-2">
                    <SearchInput
                      value={search}
                      onChange={setSearch}
                      placeholder="Buscar por remitente o asunto…"
                      className="min-w-0 flex-1"
                    />
                    <FilterButton value={filters} onChange={setFilters} />
                    {(search || countActive(filters) > 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setFilters(EMPTY_FILTERS);
                        }}
                        title="Limpiar búsqueda y filtros"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 text-[12px] font-medium text-zinc-600 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 transition-all cursor-pointer active:scale-[0.98]"
                      >
                        <X className="h-3.5 w-3.5 text-zinc-400" />
                        <span>Limpiar</span>
                      </button>
                    )}
                  </div>
                  <FilterChips value={filters} onChange={setFilters} />
                </div>

                <div className={`shrink-0 px-3.5 pb-3 ${folder === "sent" ? "hidden" : ""}`}>
                  <div className="grid grid-cols-1 grid-rows-1 h-8 items-center">
                    {showTabs && (
                      <div
                        className={`col-start-1 row-start-1 grid grid-cols-3 gap-1.5 w-full h-8 items-center ${
                          tabsExiting
                            ? "animate-plf-tabs-out pointer-events-none"
                            : hasExitedOnce
                              ? "animate-plf-tabs-in"
                              : ""
                        }`}
                        inert={tabsExiting ? true : undefined}
                      >
                        {primaryFilters.map(({ key, label, countKey }) => {
                          const isActive = ticketFilter === key;
                          const count = data?.counts?.[countKey] ?? 0;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setTicketFilter(key)}
                              className={`inline-flex h-8 w-full min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[12px] shadow-2xs transition-all outline-none select-none cursor-pointer active:scale-[0.98] ${
                                isActive
                                  ? "border border-zinc-300 bg-zinc-100 font-semibold text-zinc-900"
                                  : "border border-zinc-200 bg-white font-medium text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                              }`}
                            >
                              <span className="truncate">{label}</span>
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums transition-colors ${
                                  isActive
                                    ? "bg-zinc-200 text-zinc-800"
                                    : "bg-zinc-100 text-zinc-500"
                                }`}
                              >
                                {count}
                              </span>
                            </button>
                          );
                        })}

                        <EmailFilterMenu
                          options={secondaryFilters}
                          activeKey={ticketFilter}
                          counts={data?.counts}
                          assignedUnseen={counts?.assignedUnseen}
                          onSelect={setTicketFilter}
                        />
                      </div>
                    )}

                    {showSelection && (
                      <div
                        className="col-start-1 row-start-1 flex h-8 items-center w-full"
                        inert={selectionExiting ? true : undefined}
                      >
                        <SelectionBar
                          folder={folder as Exclude<FolderKey, "sent">}
                          canDelete={isAdmin}
                          count={isSelecting ? checked.size : preservedSelection.count}
                          pageState={isSelecting ? pageState : preservedSelection.pageState}
                          busy={busy}
                          isExiting={selectionExiting}
                          onTogglePage={togglePage}
                          onClear={() => setChecked(new Set())}
                          onAction={handleBulk}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                  {rows.length === 0 ? (
                    <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center">
                      <Inbox className="h-7 w-7 text-zinc-300" />
                      <p className="text-[12.5px] text-zinc-500">
                        {unfiltered ? meta.emptyText : "Ningún correo coincide con esta búsqueda."}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 p-3 pt-0">
                      {rows.map((email) => (
                        <ConversationRow
                          key={email.id}
                          email={email}
                          selected={selectedId === email.id}
                          checked={checked.has(email.id)}
                          selecting={checked.size > 0}
                          selectable={selectable}
                          onOpen={() => handleOpen(email)}
                          onToggle={(shiftKey) => toggleChecked(email, shiftKey)}
                          onToggleStar={() => handleToggleStar(email.id)}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {data.totalPages > 1 && (
                  <div className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-200/80 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                      aria-label="Página anterior"
                      className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 shadow-2xs outline-none transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-[11.5px] font-medium text-zinc-500 tabular-nums">
                      {page} de {data.totalPages} · {data.total} conversaciones
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= data.totalPages}
                      aria-label="Página siguiente"
                      className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 shadow-2xs outline-none transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </ResizablePanel>

              <ResizableHandle withHandle className="bg-zinc-200/80 hover:bg-zinc-300" />

              <ResizablePanel minSize="35%" className="flex flex-col">
                {composing ? (
                  <NewEmailComposer
                    onSent={() => {
                      setComposing(false);
                      refreshAll();
                    }}
                    onCancel={() => setComposing(false)}
                  />
                ) : selectedId ? (
                  <EmailDetailPane
                    key={selectedId}
                    emailId={selectedId}
                    onTicketCreated={refresh}
                    onMoved={handleMoved}
                    onStarred={(starred) => {
                      refresh();
                      refreshCounts();
                      if (folder === "starred" && !starred) {
                        setSelectedId(null);
                      }
                    }}
                    onClose={() => setSelectedId(null)}
                  />
                ) : (
                  <InboxTriageEmptyState
                    folder={folder}
                    counts={data.counts}
                    folderCounts={data.folderCounts}
                    onCompose={() => setComposing(true)}
                    onSelectTicketFilter={(f) => setTicketFilter(f)}
                    activeTicketFilter={ticketFilter}
                  />
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}
      </div>

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
      {editingAlerts && <NotificationsModal onClose={() => setEditingAlerts(false)} />}
    </TooltipProvider>
  );
}
