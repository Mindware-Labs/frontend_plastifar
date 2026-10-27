import { Ban, CheckCircle2, Gavel, Pencil, Plus, Trash2, X } from "lucide-react";
import { ticketVerdictsApi, type TicketVerdictQuery } from "../../api/ticketVerdicts";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { EmptyResult } from "../../components/ui/EmptyResult";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { useAuth } from "../../context/useAuth";
import { useCatalogActions } from "../../hooks/useCatalogActions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { useRowRun } from "../../hooks/useRowRun";
import { useUrlNumber, useUrlState } from "../../hooks/useUrlState";
import { formatDateTime } from "../../lib/format";
import { staleClass } from "../../lib/listState";
import type { TicketVerdictListResponse, TicketVerdictResponse } from "../../types/api";
import { VeredictoModal } from "./VeredictoModal";
import { PAGE_SIZES } from "../../lib/pageSizes";

type StatusFilter = "todos" | "activos" | "inactivos";

const STATUS_KEYS: StatusFilter[] = ["todos", "activos", "inactivos"];

/** Gestión del catálogo de veredictos para tickets solucionados. */
export function VeredictosPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  const [search, setSearch] = useUrlState<string>("q", "");
  const [status, setStatus] = useUrlState<StatusFilter>("estado", "todos", STATUS_KEYS);
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);
  const { modal, setModal, busyId, setBusyId, ask, dialog } = useCatalogActions<TicketVerdictResponse>();

  const debouncedSearch = useDebouncedValue(search, 300).trim();

  const { data, isStale, error, setPage, refresh } = usePagedList<
    TicketVerdictQuery,
    TicketVerdictListResponse
  >({
    fetch: ticketVerdictsApi.list,
    criteria: { pageSize, search: debouncedSearch || undefined, status },
    fallbackError: "No se pudieron cargar los veredictos",
    pageKey: "pagina",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const filtered = Boolean(debouncedSearch) || status !== "todos";

  function clearAll() {
    setSearch("");
    setStatus("todos");
  }

  const { actionError, run } = useRowRun(setBusyId, refresh);

  function askToggleActive(verdict: TicketVerdictResponse) {
    if (verdict.isActive) {
      ask({
        tone: "danger",
        icon: Ban,
        title: "Desactivar veredicto",
        description: (
          <>
            <strong className="font-semibold text-ink">{verdict.name}</strong> dejará de ofrecerse al
            marcar tickets como solucionados. Los {verdict.ticketCount} que ya lo usan lo conservan.
          </>
        ),
        confirmLabel: "Desactivar",
        onConfirm: () => run(verdict.id, () => ticketVerdictsApi.setActive(verdict.id, false)),
      });
      return;
    }

    void run(verdict.id, () => ticketVerdictsApi.setActive(verdict.id, true));
  }

  function askDelete(verdict: TicketVerdictResponse) {
    ask({
      tone: "danger",
      icon: Trash2,
      title: "Eliminar veredicto",
      description: (
        <>
          Se eliminará <strong className="font-semibold text-ink">{verdict.name}</strong> del catálogo.
          Si algún ticket lo usa, el borrado se rechaza y tendrás que desactivarlo.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: () => run(verdict.id, () => ticketVerdictsApi.remove(verdict.id)),
    });
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Veredictos"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando los veredictos…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "veredicto" : "veredictos"}
                  count={counts.all}
                  active={status === "todos"}
                  onClick={() => {
                    setStatus("todos");
                    setPage(1);
                  }}
                  tone="neutral"
                  title="Mostrar todos los veredictos"
                />
                <HeaderTag
                  label={counts.active === 1 ? "activo" : "activos"}
                  count={counts.active}
                  active={status === "activos"}
                  onClick={() => {
                    setStatus("activos");
                    setPage(1);
                  }}
                  tone="emerald"
                  dot
                  title="Filtrar por veredictos activos"
                />
                <HeaderTag
                  label={counts.inactive === 1 ? "inactivo" : "inactivos"}
                  count={counts.inactive}
                  active={status === "inactivos"}
                  onClick={() => {
                    setStatus("inactivos");
                    setPage(1);
                  }}
                  tone="red"
                  dot
                  title="Filtrar por veredictos inactivos"
                />
              </>
            )}
          </HeaderCounts>
        }
        action={
          isAdmin && (
            <Button size="sm" onClick={() => setModal("nuevo")}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo veredicto
            </Button>
          )
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por veredicto…"
              className="w-[260px] sm:w-[280px]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                title="Limpiar búsqueda"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[12.5px] font-medium text-zinc-600 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 transition-all cursor-pointer active:scale-[0.98]"
              >
                <X className="h-3.5 w-3.5 text-zinc-400" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {(error || actionError) && (
          <div className="mb-3">
            <Alert variant="error">{error ?? actionError}</Alert>
          </div>
        )}

        {!data ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          // Atenuada mientras llega la página nueva: la anterior se queda para no dar un salto en blanco.
          <div className={staleClass(isStale)}>
            <DataTable>
              <thead>
                <HeadRow>
                  <Th>Veredicto</Th>
                  <Th>Tickets</Th>
                  <Th>Estado</Th>
                  <Th>Actualizado</Th>
                  {isAdmin && <Th className="w-28 text-right">Acciones</Th>}
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((verdict) => (
                  <Row key={verdict.id} busy={busyId === verdict.id}>
                    <Td className="text-[13px] font-medium text-ink">{verdict.name}</Td>
                    <Td className="text-[12.5px] text-subtle">{verdict.ticketCount}</Td>
                    <Td>
                      <StatusDot active={verdict.isActive} />
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-subtle">
                      {formatDateTime(verdict.updatedAt)}
                    </Td>

                    {isAdmin && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Editar ${verdict.name}`}
                            icon={Pencil}
                            onClick={() => setModal(verdict)}
                            disabled={busyId === verdict.id}
                          />
                          <RowAction
                            label={verdict.isActive ? `Desactivar ${verdict.name}` : `Activar ${verdict.name}`}
                            icon={verdict.isActive ? Ban : CheckCircle2}
                            onClick={() => askToggleActive(verdict)}
                            disabled={busyId === verdict.id}
                          />
                          <RowAction
                            label={`Eliminar ${verdict.name}`}
                            icon={Trash2}
                            onClick={() => askDelete(verdict)}
                            disabled={busyId === verdict.id}
                            danger
                          />
                        </div>
                      </Td>
                    )}
                  </Row>
                ))}
              </tbody>
            </DataTable>

            {rows.length === 0 &&
              (filtered ? (
                <EmptyResult message="Ningún veredicto coincide con el filtro." onClear={clearAll} />
              ) : (
                <div className="flex flex-col items-center gap-2 py-14 text-center">
                  <Gavel className="h-6 w-6 text-faint" />
                  <p className="text-[13.5px] text-faint">Todavía no hay veredictos en el catálogo.</p>
                </div>
              ))}

            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="veredictos"
            />
          </div>
        )}
      </div>

      {dialog}

      {modal !== null && (
        <VeredictoModal
          verdict={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
