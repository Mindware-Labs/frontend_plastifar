import { Plus, SlidersHorizontal, Ticket as TicketIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { departmentsApi } from "../../api/departments";
import { ticketsApi } from "../../api/tickets";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th, type SortDir } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { Modal } from "../../components/ui/Modal";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { SelectBox } from "../../components/ui/SelectBox";
import { Spinner } from "../../components/ui/Spinner";
import { useEmailCounts } from "../../context/useEmailCounts";
import { useReceipts } from "../../context/useReceipts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { formatActivityDate, formatSlaRemaining } from "../../lib/format";
import type {
  DepartmentResponse,
  TicketCounts,
  TicketListItemResponse,
  TicketListResponse,
  TicketQuery,
  TicketStaffOptionResponse,
} from "../../types/api";
import { CreateTicketModal } from "./CreateTicketModal";
import { AssigneeCell, PriorityCell, SlaCell, StatusCell } from "./ticketCells";
import { TicketSelectionBar } from "./TicketSelectionBar";

type TicketFilterKey = "todos" | "abiertos" | "por-vencer" | "vencidos" | "espera" | "cerrados";
type SortKey = "numero" | "asunto" | "cliente" | "departamento" | "prioridad" | "estado" | "sla" | "actividad";

interface TicketFilter {
  key: TicketFilterKey;
  label: string;
  countKey: keyof TicketCounts;
}

const filters: TicketFilter[] = [
  { key: "todos", label: "Todos", countKey: "all" },
  { key: "abiertos", label: "Abiertos", countKey: "open" },
  { key: "por-vencer", label: "Por vencer", countKey: "upcoming" },
  { key: "vencidos", label: "Vencidos", countKey: "overdue" },
  { key: "espera", label: "En espera del cliente", countKey: "waitingOnClient" },
  { key: "cerrados", label: "Cerrados", countKey: "closed" },
];

// A la vista van las que marcan el trabajo del dia (SLA); el resto queda en el menu.
const PRIMARY_FILTER_KEYS: TicketFilterKey[] = ["todos", "abiertos", "por-vencer", "vencidos"];
const primaryFilters = filters.filter((f) => PRIMARY_FILTER_KEYS.includes(f.key));
const secondaryFilters = filters.filter((f) => !PRIMARY_FILTER_KEYS.includes(f.key));

// Tabla de anchos fijos: el asunto absorbe lo que sobra y las columnas secundarias entran por escalones.
const columns: { key: SortKey; label: string; className: string }[] = [
  { key: "numero", label: "Número", className: "w-[108px]" },
  { key: "asunto", label: "Asunto", className: "" },
  { key: "cliente", label: "Cliente", className: "hidden w-[164px] lg:table-cell" },
  { key: "departamento", label: "Departamento", className: "hidden w-[136px] 2xl:table-cell" },
  { key: "prioridad", label: "Prioridad", className: "hidden w-[112px] md:table-cell" },
  { key: "estado", label: "Estado", className: "w-[128px]" },
  { key: "sla", label: "SLA", className: "w-[128px]" },
  { key: "actividad", label: "Actividad", className: "hidden w-[124px] xl:table-cell" },
];

const SELECT_COLUMN = "w-10";
const ASSIGNED_COLUMN = "hidden w-[160px] lg:table-cell";

const priorityOptions = [
  { value: "Emergencia", label: "Emergencia" },
  { value: "Alta", label: "Alta" },
  { value: "Normal", label: "Normal" },
  { value: "Baja", label: "Baja" },
];

const STATUS_MENU_WIDTH = 224;

interface TicketStatusMenuProps {
  options: TicketFilter[];
  activeKey: TicketFilterKey;
  counts?: TicketCounts;
  onSelect: (key: TicketFilterKey) => void;
}

/** Vistas de estado menos usadas, en un panel flotante (mismo patron que el filtro de la bandeja de correo). */
function TicketStatusMenu({ options, activeKey, counts, onSelect }: TicketStatusMenuProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const active = options.find((option) => option.key === activeKey);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function handleViewportChange() {
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ top: rect.bottom + 6, left: Math.max(8, rect.right - STATUS_MENU_WIDTH) });
    setOpen(true);
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={active ? `Más vistas (activa: ${active.label})` : "Más vistas"}
        title={active ? `Vista activa: ${active.label}` : "Más vistas"}
        data-active={Boolean(active)}
        className="relative flex h-8 w-8 items-center justify-center rounded-edge border border-line-strong
          bg-white text-brand-gray outline-none transition-colors hover:border-zinc-400 hover:text-ink
          focus-visible:border-brand-red focus-visible:ring-3 focus-visible:ring-brand-red/10
          data-[active=true]:border-brand-red data-[active=true]:bg-brand-red data-[active=true]:text-white
          data-[active=true]:hover:border-brand-red-dark data-[active=true]:hover:bg-brand-red-dark"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>

      {open &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label="Más vistas de estado"
            style={{ position: "fixed", top: anchor.top, left: anchor.left, width: STATUS_MENU_WIDTH }}
            className="animate-plf-popover-in z-[60] flex flex-col gap-0.5 rounded-edge border border-line
              bg-white p-1.5 shadow-[0_4px_8px_rgba(27,27,29,0.04),0_24px_48px_-20px_rgba(27,27,29,0.28)]"
          >
            {options.map(({ key, label, countKey }) => {
              const isActive = key === activeKey;
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onSelect(key);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between gap-2 rounded-edge px-2.5 py-1.5 text-left
                    text-[12.5px] font-medium transition-colors ${
                      isActive ? "bg-brand-red/[0.06] text-brand-red-dark" : "text-ink hover:bg-fill"
                    }`}
                >
                  <span>{label}</span>
                  <span
                    className={`rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums ${
                      isActive ? "bg-brand-red/15 text-brand-red-dark" : "bg-fill text-subtle"
                    }`}
                  >
                    {counts?.[countKey] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Bandeja de tickets: cada fila abre el detalle; marcar filas cambia la barra de criterios por la de acciones. */
export function TicketsPage() {
  const navigate = useNavigate();
  const receipts = useReceipts();
  const { onTicketsChanged } = useEmailCounts();

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TicketFilterKey>("todos");
  const [departmentId, setDepartmentId] = useState<number | "todos">("todos");
  const [priority, setPriority] = useState<string>("todas");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "actividad", dir: "desc" });
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search).trim();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkModal, setBulkModal] = useState<"asignar" | "prioridad" | null>(null);
  const [bulkStaffId, setBulkStaffId] = useState("");
  const [bulkPriority, setBulkPriority] = useState("Normal");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [staffOptions, setStaffOptions] = useState<TicketStaffOptionResponse[]>([]);

  useEffect(() => {
    departmentsApi.list().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  const { data, isStale, error, setPage, refresh } = usePagedList<TicketQuery, TicketListResponse>({
    fetch: ticketsApi.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      departmentId: departmentId === "todos" ? undefined : departmentId,
      priority: priority === "todas" ? undefined : priority,
      status: filter,
      sort: sort.key,
      dir: sort.dir,
    },
    fallbackError: "No se pudieron cargar los tickets",
  });

  useEffect(() => onTicketsChanged(refresh), [onTicketsChanged, refresh]);

  const rows: TicketListItemResponse[] = data?.items ?? [];
  const counts = data?.counts;
  const hasCriteria =
    Boolean(debouncedSearch) || filter !== "todos" || departmentId !== "todos" || priority !== "todas";

  const visibleIds = rows.map((row) => row.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));
  const pageState: boolean | "mixed" = allVisibleSelected ? true : someVisibleSelected ? "mixed" : false;

  // La barra de seleccion entra y sale animada sobre el sitio de los criterios, como en correo.
  const isSelecting = selectedIds.size > 0;
  const [prevSelecting, setPrevSelecting] = useState(isSelecting);
  const [selectionExiting, setSelectionExiting] = useState(false);
  const [criteriaExiting, setCriteriaExiting] = useState(false);
  const [preservedCount, setPreservedCount] = useState(0);

  if (isSelecting && preservedCount !== selectedIds.size) setPreservedCount(selectedIds.size);
  if (prevSelecting !== isSelecting) {
    setPrevSelecting(isSelecting);
    setSelectionExiting(!isSelecting);
    setCriteriaExiting(isSelecting);
  }

  useEffect(() => {
    if (!selectionExiting) return;
    const timer = setTimeout(() => setSelectionExiting(false), 180);
    return () => clearTimeout(timer);
  }, [selectionExiting]);

  useEffect(() => {
    if (!criteriaExiting) return;
    const timer = setTimeout(() => setCriteriaExiting(false), 160);
    return () => clearTimeout(timer);
  }, [criteriaExiting]);

  useEffect(() => {
    if (!isSelecting) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && bulkModal === null) setSelectedIds(new Set());
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSelecting, bulkModal]);

  const showSelection = isSelecting || selectionExiting;
  const showCriteria = !isSelecting || criteriaExiting;

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleIds.forEach((id) => (allVisibleSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function clearCriteria() {
    setSearch("");
    setFilter("todos");
    setDepartmentId("todos");
    setPriority("todas");
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function openBulkAssign() {
    if (staffOptions.length === 0) {
      ticketsApi
        .createOptions()
        .then((opts) => setStaffOptions(opts.assignableStaff))
        .catch(() => {});
    }
    setBulkModal("asignar");
  }

  async function runBulk(
    action: "asignar-lote" | "prioridad-lote",
    request: () => Promise<{ updatedCount: number; totalRequested: number }>,
    title: string,
    failedTitle: string,
  ) {
    setBulkSubmitting(true);
    try {
      const result = await request();
      setBulkModal(null);
      setSelectedIds(new Set());
      refresh();
      const skipped = result.totalRequested - result.updatedCount;
      receipts.done({
        action,
        title,
        detail:
          skipped > 0
            ? `${result.updatedCount} de ${result.totalRequested} · ${skipped} omitidos por estar cerrados o sin permiso`
            : `${result.updatedCount} ${result.updatedCount === 1 ? "ticket" : "tickets"}`,
      });
    } catch (err) {
      receipts.failed({
        action,
        title: failedTitle,
        detail: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBulkSubmitting(false);
    }
  }

  const bulkIds = () => Array.from(selectedIds);

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Tickets"
        summary={
          counts ? (
            <span className="inline-flex flex-wrap items-center gap-x-2 tabular-nums">
              <span>
                {counts.all} {counts.all === 1 ? "ticket" : "tickets"}
              </span>
              <span aria-hidden className="text-line-strong">·</span>
              <span>{counts.open} abiertos</span>
              <span aria-hidden className="text-line-strong">·</span>
              <span className={counts.overdue > 0 ? "font-semibold text-brand-red" : ""}>
                {counts.overdue} {counts.overdue === 1 ? "vencido" : "vencidos"}
              </span>
              <span aria-hidden className="text-line-strong">·</span>
              <span>{counts.waitingOnClient} en espera del cliente</span>
            </span>
          ) : (
            "Cargando los tickets…"
          )
        }
        action={
          <Button size="sm" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-[15px] w-[15px]" />
            Nuevo ticket
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="mb-3 grid">
          {showCriteria && (
            <div
              inert={criteriaExiting ? true : undefined}
              className={`col-start-1 row-start-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${
                criteriaExiting ? "animate-plf-tabs-out" : "animate-plf-tabs-in"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar por número, asunto o cliente…"
                  className="w-[260px]"
                />
                <Select
                  size="sm"
                  className="w-[168px]"
                  aria-label="Filtrar por departamento"
                  value={String(departmentId)}
                  onChange={(next) => setDepartmentId(next === "todos" ? "todos" : Number(next))}
                  options={[
                    { value: "todos", label: "Todos los departamentos" },
                    ...departments.map((d) => ({ value: String(d.id), label: d.name })),
                  ]}
                />
                <Select
                  size="sm"
                  className="w-[156px]"
                  aria-label="Filtrar por prioridad"
                  value={priority}
                  onChange={setPriority}
                  options={[{ value: "todas", label: "Todas las prioridades" }, ...priorityOptions]}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {primaryFilters.map(({ key, label, countKey }) => (
                  <FilterChip
                    key={key}
                    label={label}
                    count={counts?.[countKey] ?? 0}
                    active={filter === key}
                    onClick={() => setFilter(key)}
                  />
                ))}
                <TicketStatusMenu
                  options={secondaryFilters}
                  activeKey={filter}
                  counts={counts}
                  onSelect={setFilter}
                />
              </div>
            </div>
          )}

          {showSelection && (
            <div className="col-start-1 row-start-1 self-center" inert={selectionExiting ? true : undefined}>
              <TicketSelectionBar
                count={isSelecting ? selectedIds.size : preservedCount}
                pageState={pageState}
                busy={bulkSubmitting}
                isExiting={selectionExiting}
                onTogglePage={togglePage}
                onClear={() => setSelectedIds(new Set())}
                onAssign={openBulkAssign}
                onPriority={() => setBulkModal("prioridad")}
              />
            </div>
          )}
        </div>

        {error && (
          <div className="mb-3">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {!data ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          // Atenuada mientras llega la pagina nueva: la anterior se queda para no dar un salto en blanco.
          <div className={`transition-opacity ${isStale ? "opacity-60" : ""}`}>
            <DataTable fixed>
              <thead>
                <HeadRow>
                  <Th className={SELECT_COLUMN}>
                    <SelectBox
                      checked={pageState}
                      label={pageState === true ? "Quitar la selección de esta página" : "Seleccionar toda la página"}
                      onToggle={togglePage}
                    />
                  </Th>
                  {columns.map(({ key, label, className }) => (
                    <Th
                      key={key}
                      className={className}
                      sort={{ dir: sort.key === key ? sort.dir : null, onToggle: () => toggleSort(key) }}
                    >
                      {label}
                    </Th>
                  ))}
                  <Th className={ASSIGNED_COLUMN}>Asignado</Th>
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const checked = selectedIds.has(t.id);
                  const sla = formatSlaRemaining(t.resolutionDueAt, Boolean(t.pausedAt), t.status, t.closedAt);
                  const activity = formatActivityDate(t.lastActivityAt);
                  const client = t.clientName && t.clientName !== "Sin cliente" ? t.clientName : null;
                  const clientCode = t.clientCode && t.clientCode !== "-" ? t.clientCode : null;
                  const department =
                    t.departmentName && t.departmentName !== "Sin departamento" ? t.departmentName : null;
                  const open = () => navigate(`/tickets/${t.id}`);

                  return (
                    <Row
                      key={t.id}
                      tabIndex={0}
                      data-checked={checked}
                      onClick={open}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          open();
                        }
                      }}
                      className="group cursor-pointer outline-none data-[checked=true]:bg-fill/70
                        focus-visible:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2
                        focus-visible:outline-brand-red/50"
                    >
                      <Td className={SELECT_COLUMN}>
                        <SelectBox
                          checked={checked}
                          label={`Seleccionar ${t.number}`}
                          onToggle={() => toggleSelect(t.id)}
                          className={
                            checked || isSelecting
                              ? ""
                              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                          }
                        />
                      </Td>

                      <Td className={columns[0].className}>
                        <span className="font-heading text-[11.5px] font-semibold tracking-[0.02em] tabular-nums text-brand-gray">
                          {t.number}
                        </span>
                      </Td>

                      <Td className={columns[1].className}>
                        <p className="truncate text-[13px] font-medium text-ink" title={t.subject}>
                          {t.subject}
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] text-subtle">
                          {t.topicName ?? "Sin motivo"}
                          {department && <span className="2xl:hidden"> · {department}</span>}
                          {t.productLineName && <> · {t.productLineName}</>}
                        </p>
                      </Td>

                      <Td className={columns[2].className}>
                        {client ? (
                          <>
                            <p className="truncate text-[12.5px] font-medium text-ink" title={client}>
                              {client}
                            </p>
                            {(t.contactName ?? clientCode) && (
                              <p className="mt-0.5 truncate text-[11.5px] text-subtle">
                                {t.contactName ?? clientCode}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-[12.5px] text-faint">Sin cliente</span>
                        )}
                      </Td>

                      <Td className={`${columns[3].className} truncate text-[12.5px] text-brand-gray`}>
                        {department ?? <span className="text-faint">—</span>}
                      </Td>

                      <Td className={columns[4].className}>
                        <PriorityCell priority={t.priority} />
                      </Td>

                      <Td className={columns[5].className}>
                        <StatusCell status={t.status} />
                      </Td>

                      <Td className={columns[6].className}>
                        <SlaCell sla={sla} />
                      </Td>

                      <Td className={`${columns[7].className} whitespace-nowrap text-[12px] tabular-nums text-subtle`}>
                        <span title={activity.full}>{activity.compact}</span>
                      </Td>

                      <Td className={ASSIGNED_COLUMN}>
                        <AssigneeCell id={t.assignedStaffId} name={t.assignedStaffName} />
                      </Td>
                    </Row>
                  );
                })}
              </tbody>
            </DataTable>

            {rows.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <TicketIcon className="h-6 w-6 text-faint" />
                {hasCriteria ? (
                  <>
                    <p className="text-[13.5px] text-faint">Ningún ticket coincide con estos criterios.</p>
                    <Button variant="ghost" size="sm" onClick={clearCriteria}>
                      Quitar filtros
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-[13.5px] text-faint">Todavía no hay tickets.</p>
                    <p className="max-w-xs text-[12.5px] text-faint">
                      Se crean desde un correo de la bandeja o a mano con «Nuevo ticket».
                    </p>
                  </>
                )}
              </div>
            )}

            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="tickets"
            />
          </div>
        )}
      </div>

      {createModalOpen && (
        <CreateTicketModal
          onClose={() => setCreateModalOpen(false)}
          onCreated={(created) => {
            refresh();
            navigate(`/tickets/${created.id}`);
            receipts.done({
              action: "crear-ticket",
              title: "Ticket creado",
              detail: `${created.code} · ${created.subject}`,
            });
          }}
        />
      )}

      {bulkModal === "asignar" && (
        <Modal
          eyebrow="Tickets · Acciones en lote"
          title="Asignar tickets"
          description={`Elige quién atenderá los ${selectedIds.size} tickets seleccionados.`}
          onClose={() => {
            if (!bulkSubmitting) setBulkModal(null);
          }}
          footer={({ requestClose }) => (
            <>
              <Button type="button" variant="secondary" onClick={requestClose} disabled={bulkSubmitting}>
                Cancelar
              </Button>
              <Button
                type="button"
                isLoading={bulkSubmitting}
                onClick={() =>
                  runBulk(
                    "asignar-lote",
                    () =>
                      ticketsApi.bulkAssign({
                        ticketIds: bulkIds(),
                        staffId: bulkStaffId ? Number(bulkStaffId) : null,
                      }),
                    bulkStaffId ? "Tickets asignados" : "Tickets sin asignar",
                    "No se pudieron asignar",
                  )
                }
              >
                Asignar
              </Button>
            </>
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bulk-staff" className="font-heading text-[11.5px] font-semibold text-faint">
                Colaborador
              </label>
              <Select
                id="bulk-staff"
                value={bulkStaffId}
                onChange={setBulkStaffId}
                options={[
                  { value: "", label: "Sin asignar" },
                  ...staffOptions.map((s) => ({ value: String(s.id), label: s.fullName })),
                ]}
              />
            </div>
            <p className="text-[12px] leading-relaxed text-subtle">
              Solo se asignan los tickets de departamentos a los que esa persona tiene acceso. Los
              solucionados o cancelados se omiten.
            </p>
          </div>
        </Modal>
      )}

      {bulkModal === "prioridad" && (
        <Modal
          eyebrow="Tickets · Acciones en lote"
          title="Cambiar prioridad"
          description={`Nueva prioridad para los ${selectedIds.size} tickets seleccionados.`}
          onClose={() => {
            if (!bulkSubmitting) setBulkModal(null);
          }}
          footer={({ requestClose }) => (
            <>
              <Button type="button" variant="secondary" onClick={requestClose} disabled={bulkSubmitting}>
                Cancelar
              </Button>
              <Button
                type="button"
                isLoading={bulkSubmitting}
                onClick={() =>
                  runBulk(
                    "prioridad-lote",
                    () => ticketsApi.bulkPriority({ ticketIds: bulkIds(), priority: bulkPriority }),
                    `Prioridad cambiada a ${bulkPriority}`,
                    "No se pudo cambiar la prioridad",
                  )
                }
              >
                Cambiar prioridad
              </Button>
            </>
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bulk-priority" className="font-heading text-[11.5px] font-semibold text-faint">
                Prioridad
              </label>
              <Select id="bulk-priority" value={bulkPriority} onChange={setBulkPriority} options={priorityOptions} />
            </div>
            <p className="text-[12px] leading-relaxed text-subtle">
              La fecha límite de SLA se recalcula con la política de la nueva prioridad.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
