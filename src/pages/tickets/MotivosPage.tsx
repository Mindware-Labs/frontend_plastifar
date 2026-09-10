import { Ban, CheckCircle2, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { departmentsApi } from "../../api/departments";
import { ticketTopicsApi, type TicketTopicQuery } from "../../api/ticketTopics";
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
import type {
  DepartmentResponse,
  TicketTopicListResponse,
  TicketTopicResponse,
} from "../../types/api";
import { MotivoModal } from "./MotivoModal";

type StatusFilter = "todos" | "activos" | "inactivos";

const statusFilters: {
  key: StatusFilter;
  label: string;
  countKey: keyof TicketTopicListResponse["counts"];
}[] = [
  { key: "todos", label: "Todos", countKey: "all" },
  { key: "activos", label: "Activos", countKey: "active" },
  { key: "inactivos", label: "Inactivos", countKey: "inactive" },
];

/** El tono no decora: dice cuánta prisa mete cada motivo en el SLA del ticket. */
const priorityClass: Record<string, string> = {
  Emergencia: "border-red-200 bg-red-50 text-red-800",
  Alta: "border-amber-200 bg-amber-50 text-amber-800",
  Normal: "border-line-strong bg-canvas text-ink",
  Baja: "border-line-strong bg-canvas text-subtle",
};

/**
 * Catálogo de motivos. De aquí sale el departamento que el formulario de alta
 * rellena solo al elegir el motivo, así que editarlo cambia a dónde se encolan los tickets.
 */
export function MotivosPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [pageSize, setPageSize] = useState(10);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);
  const [modal, setModal] = useState<"nuevo" | TicketTopicResponse | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300).trim();

  const { data, isStale, error, setPage, refresh } = usePagedList<
    TicketTopicQuery,
    TicketTopicListResponse
  >({
    fetch: ticketTopicsApi.list,
    criteria: { pageSize, search: debouncedSearch || undefined, status },
    fallbackError: "No se pudieron cargar los motivos",
  });

  useEffect(() => {
    departmentsApi.list().then(setDepartments).catch(() => setDepartments([]));
  }, []);

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

  function askToggleActive(topic: TicketTopicResponse) {
    if (topic.isActive) {
      setConfirmation({
        tone: "danger",
        icon: Ban,
        eyebrow: "Tickets · Motivos",
        title: "Desactivar motivo",
        description: (
          <>
            <strong className="font-semibold text-ink">{topic.name}</strong> dejará de ofrecerse al
            crear tickets. Los {topic.ticketCount} que ya lo usan lo conservan.
          </>
        ),
        confirmLabel: "Desactivar",
        onConfirm: () => run(topic.id, () => ticketTopicsApi.setActive(topic.id, false)),
      });
      return;
    }

    void run(topic.id, () => ticketTopicsApi.setActive(topic.id, true));
  }

  function askDelete(topic: TicketTopicResponse) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      eyebrow: "Tickets · Motivos",
      title: "Eliminar motivo",
      description: (
        <>
          Se eliminará <strong className="font-semibold text-ink">{topic.name}</strong> del catálogo.
          Si algún ticket lo usa, el borrado se rechaza y tendrás que desactivarlo.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: () => run(topic.id, () => ticketTopicsApi.remove(topic.id)),
    });
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Motivos"
        summary={
          data
            ? `${data.total} ${data.total === 1 ? "motivo" : "motivos"} · cada uno decide a qué departamento se encola el ticket`
            : "Cargando los motivos…"
        }
        action={
          isAdmin && (
            <Button size="sm" onClick={() => setModal("nuevo")}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo motivo
            </Button>
          )
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por motivo o departamento…"
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
                  <Th>Motivo</Th>
                  <Th>Departamento</Th>
                  <Th>Prioridad</Th>
                  <Th>Línea de producto</Th>
                  <Th>Tickets</Th>
                  <Th>Estado</Th>
                  <Th>Actualizado</Th>
                  {isAdmin && <Th className="w-28 text-right">Acciones</Th>}
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((topic) => (
                  <Row key={topic.id} busy={busyId === topic.id}>
                    <Td className="text-[13px] font-medium text-ink">{topic.name}</Td>
                    <Td className="text-[12.5px] text-ink">{topic.defaultDepartmentName}</Td>
                    <Td>
                      <span
                        className={`inline-flex items-center rounded-edge border px-1.5 py-0.5 text-[11px] font-medium ${
                          priorityClass[topic.defaultPriority] ?? priorityClass.Normal
                        }`}
                      >
                        {topic.defaultPriority}
                      </span>
                    </Td>
                    <Td className="text-[12.5px] text-subtle">
                      {topic.requiresProductLine ? "Obligatoria" : "No se pide"}
                    </Td>
                    <Td className="text-[12.5px] text-subtle">{topic.ticketCount}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5 text-[12.5px]">
                        <span
                          aria-hidden
                          className={`h-[7px] w-[7px] rounded-full ${
                            topic.isActive ? "bg-brand-green" : "bg-line-strong"
                          }`}
                        />
                        <span className={topic.isActive ? "text-ink" : "text-subtle"}>
                          {topic.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-subtle">
                      {formatDateTime(topic.updatedAt)}
                    </Td>

                    {isAdmin && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Editar ${topic.name}`}
                            icon={Pencil}
                            onClick={() => setModal(topic)}
                            disabled={busyId === topic.id}
                          />
                          <RowAction
                            label={topic.isActive ? `Desactivar ${topic.name}` : `Activar ${topic.name}`}
                            icon={topic.isActive ? Ban : CheckCircle2}
                            onClick={() => askToggleActive(topic)}
                            disabled={busyId === topic.id}
                          />
                          <RowAction
                            label={`Eliminar ${topic.name}`}
                            icon={Trash2}
                            onClick={() => askDelete(topic)}
                            disabled={busyId === topic.id}
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
                <Tag className="h-6 w-6 text-faint" />
                <p className="text-[13.5px] text-faint">
                  {debouncedSearch || status !== "todos"
                    ? "Ningún motivo coincide con el filtro."
                    : "Todavía no hay motivos en el catálogo."}
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
              noun="motivos"
            />
          </div>
        )}
      </div>

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}

      {modal !== null && (
        <MotivoModal
          topic={modal === "nuevo" ? undefined : modal}
          departments={departments}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
