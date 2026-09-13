import { Ban, CheckCircle2, Gavel, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import { ticketVerdictsApi, type TicketVerdictQuery } from "../../api/ticketVerdicts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { formatDateTime } from "../../lib/format";
import type { TicketVerdictListResponse, TicketVerdictResponse } from "../../types/api";
import { VeredictoModal } from "./VeredictoModal";

type StatusFilter = "todos" | "activos" | "inactivos";

const statusFilters: {
  key: StatusFilter;
  label: string;
  countKey: keyof TicketVerdictListResponse["counts"];
}[] = [
  { key: "todos", label: "Todos", countKey: "all" },
  { key: "activos", label: "Activos", countKey: "active" },
  { key: "inactivos", label: "Inactivos", countKey: "inactive" },
];

/** Gestión del catálogo de veredictos para tickets solucionados. */
export function VeredictosPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [pageSize, setPageSize] = useState(10);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);
  const [modal, setModal] = useState<"nuevo" | TicketVerdictResponse | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300).trim();

  const { data, isStale, error, setPage, refresh } = usePagedList<
    TicketVerdictQuery,
    TicketVerdictListResponse
  >({
    fetch: ticketVerdictsApi.list,
    criteria: { pageSize, search: debouncedSearch || undefined, status },
    fallbackError: "No se pudieron cargar los veredictos",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;

  async function run(id: number, action: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      // Relee la página: totales y contadores los manda el servidor, no se adivinan aquí.
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "No se pudo completar la acción");
    } finally {
      setBusyId(null);
    }
  }

  function askToggleActive(verdict: TicketVerdictResponse) {
    if (verdict.isActive) {
      setConfirmation({
        tone: "danger",
        icon: Ban,
        eyebrow: "Tickets · Veredictos",
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
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      eyebrow: "Tickets · Veredictos",
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
          data
            ? `${data.total} ${data.total === 1 ? "veredicto" : "veredictos"} · las opciones para marcar un ticket como solucionado`
            : "Cargando los veredictos…"
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por veredicto…"
            className="w-[280px]"
          />

          <div className="flex flex-wrap gap-1.5">
            {statusFilters.map((filter) => (
              <FilterChip
                key={filter.key}
                label={filter.label}
                count={counts?.[filter.countKey] ?? 0}
                active={status === filter.key}
                onClick={() => setStatus(filter.key)}
              />
            ))}
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
          <div className={`transition-opacity ${isStale ? "opacity-60" : ""}`}>
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
                      <span className="inline-flex items-center gap-1.5 text-[12.5px]">
                        <span
                          aria-hidden
                          className={`h-[7px] w-[7px] rounded-full ${
                            verdict.isActive ? "bg-brand-green" : "bg-line-strong"
                          }`}
                        />
                        <span className={verdict.isActive ? "text-ink" : "text-subtle"}>
                          {verdict.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </span>
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

            {rows.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <Gavel className="h-6 w-6 text-faint" />
                <p className="text-[13.5px] text-faint">
                  {debouncedSearch || status !== "todos"
                    ? "Ningún veredicto coincide con el filtro."
                    : "Todavía no hay veredictos en el catálogo."}
                </p>
              </div>
            )}

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

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}

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
