import { CornerUpLeft, Inbox, MessagesSquare, Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { emailsApi, type EmailQuery } from "../../api/emails";
import { Alert } from "../../components/ui/Alert";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { Avatar, AvatarFallback } from "../../components/shadcn/avatar";
import { Badge } from "../../components/shadcn/badge";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../components/shadcn/resizable";
import { ScrollArea } from "../../components/shadcn/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "../../components/shadcn/tabs";
import { TooltipProvider } from "../../components/shadcn/tooltip";
import { useEmailCounts } from "../../context/useEmailCounts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { formatEmailListDate, formatTicketCode } from "../../lib/format";
import type { EmailListResponse, EmailSummaryResponse } from "../../types/api";
import { ticketBadgeClass } from "./badgeStyles";
import { EmailDetailPane } from "./EmailDetailPane";

export type FolderKey = "inbox" | "archived" | "junk" | "trash";
type TicketFilter = "todos" | "sin-ticket" | "sin-responder";

const folderMeta: Record<FolderKey, { title: string; emptyText: string }> = {
  inbox: { title: "Bandeja", emptyText: "Todavía no llegó ningún correo." },
  archived: { title: "Archivados", emptyText: "No hay correos archivados." },
  junk: { title: "No deseado", emptyText: "No hay correos marcados como no deseados." },
  trash: { title: "Papelera", emptyText: "La papelera está vacía." },
};

/** Pestanas del filtro: shadcn las pinta con negro al 60 %, que se lee lavado. */
const tabTriggerClass =
  "flex-1 text-[11.5px] font-medium text-subtle transition-colors hover:text-ink " +
  "data-active:bg-white data-active:font-semibold data-active:text-brand-red-dark";

/** Sin control de paginacion: se pide la pagina mas grande que admite la API. */
const PAGE_SIZE = 100;

interface BandejaPageProps {
  folder: FolderKey;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function BandejaPage({ folder }: BandejaPageProps) {
  const [search, setSearch] = useState("");
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>("todos");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { refresh: refreshCounts, onInboxChanged } = useEmailCounts();
  const debouncedSearch = useDebouncedValue(search).trim();
  const meta = folderMeta[folder];

  const { data, isStale, error, refresh } = usePagedList<EmailQuery, EmailListResponse>(
    {
      fetch: emailsApi.list,
      criteria: { pageSize: PAGE_SIZE, folder, filter: ticketFilter, search: debouncedSearch || undefined },
      fallbackError: "No se pudo cargar la bandeja",
    },
  );

  // El aviso llega en cualquier momento: se guarda la recarga vigente para no resuscribirse.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => onInboxChanged(() => refreshRef.current()), [onInboxChanged]);

  const rows = data?.items ?? [];
  const unfiltered = !debouncedSearch;

  function fullName(email: EmailSummaryResponse) {
    return email.fromName ?? email.fromEmail;
  }

  // Un correo movido a otra carpeta ya no pertenece a esta vista: se cierra el panel de lectura.
  function handleMoved() {
    setSelectedId(null);
    refresh();
    refreshCounts();
  }

  // Abrir una conversacion la marca leida solo para quien la abre.
  function handleOpen(email: EmailSummaryResponse) {
    setSelectedId(email.id);
    if (!email.unread) return;

    emailsApi
      .markRead(email.id)
      .then(() => {
        refresh();
        refreshCounts();
      })
      .catch(() => undefined);
  }

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
                <div className="shrink-0 px-4 pb-2.5 pt-4">
                  <h2 className="font-heading text-[19px] font-bold tracking-[-0.02em] text-ink">
                    {meta.title}
                  </h2>
                </div>

                <div className="shrink-0 px-4 pb-2.5">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Buscar por remitente o asunto…"
                  />
                </div>

                <div className="shrink-0 px-4 pb-3">
                  <Tabs
                    value={ticketFilter}
                    onValueChange={(value) => setTicketFilter(value as TicketFilter)}
                  >
                    <TabsList className="w-full border border-line bg-canvas">
                      <TabsTrigger value="todos" className={tabTriggerClass}>
                        Todos
                      </TabsTrigger>
                      <TabsTrigger value="sin-ticket" className={tabTriggerClass}>
                        Sin ticket
                      </TabsTrigger>
                      <TabsTrigger value="sin-responder" className={tabTriggerClass}>
                        Sin responder
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
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
                      {rows.map((email) => {
                        const name = fullName(email);
                        const isSelected = selectedId === email.id;
                        return (
                          <button
                            key={email.id}
                            type="button"
                            onClick={() => handleOpen(email)}
                            data-selected={isSelected}
                            data-unread={email.unread}
                            className="group flex flex-col items-start gap-0.5 rounded-edge border
                              border-line bg-white px-2.5 py-2 text-left outline-none
                              transition-[background-color,border-color,box-shadow]
                              data-[unread=false]:hover:border-line-strong data-[unread=false]:hover:bg-canvas
                              focus-visible:border-brand-red/40 focus-visible:ring-3 focus-visible:ring-brand-red/12
                              data-[selected=true]:border-brand-red/45 data-[selected=true]:bg-brand-red/[0.05]
                              data-[selected=true]:hover:border-brand-red
                              data-[selected=true]:hover:bg-brand-red/[0.085]
                              data-[selected=true]:hover:shadow-[0_6px_16px_-10px_rgba(228,0,43,0.5)]
                              data-[unread=false]:bg-canvas/60
                              data-[unread=true]:data-[selected=false]:border-brand-red/40
                              data-[unread=true]:data-[selected=false]:bg-brand-red/[0.03]
                              data-[unread=true]:data-[selected=false]:shadow-[0_0_0_1px_rgba(228,0,43,0.22),0_2px_6px_-1px_rgba(228,0,43,0.28),0_10px_26px_-6px_rgba(228,0,43,0.45)]
                              data-[unread=true]:data-[selected=false]:hover:border-brand-red/60
                              data-[unread=true]:data-[selected=false]:hover:bg-brand-red/[0.06]
                              data-[unread=true]:data-[selected=false]:hover:shadow-[0_0_0_1px_rgba(228,0,43,0.35),0_3px_8px_-1px_rgba(228,0,43,0.38),0_14px_32px_-6px_rgba(228,0,43,0.6)]"
                          >
                            <div className="flex w-full items-center gap-1.5">
                              <Avatar className="size-5">
                                <AvatarFallback
                                  className="bg-fill text-[9px] font-semibold text-brand-gray
                                    group-data-[selected=true]:bg-brand-red/12
                                    group-data-[selected=true]:text-brand-red-dark"
                                >
                                  {initials(name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink
                                transition-colors group-data-[unread=true]:font-bold
                                group-data-[unread=false]:font-medium
                                group-data-[selected=true]:text-brand-red-dark">
                                {name}
                              </span>
                              <span className="ml-auto shrink-0 text-[10.5px] font-medium text-faint">
                                {formatEmailListDate(email.createdAt)}
                              </span>
                            </div>

                            {/* Distintivos al final del asunto: se ahorra una fila entera por tarjeta. */}
                            <div className="flex w-full items-center gap-1.5">
                              {email.answered && (
                                <CornerUpLeft
                                  className="h-3 w-3 shrink-0 text-brand-green"
                                  aria-label="Respondido"
                                />
                              )}
                              <span className="min-w-0 flex-1 truncate text-[12px] text-brand-gray
                                group-data-[unread=true]:font-semibold
                                group-data-[unread=false]:font-medium">
                                {email.subject || "(sin asunto)"}
                              </span>
                              {(email.messageCount > 1 || email.attachmentCount > 0 || email.ticketId) && (
                                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                                  {email.messageCount > 1 && (
                                    <span
                                      title={`${email.messageCount} correos en la conversación`}
                                      className="flex items-center gap-0.5 text-[10.5px] font-medium text-faint"
                                    >
                                      <MessagesSquare className="h-3 w-3" />
                                      {email.messageCount}
                                    </span>
                                  )}
                                  {email.attachmentCount > 0 && (
                                    <span className="flex items-center gap-0.5 text-[10.5px] font-medium text-faint">
                                      <Paperclip className="h-3 w-3" />
                                      {email.attachmentCount}
                                    </span>
                                  )}
                                  {email.ticketId && (
                                    <Badge
                                      variant="secondary"
                                      className={`${ticketBadgeClass} h-4 px-1.5`}
                                    >
                                      {formatTicketCode(email.ticketId)}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="line-clamp-1 w-full text-[11.5px] text-subtle">
                              {email.preview}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </ResizablePanel>

              <ResizableHandle withHandle className="bg-line" />

              <ResizablePanel minSize="35%" className="flex flex-col">
                {selectedId ? (
                  <EmailDetailPane
                    key={selectedId}
                    emailId={selectedId}
                    onTicketCreated={refresh}
                    onMoved={handleMoved}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                    <Inbox className="h-7 w-7 text-faint" />
                    <p className="text-[13px] text-subtle">Selecciona un correo para verlo.</p>
                  </div>
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
