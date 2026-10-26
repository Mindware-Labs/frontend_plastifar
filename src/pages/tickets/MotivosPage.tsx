import {
  AlertOctagon,
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  Clock,
  Flag,
  Pencil,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { departmentsApi } from "../../api/departments";
import { ticketTopicsApi, type TicketTopicQuery } from "../../api/ticketTopics";
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
import { useAuth } from "../../context/useAuth";
import { useCatalogActions } from "../../hooks/useCatalogActions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { useRowRun } from "../../hooks/useRowRun";
import { useUrlNumber, useUrlState } from "../../hooks/useUrlState";
import { buildDepartmentFilterOptions } from "../../lib/departmentFilterOptions";
import { departmentPaths } from "../../lib/departments";
import { formatDateTime } from "../../lib/format";
import { staleClass } from "../../lib/listState";
import type {
  DepartmentResponse,
  TicketTopicListResponse,
  TicketTopicResponse,
} from "../../types/api";
import { MotivoModal } from "./MotivoModal";
import { FilterDropdown, type FilterOption } from "../../components/ui/FilterDropdown";
import { PAGE_SIZES } from "../../lib/pageSizes";

type StatusFilter = "todos" | "activos" | "inactivos";

const STATUS_KEYS: StatusFilter[] = ["todos", "activos", "inactivos"];
const PRIORITY_KEYS = ["todas", "Emergencia", "Alta", "Normal", "Baja"];

/** El tono no decora: dice cuánta prisa mete cada motivo en el SLA del ticket. */
const priorityClass: Record<string, string> = {
  Emergencia: "border-red-200 bg-red-50 text-red-800",
  Alta: "border-amber-200 bg-amber-50 text-amber-800",
  Normal: "border-line-strong bg-canvas text-ink",
  Baja: "border-line-strong bg-canvas text-subtle",
};

/** Gestión del catálogo de motivos y departamentos asociados. */
export function MotivosPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [departmentParam, setDepartmentParam] = useUrlState<string>("departamento", "todos");
  const [priority, setPriority] = useUrlState<string>("prioridad", "todas", PRIORITY_KEYS);
  const [search, setSearch] = useUrlState<string>("q", "");
  const [status, setStatus] = useUrlState<StatusFilter>("estado", "todos", STATUS_KEYS);
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);
  // Un id que no es numero (enlace editado a mano) cuenta como «todos».
  const departmentId: number | "todos" =
    departmentParam === "todos" || Number.isNaN(Number(departmentParam)) ? "todos" : Number(departmentParam);
  const { modal, setModal, busyId, setBusyId, ask, dialog } = useCatalogActions<TicketTopicResponse>();

  const debouncedSearch = useDebouncedValue(search, 300).trim();

  const { data, isStale, error, setPage, refresh } = usePagedList<
    TicketTopicQuery,
    TicketTopicListResponse
  >({
    fetch: ticketTopicsApi.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status,
      departmentId: departmentId === "todos" ? undefined : departmentId,
      priority: priority === "todas" ? undefined : priority,
    },
    fallbackError: "No se pudieron cargar los motivos",
    pageKey: "pagina",
  });

  useEffect(() => {
    departmentsApi.list().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const filtered =
    Boolean(debouncedSearch) || status !== "todos" || departmentId !== "todos" || priority !== "todas";

  function clearAll() {
    setSearch("");
    setDepartmentParam("todos");
    setPriority("todas");
    setStatus("todos");
  }

  const { actionError, run } = useRowRun(setBusyId, refresh);

  function askToggleActive(topic: TicketTopicResponse) {
    if (topic.isActive) {
      ask({
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
    ask({
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

  const departmentOptions = buildDepartmentFilterOptions(departments);
  // El camino, no el nombre: dos departamentos pueden llamarse igual.
  const departmentPathById = departmentPaths(departments);

  const priorityFilterOptions: FilterOption[] = [
    {
      value: "todas",
      label: "Todas las prioridades",
      icon: <Flag className="h-4 w-4 text-zinc-500" />,
    },
    {
      value: "Emergencia",
      label: "Emergencia",
      icon: <AlertOctagon className="h-4 w-4 text-brand-red" />,
    },
    {
      value: "Alta",
      label: "Alta",
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    },
    {
      value: "Normal",
      label: "Normal",
      icon: <CheckCircle2 className="h-4 w-4 text-zinc-500" />,
    },
    {
      value: "Baja",
      label: "Baja",
      icon: <Clock className="h-4 w-4 text-zinc-400" />,
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Motivos"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando los motivos…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "motivo" : "motivos"}
                  count={counts.all}
                  active={status === "todos"}
                  onClick={() => {
                    setStatus("todos");
                    setPage(1);
                  }}
                  tone="neutral"
                  title="Mostrar todos los motivos"
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
                  title="Filtrar por motivos activos"
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
                  title="Filtrar por motivos inactivos"
                />
              </>
            )}
          </HeaderCounts>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por motivo o departamento…"
              className="w-[280px]"
            />
            <FilterDropdown
              title="Seleccionar departamento"
              value={String(departmentId)}
              onChange={setDepartmentParam}
              options={departmentOptions}
              defaultIcon={<Building2 className="h-4 w-4 text-zinc-500" />}
              aria-label="Filtrar por departamento"
            />
            <FilterDropdown
              title="Seleccionar prioridad"
              value={priority}
              onChange={setPriority}
              options={priorityFilterOptions}
              defaultIcon={<Flag className="h-4 w-4 text-zinc-500" />}
              aria-label="Filtrar por prioridad"
            />

            {(search || departmentId !== "todos" || priority !== "todas") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDepartmentParam("todos");
                  setPriority("todas");
                }}
                title="Limpiar filtros"
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
                  <Th>Motivo</Th>
                  <Th>Departamento</Th>
                  <Th>Prioridad</Th>
                  <Th>Formulario sugerido</Th>
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
                    <Td className="text-[12.5px] text-ink">
                      {departmentPathById.get(topic.defaultDepartmentId) ?? topic.defaultDepartmentName}
                    </Td>
                    <Td>
                      <span
                        className={`inline-flex items-center rounded-edge border px-1.5 py-0.5 text-[11px] font-medium ${
                          priorityClass[topic.defaultPriority] ?? priorityClass.Normal
                        }`}
                      >
                        {topic.defaultPriority}
                      </span>
                    </Td>
                    <Td className="text-[12px]">
                      {topic.suggestedFormLabel ? (
                        <span className="inline-flex items-center gap-1 rounded bg-zinc-100 border border-zinc-200/80 px-2 py-0.5 font-medium text-zinc-800">
                          {topic.suggestedFormLabel}
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-normal">—</span>
                      )}
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

            {rows.length === 0 &&
              (filtered ? (
                <EmptyResult message="Ningún motivo coincide con el filtro." onClear={clearAll} />
              ) : (
                <div className="flex flex-col items-center gap-2 py-14 text-center">
                  <Tag className="h-6 w-6 text-faint" />
                  <p className="text-[13.5px] text-faint">Todavía no hay motivos en el catálogo.</p>
                </div>
              ))}

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

      {dialog}

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
