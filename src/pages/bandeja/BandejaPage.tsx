import { Bell, BellOff, ChevronLeft, ChevronRight, Inbox, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { emailsApi, type EmailQuery } from "../../api/emails";
import { NotificationsModal } from "../../components/app/NotificationsModal";
import { Alert } from "../../components/ui/Alert";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../components/shadcn/resizable";
import { ScrollArea } from "../../components/shadcn/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "../../components/shadcn/tabs";
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

export type FolderKey = "inbox" | "archived" | "junk" | "trash" | "sent";
type TicketFilter = "todos" | "sin-ticket" | "sin-responder" | "mios";

const folderMeta: Record<FolderKey, { title: string; emptyText: string }> = {
  inbox: { title: "Bandeja", emptyText: "Todavía no llegó ningún correo." },
  archived: { title: "Archivados", emptyText: "No hay correos archivados." },
  junk: { title: "No deseado", emptyText: "No hay correos marcados como no deseados." },
  trash: { title: "Papelera", emptyText: "La papelera está vacía." },
  sent: { title: "Enviados", emptyText: "Todavía no enviaste ningún correo." },
};

/** Pestanas del filtro: shadcn las pinta con negro al 60 %, que se lee lavado. */
const tabTriggerClass =
  "flex-1 text-[11.5px] font-medium text-subtle transition-colors hover:text-ink " +
  "data-active:bg-white data-active:font-semibold data-active:text-brand-red-dark";

/** Cada pagina se pide al servidor: entra lo que se ve, no la bandeja entera. */
const PAGE_SIZE = 15;

const pagerButtonClass =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-edge text-brand-gray outline-none " +
  "transition-colors hover:bg-fill hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/20 " +
  "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

const headerButtonClass =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-edge text-brand-gray outline-none " +
  "transition-colors hover:bg-fill hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/20";

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
  junk: {
    receipt: "junk",
    done: (n) => conversations(n, "movida a No deseado", "movidas a No deseado"),
    failed: "No se pudo mover a No deseado",
    undo: { action: "restore", label: "Devolver a la bandeja" },
    closesOpen: true,
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

  // Abrir una conversacion la marca leida solo para quien la abre.
  function handleOpen(email: EmailSummaryResponse) {
    setSelectedId(email.id);
    if (!email.unread) return;

    emailsApi
      .markRead(email.id)
      .then(refreshAll)
      .catch(() => undefined);
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

      if (info.closesOpen && selectedId !== null && ids.includes(selectedId)) setSelectedId(null);
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

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
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
            <ResizablePanelGroup className="h-full rounded-edge border border-line bg-white">
              <ResizablePanel defaultSize="26%" minSize="20%" maxSize="45%" className="flex flex-col">
                <div className="flex shrink-0 items-center gap-1 px-4 pb-2.5 pt-4">
                  <h2 className="min-w-0 flex-1 truncate font-heading text-[19px] font-bold tracking-[-0.02em] text-ink">
                    {meta.title}
                  </h2>

                  {folder === "trash" && isAdmin && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={confirmEmptyTrash}
                          disabled={trashTotal === 0 || busy}
                          aria-label="Vaciar la papelera"
                          className={`${headerButtonClass} hover:text-brand-red-dark disabled:cursor-not-allowed
                            disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-brand-gray`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Vaciar la papelera</TooltipContent>
                    </Tooltip>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setEditingAlerts(true)}
                        aria-label="Avisos de correo nuevo"
                        className={headerButtonClass}
                      >
                        {alertsOn ? (
                          <Bell className="h-4 w-4 text-brand-red-dark" />
                        ) : (
                          <BellOff className="h-4 w-4" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {alertsOn ? "Avisos activados" : "Avisos desactivados"}
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex shrink-0 flex-col gap-2 px-4 pb-2.5">
                  <div className="flex items-center gap-2">
                    <SearchInput
                      value={search}
                      onChange={setSearch}
                      placeholder="Buscar por remitente o asunto…"
                      className="min-w-0 flex-1"
                    />
                    <FilterButton value={filters} onChange={setFilters} />
                  </div>
                  <FilterChips value={filters} onChange={setFilters} />
                </div>

                <div className={`shrink-0 px-4 pb-3 ${folder === "sent" ? "hidden" : ""}`}>
                  <div className="grid grid-cols-1 grid-rows-1 h-9 items-center">
                    {showTabs && (
                      <div
                        className={`col-start-1 row-start-1 w-full ${
                          tabsExiting
                            ? "animate-plf-tabs-out pointer-events-none"
                            : hasExitedOnce
                              ? "animate-plf-tabs-in"
                              : ""
                        }`}
                        inert={tabsExiting ? true : undefined}
                      >
                        <Tabs
                          value={ticketFilter}
                          onValueChange={(value) => setTicketFilter(value as TicketFilter)}
                        >
                          <TabsList className="h-9 w-full border border-line bg-canvas">
                            <TabsTrigger value="todos" className={tabTriggerClass}>
                              Todos
                            </TabsTrigger>
                            <TabsTrigger value="sin-ticket" className={tabTriggerClass}>
                              Sin ticket
                            </TabsTrigger>
                            <TabsTrigger value="sin-responder" className={tabTriggerClass}>
                              Sin responder
                            </TabsTrigger>
                            <TabsTrigger value="mios" className={tabTriggerClass}>
                              Míos
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                    )}

                    {showSelection && (
                      <div
                        className="col-start-1 row-start-1 w-full"
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
                    <div className="flex h-40 flex-col items-center justify-center gap-2 px-6 text-center">
                      <Inbox className="h-6 w-6 text-faint" />
                      <p className="text-[13px] text-subtle">
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
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {data.totalPages > 1 && (
                  <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                      aria-label="Página anterior"
                      className={pagerButtonClass}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-[11.5px] font-medium text-subtle">
                      {page} de {data.totalPages} · {data.total} conversaciones
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= data.totalPages}
                      aria-label="Página siguiente"
                      className={pagerButtonClass}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </ResizablePanel>

              <ResizableHandle withHandle className="bg-line" />

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
