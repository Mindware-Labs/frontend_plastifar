import { Inbox, Paperclip } from "lucide-react";
import { useState } from "react";
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
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { formatEmailListDate, formatTicketCode } from "../../lib/format";
import type { EmailListResponse, EmailSummaryResponse } from "../../types/api";
import { ticketBadgeClass } from "./badgeStyles";
import { EmailDetailPane } from "./EmailDetailPane";

export type FolderKey = "inbox" | "archived" | "junk" | "trash";
type TicketFilter = "todos" | "sin-ticket";

const folderMeta: Record<FolderKey, { title: string; emptyText: string }> = {
  inbox: { title: "Bandeja", emptyText: "Todavía no llegó ningún correo." },
  archived: { title: "Archivados", emptyText: "No hay correos archivados." },
  junk: { title: "No deseado", emptyText: "No hay correos marcados como no deseados." },
  trash: { title: "Papelera", emptyText: "La papelera está vacía." },
};

/** Pestanas del filtro: shadcn las pinta con negro al 60 %, que se lee lavado. */
const tabTriggerClass =
  "text-[12.5px] font-medium text-subtle transition-colors hover:text-ink " +
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
  const debouncedSearch = useDebouncedValue(search).trim();
  const meta = folderMeta[folder];

  const { data, isStale, error, refresh } = usePagedList<EmailQuery, EmailListResponse>(
    {
      fetch: emailsApi.list,
      criteria: { pageSize: PAGE_SIZE, folder, filter: ticketFilter, search: debouncedSearch || undefined },
      fallbackError: "No se pudo cargar la bandeja",
    },
  );

  const rows = data?.items ?? [];
  const unfiltered = !debouncedSearch;

  function fullName(email: EmailSummaryResponse) {
    return email.fromName ?? email.fromEmail;
  }

  // Un correo movido a otra carpeta ya no pertenece a esta vista: se cierra el panel de lectura.
  function handleMoved() {
    setSelectedId(null);
    refresh();
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
              <ResizablePanel defaultSize="34%" minSize="26%" maxSize="50%" className="flex flex-col">
                <div className="flex shrink-0 items-center justify-between gap-3 p-4 pb-3">
                  <h2 className="font-heading text-[20px] font-bold tracking-[-0.02em] text-ink">
                    {meta.title}
                  </h2>
                  <Tabs value={ticketFilter} onValueChange={(value) => setTicketFilter(value as TicketFilter)}>
                    <TabsList className="border border-line bg-canvas">
                      <TabsTrigger value="todos" className={tabTriggerClass}>
                        Todos
                      </TabsTrigger>
                      <TabsTrigger value="sin-ticket" className={tabTriggerClass}>
                        Sin ticket
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="shrink-0 px-4 pb-3">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Buscar por remitente o asunto…"
                  />
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
                    <div className="flex flex-col gap-2 p-4 pt-0">
                      {rows.map((email) => {
                        const name = fullName(email);
                        const isSelected = selectedId === email.id;
                        return (
                          <button
                            key={email.id}
                            type="button"
                            onClick={() => setSelectedId(email.id)}
                            data-selected={isSelected}
                            className="group flex flex-col items-start gap-1.5 rounded-edge border
                              border-line bg-white p-3 text-left outline-none
                              transition-[background-color,border-color,box-shadow]
                              hover:border-line-strong hover:bg-canvas
                              focus-visible:border-brand-red/40 focus-visible:ring-3 focus-visible:ring-brand-red/12
                              data-[selected=true]:border-brand-red/45 data-[selected=true]:bg-brand-red/[0.05]
                              data-[selected=true]:hover:border-brand-red
                              data-[selected=true]:hover:bg-brand-red/[0.085]
                              data-[selected=true]:hover:shadow-[0_6px_16px_-10px_rgba(228,0,43,0.5)]"
                          >
                            <div className="flex w-full items-center gap-2">
                              <Avatar className="size-6">
                                <AvatarFallback
                                  className="bg-fill text-[10px] font-semibold text-brand-gray
                                    group-data-[selected=true]:bg-brand-red/12
                                    group-data-[selected=true]:text-brand-red-dark"
                                >
                                  {initials(name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate text-[13px] font-semibold text-ink
                                transition-colors group-data-[selected=true]:text-brand-red-dark">
                                {name}
                              </span>
                              <span className="ml-auto shrink-0 text-[11px] font-medium text-faint">
                                {formatEmailListDate(email.createdAt)}
                              </span>
                            </div>
                            <div className="line-clamp-1 w-full text-[12.5px] font-medium text-brand-gray">
                              {email.subject || "(sin asunto)"}
                            </div>
                            <div className="line-clamp-2 w-full text-[12px] leading-relaxed text-subtle">
                              {email.preview}
                            </div>
                            {(email.ticketId || email.attachmentCount > 0) && (
                              <div className="flex items-center gap-1.5 pt-0.5">
                                {email.ticketId && (
                                  <Badge variant="secondary" className={ticketBadgeClass}>
                                    {formatTicketCode(email.ticketId)}
                                  </Badge>
                                )}
                                {email.attachmentCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="border-line bg-white text-[10px] font-semibold text-subtle"
                                  >
                                    <Paperclip className="h-3 w-3" />
                                    {email.attachmentCount}
                                  </Badge>
                                )}
                              </div>
                            )}
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
