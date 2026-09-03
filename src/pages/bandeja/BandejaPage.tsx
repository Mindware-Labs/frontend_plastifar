import { Inbox, Paperclip } from "lucide-react";
import { useState } from "react";
import { emailsApi, type EmailQuery } from "../../api/emails";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { FilterChip } from "../../components/ui/FilterChip";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { formatEmailListDate, formatTicketCode } from "../../lib/format";
import type { EmailListResponse, EmailSummaryResponse } from "../../types/api";
import { EmailDetailPane } from "./EmailDetailPane";

type FilterKey = "sin-ticket" | "todos" | "con-ticket";

const filters: { key: FilterKey; label: string; countKey: keyof EmailListResponse["counts"] }[] = [
  { key: "sin-ticket", label: "Sin ticket", countKey: "unlinked" },
  { key: "todos", label: "Todos", countKey: "all" },
  { key: "con-ticket", label: "Convertidos", countKey: "linked" },
];

export function BandejaPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("sin-ticket");
  const [pageSize, setPageSize] = useState(25);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const debouncedSearch = useDebouncedValue(search).trim();

  const { data, isStale, error, page, setPage, refresh } = usePagedList<EmailQuery, EmailListResponse>(
    {
      fetch: emailsApi.list,
      criteria: { pageSize, filter, search: debouncedSearch || undefined },
      fallbackError: "No se pudo cargar la bandeja",
    },
  );

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const unfiltered = filter === "sin-ticket" && !debouncedSearch;

  function fullName(email: EmailSummaryResponse) {
    return email.fromName ?? email.fromEmail;
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Bandeja"
        summary={
          counts
            ? `${counts.unlinked} correos esperando ticket · ${counts.all} en total`
            : "Cargando la bandeja de correos…"
        }
      />

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por remitente o asunto…"
          className="w-[260px]"
        />

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        {filters.map(({ key, label, countKey }) => (
          <FilterChip
            key={key}
            label={label}
            count={counts?.[countKey] ?? 0}
            active={filter === key}
            onClick={() => setFilter(key)}
          />
        ))}
      </div>

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
        <div
          className={`flex min-h-0 flex-1 gap-4 pb-6 transition-opacity ${
            isStale ? "opacity-60" : ""
          }`}
        >
          <div className="flex w-[360px] shrink-0 flex-col overflow-hidden rounded-edge border border-line bg-white">
            <div className="flex-1 overflow-y-auto">
              {rows.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <Inbox className="h-6 w-6 text-faint" />
                  <p className="text-[12.5px] text-faint">
                    {unfiltered
                      ? "No hay correos esperando ticket."
                      : "Ningún correo coincide con este filtro o búsqueda."}
                  </p>
                </div>
              ) : (
                rows.map((email) => {
                  const isSelected = selectedId === email.id;
                  return (
                    <button
                      key={email.id}
                      type="button"
                      onClick={() => setSelectedId(email.id)}
                      aria-current={isSelected}
                      className={`block w-full border-b border-line-soft px-4 py-3 text-left transition-colors last:border-0
                        ${isSelected ? "border-l-2 border-l-brand-red bg-canvas pl-[14px]" : "hover:bg-canvas"}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Avatar name={fullName(email)} seed={email.id} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-[12.5px] font-semibold text-ink">
                              {fullName(email)}
                            </p>
                            <span className="shrink-0 text-[11px] text-faint">
                              {formatEmailListDate(email.createdAt)}
                            </span>
                          </div>
                          <p className="truncate text-[12.5px] text-brand-gray">
                            {email.subject || "(sin asunto)"}
                          </p>
                          {(email.ticketId || email.attachmentCount > 0) && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              {email.ticketId && (
                                <Badge tone="green">{formatTicketCode(email.ticketId)}</Badge>
                              )}
                              {email.attachmentCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-faint">
                                  <Paperclip className="h-3 w-3" />
                                  {email.attachmentCount}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="shrink-0 border-t border-line px-3">
              <Pagination
                page={page}
                pageSize={data.pageSize}
                total={data.total}
                totalPages={data.totalPages}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                noun="correos"
              />
            </div>
          </div>

          <div className="flex-1 overflow-hidden rounded-edge border border-line bg-white">
            {selectedId ? (
              <EmailDetailPane key={selectedId} emailId={selectedId} onTicketCreated={refresh} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Inbox className="h-7 w-7 text-faint" />
                <p className="text-[13px] text-faint">Seleccioná un correo para verlo.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
