import { Building2, Check, Flag, ListTodo, Plus, Slash, Timer, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { departmentsApi } from "../../api/departments";
import { tasksApi, type TaskQuery } from "../../api/tasks";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { ColumnPicker, type ColumnOption } from "../../components/ui/ColumnPicker";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { EmptyResult } from "../../components/ui/EmptyResult";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { ClearFiltersButton, FilterDropdown } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { SelectBox } from "../../components/ui/SelectBox";
import { type TableSelectionAction } from "../../components/ui/TableSelectionBar";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { useSort } from "../../hooks/useSort";
import { useTablePageSelection } from "../../hooks/useTablePageSelection";
import { buildDepartmentFilterOptions } from "../../lib/departmentFilterOptions";
import { departmentPaths } from "../../lib/departments";
import { formatDateTime } from "../../lib/format";
import { useReceipts } from "../../context/useReceipts";
import { PriorityCell } from "../tickets/ticketCells";
import type { DepartmentResponse } from "../../types/api";
import type { TaskListResponse } from "../../types/tasks";
import { BulkTaskModal, type BulkModalMode } from "./BulkTaskModal";
import { TaskFormModal } from "./TaskFormModal";
import { TaskStatusCell, TASK_STATUS_FILTER_OPTIONS } from "./taskCells";

type ChipKey = "todas" | "mias" | "pendientes" | "enprogreso" | "completadas" | "vencidas";
type SortKey = "titulo" | "departamento" | "prioridad" | "estado" | "limite" | "fecha";

const COLUMNS: ColumnOption[] = [
  { id: "tarea", label: "Tarea", locked: true },
  { id: "asignado", label: "Asignado" },
  { id: "departamento", label: "Departamento" },
  { id: "prioridad", label: "Prioridad" },
  { id: "estado", label: "Estado" },
  { id: "cliente", label: "Cliente" },
  { id: "limite", label: "Fecha límite" },
  { id: "origen", label: "Canal" },
];

function formatDue(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  const hasTime = !value.includes("T00:00:00") && !value.includes("T23:59:59");
  return hasTime
    ? date.toLocaleString("es-DO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : date.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

export function TasksPage() {
  const navigate = useNavigate();
  const receipts = useReceipts();
  const { can } = usePermissions();
  const canCreate = can("tasks.create");
  const canEdit = can("tasks.edit");
  const canWrite = canCreate || canEdit;
  const canClose = can("tasks.close");

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("todos");
  const [priority, setPriority] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [chip, setChip] = useState<ChipKey>("todas");
  const { sort, sortOf } = useSort<SortKey>("fecha", "desc");
  const [pageSize, setPageSize] = useState(10);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(COLUMNS.map((column) => column.id));
  const [creating, setCreating] = useState(false);

  // Bulk actions state
  const [bulkModal, setBulkModal] = useState<BulkModalMode | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();

  function isVisible(id: string) {
    return visibleColumns.includes(id);
  }

  function loadDepartments() {
    setReferenceError(null);
    return departmentsApi
      .list()
      .then((rows) => setDepartments(rows.filter((row) => row.isActive)))
      .catch(() => setReferenceError("No se pudieron cargar los departamentos: el filtro de área queda vacío."));
  }

  useEffect(() => {
    void loadDepartments();
  }, []);

  const departmentOptions = useMemo(
    () => buildDepartmentFilterOptions(departments),
    [departments],
  );
  const departmentPathById = useMemo(
    () => departmentPaths(departments),
    [departments],
  );

  const { data, error, setPage, refresh } = usePagedList<TaskQuery, TaskListResponse>({
    fetch: tasksApi.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      chip: chip === "todas" ? undefined : chip,
      departmentId: departmentId === "todos" ? undefined : Number(departmentId),
      priority: priority === "todos" ? undefined : priority,
      status: status === "todos" ? undefined : status,
      sort: sort.key,
      dir: sort.dir,
    },
    fallbackError: "No se pudieron cargar las tareas",
  });

  const rows = useMemo(() => data?.items ?? [], [data?.items]);
  const counts = data?.counts;

  // Multi-row selection
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const { selectedIds, pageState, togglePage, toggleSelect, clearSelection } = useTablePageSelection(pageIds);

  const narrowFilters =
    (departmentId !== "todos" ? 1 : 0) + (priority !== "todos" ? 1 : 0) + (status !== "todos" ? 1 : 0);
  const unfiltered = chip === "todas" && narrowFilters === 0 && !debouncedSearch;

  function clearNarrowFilters() {
    setDepartmentId("todos");
    setPriority("todos");
    setStatus("todos");
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setChip("todas");
    clearNarrowFilters();
  }

  // Bulk actions definition
  const bulkActions: TableSelectionAction[] = useMemo(() => {
    const actions: TableSelectionAction[] = [];
    if (canWrite) {
      actions.push(
        {
          key: "asignar",
          label: "Asignar",
          icon: <UserCheck className="h-3.5 w-3.5 text-zinc-600" />,
          onClick: () => setBulkModal("asignar"),
        },
        {
          key: "prioridad",
          label: "Prioridad",
          icon: <Flag className="h-3.5 w-3.5 text-zinc-600" />,
          onClick: () => setBulkModal("prioridad"),
        },
        {
          key: "estado",
          label: "Estado",
          icon: <Timer className="h-3.5 w-3.5 text-zinc-600" />,
          onClick: () => setBulkModal("estado"),
        },
      );
    }
    if (canClose) {
      actions.push(
        {
          key: "completar",
          label: "Completar",
          icon: <Check className="h-3.5 w-3.5 text-emerald-600" />,
          onClick: () => setBulkModal("completar"),
        },
        {
          key: "cancelar",
          label: "Cancelar",
          icon: <Slash className="h-3.5 w-3.5 text-red-600" />,
          onClick: () => setBulkModal("cancelar"),
        },
      );
    }
    return actions;
  }, [canWrite, canClose]);

  return (
    <>
      <ModuleHeader
        title="Tareas"
        summary={
          counts ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <HeaderTag
                label={counts.all === 1 ? "tarea" : "tareas"}
                count={counts.all}
                active={chip === "todas"}
                onClick={() => { setChip("todas"); setPage(1); }}
                tone="neutral"
                title="Mostrar todas las tareas"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label="mías"
                count={counts.mine}
                active={chip === "mias"}
                onClick={() => { setChip("mias"); setPage(1); }}
                tone="blue"
                title="Tareas asignadas a mí"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label="pendientes"
                count={counts.pending}
                active={chip === "pendientes"}
                onClick={() => { setChip("pendientes"); setPage(1); }}
                tone="neutral"
                dot
                title="Filtrar por pendientes"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label="en progreso"
                count={counts.inProgress}
                active={chip === "enprogreso"}
                onClick={() => { setChip("enprogreso"); setPage(1); }}
                tone="amber"
                dot
                title="Filtrar por en progreso"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label="completadas"
                count={counts.completed}
                active={chip === "completadas"}
                onClick={() => { setChip("completadas"); setPage(1); }}
                tone="emerald"
                dot
                title="Filtrar por completadas"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label="vencidas"
                count={counts.overdue}
                active={chip === "vencidas"}
                onClick={() => { setChip("vencidas"); setPage(1); }}
                tone="red"
                dot
                title="Tareas abiertas con fecha límite pasada"
              />
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando las tareas…
            </span>
          )
        }
        action={
          canWrite ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva tarea
            </Button>
          ) : undefined
        }
      />

      {referenceError !== null && (
        <ErrorRetry className="mb-3" onRetry={() => void loadDepartments()}>{referenceError}</ErrorRetry>
      )}
      {error && <ErrorRetry className="mb-3" onRetry={refresh}>{error}</ErrorRetry>}

      <ListPanel
        selection={
          selectedIds.size > 0
            ? {
                count: selectedIds.size,
                pageState,
                busy: Boolean(bulkModal),
                onTogglePage: togglePage,
                onClear: clearSelection,
                actions: bulkActions,
              }
            : undefined
        }
        toolbar={
          <div className="flex w-full flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por título, instrucciones, asignado o cliente…"
              className="w-[280px]"
            />
            <FilterDropdown
              title="Seleccionar departamento"
              aria-label="Filtrar por departamento"
              value={departmentId}
              onChange={setDepartmentId}
              searchable
              searchPlaceholder="Buscar departamento…"
              defaultIcon={<Building2 className="h-3.5 w-3.5 text-zinc-500" />}
              options={departmentOptions}
            />
            <FilterDropdown
              title="Seleccionar prioridad"
              aria-label="Filtrar por prioridad"
              value={priority}
              onChange={setPriority}
              defaultIcon={<Flag className="h-3.5 w-3.5 text-zinc-500" />}
              options={[
                { value: "todos", label: "Todas las prioridades" },
                { value: "Emergencia", label: "Emergencia" },
                { value: "Alta", label: "Alta" },
                { value: "Normal", label: "Normal" },
                { value: "Baja", label: "Baja" },
              ]}
            />
            <FilterDropdown
              title="Seleccionar estado"
              aria-label="Filtrar por estado"
              value={status}
              onChange={setStatus}
              defaultIcon={<ListTodo className="h-3.5 w-3.5 text-zinc-500" />}
              options={TASK_STATUS_FILTER_OPTIONS}
            />
            {(search || narrowFilters > 0) && (
              <ClearFiltersButton onClick={() => { setSearch(""); clearNarrowFilters(); }} />
            )}
            <div className="ml-auto">
              <ColumnPicker columns={COLUMNS} visible={visibleColumns} onChange={setVisibleColumns} label="Columnas" />
            </div>
          </div>
        }
        footer={
          data !== null && (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="tareas"
            />
          )
        }
      >
        {data === null ? (
          error === null && <TableSkeleton rows={pageSize} columns={9} />
        ) : rows.length === 0 ? (
          <EmptyResult
            message={unfiltered ? "Todavía no hay tareas registradas." : "Ninguna tarea coincide con este filtro o búsqueda."}
            onClear={unfiltered ? undefined : clearFilters}
          />
        ) : (
          <div className="plf-results-in">
            <DataTable>
              <thead>
                <HeadRow>
                  <Th className="w-9 px-2 text-center">
                    <SelectBox
                      checked={pageState}
                      label={pageState === true ? "Quitar selección de la página" : "Seleccionar toda la página"}
                      onToggle={togglePage}
                    />
                  </Th>
                  <Th sort={sortOf("titulo")}>Tarea</Th>
                  {isVisible("asignado") && <Th>Asignado</Th>}
                  {isVisible("departamento") && <Th sort={sortOf("departamento")}>Departamento</Th>}
                  {isVisible("prioridad") && <Th sort={sortOf("prioridad")}>Prioridad</Th>}
                  {isVisible("estado") && <Th sort={sortOf("estado")}>Estado</Th>}
                  {isVisible("cliente") && <Th>Cliente</Th>}
                  {isVisible("limite") && <Th sort={sortOf("limite")}>Fecha límite</Th>}
                  {isVisible("origen") && <Th>Canal</Th>}
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((task) => {
                  const isChecked = selectedIds.has(task.id);
                  return (
                    <Row
                      key={task.id}
                      onClick={() => navigate(`/tareas/${task.id}`)}
                      className={`cursor-pointer ${isChecked ? "bg-brand-red/[0.03]" : ""}`}
                    >
                      <Td className="w-9 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <SelectBox
                          checked={isChecked}
                          label={`Seleccionar tarea ${task.number}`}
                          onToggle={() => toggleSelect(task.id)}
                        />
                      </Td>
                      <Td>
                        <Link
                          to={`/tareas/${task.id}`}
                          className="block min-w-0 rounded-edge outline-none focus-visible:ring-3 focus-visible:ring-brand-red/20"
                        >
                          <span className="block text-[13px] font-medium text-ink hover:underline">{task.title}</span>
                          <span className="text-[12px] tabular-nums text-brand-gray">{task.number}</span>
                        </Link>
                      </Td>
                      {isVisible("asignado") && (
                        <Td>
                          {task.assignedStaffName ? (
                            <span className="inline-flex items-center gap-2">
                              <Avatar name={task.assignedStaffName} seed={task.assignedStaffId ?? task.id} size={22} />
                              <span className="whitespace-nowrap text-[12.5px] text-zinc-800">{task.assignedStaffName}</span>
                            </span>
                          ) : (
                            <span className="text-[12.5px] text-zinc-400">Sin asignar</span>
                          )}
                        </Td>
                      )}
                      {isVisible("departamento") && (
                        <Td>
                          <span className="text-[12.5px] text-zinc-700">
                            {departmentPathById.get(task.departmentId) ?? task.departmentName}
                          </span>
                        </Td>
                      )}
                      {isVisible("prioridad") && <Td><PriorityCell priority={task.priority} /></Td>}
                      {isVisible("estado") && <Td><TaskStatusCell status={task.status} /></Td>}
                      {isVisible("cliente") && (
                        <Td>
                          <span className="text-[12.5px] text-zinc-700">{task.clientName ?? "—"}</span>
                        </Td>
                      )}
                      {isVisible("limite") && (
                        <Td>
                          <span className={`text-[12.5px] tabular-nums ${task.isOverdue ? "font-medium text-red-700" : "text-zinc-600"}`}>
                            {formatDue(task.dueDate)}
                          </span>
                          {task.isOverdue && <span className="ml-1.5 text-[11px] font-medium text-red-700">Vencida</span>}
                        </Td>
                      )}
                      {isVisible("origen") && (
                        <Td>
                          <span className="text-[12.5px] text-zinc-600" title={formatDateTime(task.createdAt)}>
                            {task.origin === "Correo" ? "Correo" : "Manual"}
                          </span>
                        </Td>
                      )}
                    </Row>
                  );
                })}
              </tbody>
            </DataTable>
          </div>
        )}
      </ListPanel>

      {bulkModal && (
        <BulkTaskModal
          mode={bulkModal}
          taskIds={Array.from(selectedIds)}
          onClose={() => setBulkModal(null)}
          onSuccess={() => {
            setBulkModal(null);
            clearSelection();
            refresh();
          }}
        />
      )}

      {creating && (
        <TaskFormModal
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            receipts.done({
              action: "crear-tarea",
              title: "Tarea creada",
              detail: `${saved.number} · ${saved.title}`,
            });
            navigate(`/tareas/${saved.id}`);
          }}
        />
      )}
    </>
  );
}
