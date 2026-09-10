import {
  AlertOctagon,
  AlertTriangle,
  Boxes,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Factory,
  Flag,
  LayoutGrid,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Ticket as TicketIcon,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { TicketFilterDropdown, type TicketFilterOption } from "./TicketFilterDropdown";
import { departmentsApi } from "../../api/departments";
import { ticketsApi } from "../../api/tickets";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th, type SortDir } from "../../components/ui/DataTable";
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

// Solo dos tags visibles en la barra principal; el resto queda en el menú Más.
const PRIMARY_FILTER_KEYS: TicketFilterKey[] = ["todos", "abiertos"];
const primaryFilters = filters.filter((f) => PRIMARY_FILTER_KEYS.includes(f.key));
const secondaryFilters = filters.filter((f) => !PRIMARY_FILTER_KEYS.includes(f.key));

// Tabla de anchos fijos: el asunto absorbe lo que sobra y las columnas secundarias entran por escalones.
const columns: { key: SortKey; label: string; className: string }[] = [
  { key: "numero", label: "Número", className: "w-[100px]" },
  { key: "asunto", label: "Asunto", className: "" },
  { key: "cliente", label: "Cliente", className: "hidden w-[160px] lg:table-cell" },
  { key: "departamento", label: "Departamento", className: "hidden w-[125px] 2xl:table-cell" },
  { key: "prioridad", label: "Prioridad", className: "hidden w-[96px] md:table-cell" },
  { key: "estado", label: "Estado", className: "w-[115px]" },
  { key: "sla", label: "SLA", className: "w-[110px]" },
  { key: "actividad", label: "Actividad", className: "hidden w-[120px] xl:table-cell" },
];

const SELECT_COLUMN = "w-10 px-2 text-center";
const ASSIGNED_COLUMN = "hidden w-[145px] lg:table-cell";

const clientColors = [
  "bg-sky-400",
  "bg-teal-400",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-pink-400",
  "bg-amber-500",
  "bg-blue-500",
];

function getClientDotColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return clientColors[Math.abs(hash) % clientColors.length];
}

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

  const active = options.find((option) => option.key === activeKey);
  const activeCount = active && counts ? counts[active.countKey] : 0;
  const hasOverdueSecondary = (counts?.overdue ?? 0) > 0;

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
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] shadow-2xs transition-all outline-none select-none cursor-pointer active:scale-[0.98] ${
          active
            ? "border border-zinc-300 bg-zinc-100 font-semibold text-zinc-900"
            : "border border-zinc-200 bg-white font-medium text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
        <span>{active ? active.label : "Más"}</span>
        {active ? (
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10.5px] font-bold tabular-nums ${
              active.key === "vencidos" && activeCount > 0
                ? "bg-red-100 text-brand-red"
                : "bg-zinc-200 text-zinc-800"
            }`}
          >
            {activeCount}
          </span>
        ) : (
          hasOverdueSecondary && (
            <span className="h-1.5 w-1.5 rounded-full bg-brand-red" title="Hay tickets vencidos" />
          )
        )}
        <ChevronDown
          className={`h-3 w-3 text-zinc-400 transition-transform duration-150 ${open ? "rotate-180 text-zinc-700" : ""}`}
        />
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
            className="animate-plf-popover-in z-[60] flex flex-col gap-0.5 rounded-lg border border-zinc-200/90
              bg-white p-1 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)]"
          >
            <div className="select-none px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-400">
              Vistas de estado
            </div>
            {options.map(({ key, label, countKey }) => {
              const isActive = key === activeKey;
              const count = counts?.[countKey] ?? 0;
              const isOverdue = key === "vencidos" && count > 0;
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
                  className={`flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left
                    text-[12.5px] transition-colors cursor-pointer ${
                      isActive
                        ? "bg-zinc-100 font-semibold text-zinc-900"
                        : "font-medium text-zinc-700 hover:bg-zinc-100/80 hover:text-zinc-900"
                    }`}
                >
                  <span className={isOverdue ? "font-semibold text-brand-red" : ""}>{label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10.5px] font-bold tabular-nums ${
                      isOverdue
                        ? "bg-red-50 text-brand-red font-bold"
                        : isActive
                        ? "bg-zinc-200 text-zinc-900"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {count}
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

  const departmentOptions: TicketFilterOption[] = [
    {
      value: "todos",
      label: "Todos los departamentos",
      icon: <LayoutGrid className="h-4 w-4 text-zinc-500" />,
    },
    ...departments.map((d) => {
      const name = d.name.toLowerCase();
      let icon = <Building2 className="h-4 w-4 text-zinc-500" />;
      if (name.includes("almac")) {
        icon = <Boxes className="h-4 w-4 text-amber-600" />;
      } else if (name.includes("admin")) {
        icon = <Briefcase className="h-4 w-4 text-blue-600" />;
      } else if (name.includes("calidad")) {
        icon = <ShieldCheck className="h-4 w-4 text-emerald-600" />;
      } else if (name.includes("producc")) {
        icon = <Factory className="h-4 w-4 text-purple-600" />;
      } else if (name.includes("manten")) {
        icon = <Wrench className="h-4 w-4 text-orange-600" />;
      } else if (name.includes("ventas") || name.includes("comercial")) {
        icon = <TrendingUp className="h-4 w-4 text-cyan-600" />;
      }
      return {
        value: String(d.id),
        label: d.name,
        icon,
      };
    }),
  ];

  const priorityFilterOptions: TicketFilterOption[] = [
    {
      value: "todas",
      label: "Todas las prioridades",
      icon: <Flag className="h-4 w-4 text-zinc-500" />,
    },
    {
      value: "Emergencia",
      label: "Emergencia",
      icon: <AlertOctagon className="h-4 w-4 text-rose-600" />,
    },
    {
      value: "Alta",
      label: "Alta",
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    },
    {
      value: "Normal",
      label: "Normal",
      icon: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
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
            <Plus className="h-3.5 w-3.5" />
            Nuevo ticket
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        {/* Barra de herramientas en una sola línea: búsqueda y filtros a la izquierda, vistas de estado a la derecha */}
        <div className="mb-3 grid min-h-8">
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
                  className="w-[280px] sm:w-[300px]"
                />
                <TicketFilterDropdown
                  title="Seleccionar departamento"
                  value={String(departmentId)}
                  onChange={(next) => setDepartmentId(next === "todos" ? "todos" : Number(next))}
                  options={departmentOptions}
                  defaultIcon={<Building2 className="h-4 w-4 text-zinc-500" />}
                  aria-label="Filtrar por departamento"
                />
                <TicketFilterDropdown
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
                      setDepartmentId("todos");
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

              {/* Solo 2 tags visibles: Todos y Abiertos + Más */}
              <div className="inline-flex items-center gap-1.5">
                {primaryFilters.map(({ key, label, countKey }) => {
                  const isActive = filter === key;
                  const count = counts?.[countKey] ?? 0;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] shadow-2xs transition-all outline-none select-none cursor-pointer active:scale-[0.98] ${
                        isActive
                          ? "border border-zinc-300 bg-zinc-100 font-semibold text-zinc-900"
                          : "border border-zinc-200 bg-white font-medium text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                      }`}
                    >
                      <span>{label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10.5px] font-bold tabular-nums transition-colors ${
                          isActive
                            ? "bg-zinc-200 text-zinc-800"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
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
            <div className="col-start-1 row-start-1 w-full" inert={selectionExiting ? true : undefined}>
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
                    <div className="flex items-center justify-center">
                      <SelectBox
                        checked={pageState}
                        label={pageState === true ? "Quitar la selección de esta página" : "Seleccionar toda la página"}
                        onToggle={togglePage}
                      />
                    </div>
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
                      className="group cursor-pointer outline-none focus-visible:bg-zinc-50"
                    >
                      <Td className={SELECT_COLUMN}>
                        <div className="flex items-center justify-center">
                          <SelectBox
                            checked={checked}
                            label={`Seleccionar ${t.number}`}
                            onToggle={() => toggleSelect(t.id)}
                          />
                        </div>
                      </Td>

                      <Td className={columns[0].className}>
                        <span className="font-heading text-[12px] font-semibold tracking-tight tabular-nums text-zinc-700">
                          {t.number}
                        </span>
                      </Td>

                      <Td className={columns[1].className}>
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-medium text-zinc-900 leading-snug" title={t.subject}>
                            {t.subject}
                          </p>
                          <p className="truncate text-[11px] text-zinc-500 font-normal leading-tight mt-0.5">
                            {t.topicName ?? "Sin motivo"}
                            {department && <span className="text-zinc-400 2xl:hidden"> · {department}</span>}
                            {t.productLineName && <span className="text-zinc-400"> · {t.productLineName}</span>}
                          </p>
                        </div>
                      </Td>

                      <Td className={columns[2].className}>
                        {client ? (
                          <div className="flex items-center gap-1.5 min-w-0" title={`${client}${clientCode ? ` (${clientCode})` : ""}`}>
                            <span
                              aria-hidden
                              className={`h-2 w-2 shrink-0 rounded-full ${getClientDotColor(client)}`}
                            />
                            <span className="truncate text-[12.5px] font-medium text-zinc-800">
                              {client}
                            </span>
                            {clientCode && (
                              <span className="shrink-0 text-[11px] font-normal text-zinc-400 tabular-nums">
                                #{clientCode}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[12px] text-zinc-400">—</span>
                        )}
                      </Td>

                      <Td className={`${columns[3].className} truncate text-[12px] text-zinc-600`}>
                        {department ?? <span className="text-zinc-300">—</span>}
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

                      <Td className={`${columns[7].className} truncate whitespace-nowrap text-[11.5px] tabular-nums text-zinc-500`}>
                        <span className="truncate" title={activity.full}>{activity.compact}</span>
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
