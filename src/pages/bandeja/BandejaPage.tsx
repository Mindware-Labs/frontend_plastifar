import { Inbox, Paperclip, Search } from "lucide-react";
import { useState } from "react";
import { emailsApi, type EmailQuery } from "../../api/emails";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { Avatar, AvatarFallback } from "../../components/shadcn/avatar";
import { Badge } from "../../components/shadcn/badge";
import { Input } from "../../components/shadcn/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../components/shadcn/resizable";
import { ScrollArea } from "../../components/shadcn/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "../../components/shadcn/tabs";
import { TooltipProvider } from "../../components/shadcn/tooltip";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { formatEmailListDate, formatTicketCode } from "../../lib/format";
import type { EmailListResponse, EmailSummaryResponse } from "../../types/api";
import { EmailDetailPane } from "./EmailDetailPane";

export type FolderKey = "inbox" | "archived" | "junk" | "trash";
type TicketFilter = "todos" | "sin-ticket";

const folderMeta: Record<FolderKey, { title: string; emptyText: string }> = {
  inbox: { title: "Bandeja", emptyText: "Todavía no llegó ningún correo." },
  archived: { title: "Archivados", emptyText: "No hay correos archivados." },
  junk: { title: "Junk", emptyText: "No hay correos marcados como junk." },
  trash: { title: "Papelera", emptyText: "La papelera está vacía." },
};

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
            <ResizablePanelGroup className="h-full rounded-edge border">
              <ResizablePanel defaultSize="34%" minSize="26%" maxSize="50%" className="flex flex-col">
                <div className="flex shrink-0 items-center justify-between gap-2 p-4 pb-0">
                  <h2 className="font-heading text-xl font-bold">{meta.title}</h2>
                  <Tabs value={ticketFilter} onValueChange={(value) => setTicketFilter(value as TicketFilter)}>
                    <TabsList>
                      <TabsTrigger value="todos">Todos</TabsTrigger>
                      <TabsTrigger value="sin-ticket">Sin ticket</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="shrink-0 p-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar por remitente o asunto…"
                      className="pl-8"
                    />
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  {rows.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 px-6 text-center">
                      <Inbox className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
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
                            className="flex flex-col items-start gap-2 rounded-edge border p-3 text-left text-sm
                              transition-colors hover:bg-accent data-[selected=true]:border-brand-red
                              data-[selected=true]:bg-fill"
                          >
                            <div className="flex w-full items-center gap-2">
                              <Avatar className="size-6">
                                <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
                              </Avatar>
                              <span className="font-semibold">{name}</span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {formatEmailListDate(email.createdAt)}
                              </span>
                            </div>
                            <div className="line-clamp-1 w-full font-medium">
                              {email.subject || "(sin asunto)"}
                            </div>
                            <div className="line-clamp-2 w-full text-muted-foreground">{email.preview}</div>
                            {(email.ticketId || email.attachmentCount > 0) && (
                              <div className="flex items-center gap-1.5">
                                {email.ticketId && (
                                  <Badge variant="secondary">{formatTicketCode(email.ticketId)}</Badge>
                                )}
                                {email.attachmentCount > 0 && (
                                  <Badge variant="outline">
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

              <ResizableHandle withHandle />

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
                    <Inbox className="h-7 w-7 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Seleccioná un correo para verlo.</p>
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
