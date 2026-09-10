import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flag,
  Info,
  MousePointerClick,
  Pause,
  Plus,
  SlidersHorizontal,
  Ticket as TicketIcon,
  User,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { departmentsApi } from "../../api/departments";
import { ticketsApi } from "../../api/tickets";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { DataTable, Row, Td, Th, type SortDir } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { Modal } from "../../components/ui/Modal";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { useEmailCounts } from "../../context/useEmailCounts";
import { useReceipts } from "../../context/useReceipts";
import { formatActivityDate, formatInitials, formatSlaRemaining } from "../../lib/format";
import type {
  DepartmentResponse,
  TicketCounts,
  TicketListItemResponse,
  TicketListResponse,
  TicketQuery,
  TicketStaffOptionResponse,
} from "../../types/api";
import { CreateTicketModal } from "./CreateTicketModal";

type TicketFilterKey = "todos" | "abiertos" | "por-vencer" | "vencidos" | "espera" | "cerrados";
type SortKey = "numero" | "asunto" | "cliente" | "departamento" | "prioridad" | "estado" | "sla" | "actividad";

const filters: { key: TicketFilterKey; label: string; countKey: keyof TicketCounts }[] = [
  { key: "todos", label: "Todos", countKey: "all" },
  { key: "abiertos", label: "Abiertos", countKey: "open" },
  { key: "por-vencer", label: "Por vencer", countKey: "upcoming" },
  { key: "vencidos", label: "Vencidos", countKey: "overdue" },
  { key: "espera", label: "En espera del cliente", countKey: "waitingOnClient" },
  { key: "cerrados", label: "Cerrados", countKey: "closed" },
];

const PRIMARY_FILTER_KEYS: TicketFilterKey[] = ["todos", "abiertos", "vencidos"];
const primaryFilters = filters.filter((f) => PRIMARY_FILTER_KEYS.includes(f.key));
const secondaryFilters = filters.filter((f) => !PRIMARY_FILTER_KEYS.includes(f.key));

// Distribución de anchos equilibrada para evitar truncamientos y optimizar jerarquía
const columns: { key: SortKey; label: string; className: string }[] = [
  { key: "numero", label: "Número", className: "w-[110px]" },
  { key: "asunto", label: "Asunto / Motivo", className: "min-w-[200px]" },
  { key: "cliente", label: "Cliente", className: "hidden w-[145px] lg:table-cell" },
  { key: "departamento", label: "Departamento", className: "hidden w-[125px] 2xl:table-cell" },
  { key: "prioridad", label: "Prioridad", className: "hidden w-[110px] md:table-cell" },
  { key: "estado", label: "Estado", className: "w-[125px]" },
  { key: "sla", label: "SLA", className: "w-[135px]" },
  { key: "actividad", label: "Última actividad", className: "hidden w-[125px] xl:table-cell" },
];

const ASSIGNED_COLUMN = "hidden w-[155px] lg:table-cell";

function renderPriorityBadge(priority: string) {
  const norm = (priority ?? "").toLowerCase().trim();
  switch (norm) {
    case "emergencia":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-red-500/10 text-brand-red border border-red-500/25 shadow-2xs">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-red animate-pulse" />
          Emergencia
        </span>
      );
    case "alta":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/25">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Alta
        </span>
      );
    case "normal":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-blue-500/10 text-blue-700 border border-blue-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          Normal
        </span>
      );
    case "baja":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-slate-500/10 text-slate-600 border border-slate-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          Baja
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-slate-500/10 text-slate-700 border border-slate-500/20">
          {priority}
        </span>
      );
  }
}

function renderStatusBadge(status: string) {
  const norm = (status ?? "").toLowerCase().trim();
  switch (norm) {
    case "abierto":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Abierto
        </span>
      );
    case "en espera del cliente":
    case "en espera":
    case "espera":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/25">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          En espera
        </span>
      );
    case "reenvío de producto":
    case "reenvio de producto":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-purple-500/10 text-purple-800 border border-purple-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
          Reenvío
        </span>
      );
    case "solucionado":
    case "solucionada":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-teal-500/10 text-teal-800 border border-teal-500/20">
          <CheckCircle2 className="h-3 w-3 text-teal-600" />
          Solucionado
        </span>
      );
    case "cancelado":
    case "cerrado":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-slate-500/10 text-slate-600 border border-slate-500/20">
          <XCircle className="h-3 w-3 text-slate-400" />
          {norm === "cerrado" ? "Cerrado" : "Cancelado"}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-slate-500/10 text-slate-700 border border-slate-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          {status}
        </span>
      );
  }
}

function renderDepartmentBadge(deptName?: string | null) {
  if (!deptName || deptName === "Sin departamento") {
    return <span className="text-[11.5px] text-faint italic font-normal">Sin depto.</span>;
  }
  const norm = deptName.toLowerCase();
  let colorClass = "bg-slate-500/10 text-slate-700 border-slate-500/20";

  if (norm.includes("almacén") || norm.includes("almacen")) {
    colorClass = "bg-amber-500/10 text-amber-900 border-amber-500/25";
  } else if (norm.includes("calidad")) {
    colorClass = "bg-emerald-500/10 text-emerald-900 border-emerald-500/25";
  } else if (norm.includes("admin")) {
    colorClass = "bg-blue-500/10 text-blue-900 border-blue-500/25";
  } else if (norm.includes("venta") || norm.includes("comercial")) {
    colorClass = "bg-rose-500/10 text-rose-900 border-rose-500/25";
  } else if (norm.includes("producc") || norm.includes("planta")) {
    colorClass = "bg-indigo-500/10 text-indigo-900 border-indigo-500/25";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${colorClass}`}
      title={deptName}
    >
      <span className="truncate max-w-[100px]">{deptName}</span>
    </span>
  );
}

function renderSlaBadge(sla: { text: string; tone: "overdue" | "warning" | "ok" | "paused" | "completed" }) {
  if (sla.tone === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        {sla.text}
      </span>
    );
  }
  if (sla.tone === "overdue") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-brand-red/10 text-brand-red border border-brand-red/25 shadow-2xs">
        <AlertTriangle className="h-3 w-3 text-brand-red" />
        {sla.text}
      </span>
    );
  }
  if (sla.tone === "warning") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/25">
        <Clock className="h-3 w-3 text-amber-600" />
        {sla.text}
      </span>
    );
  }
  if (sla.tone === "paused") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-slate-500/10 text-slate-600 border border-slate-500/20">
        <Pause className="h-3 w-3 text-slate-500" />
        {sla.text}
      </span>
    );
  }
  if (sla.text === "Sin SLA") {
    return <span className="text-[12px] text-faint font-mono pl-1">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
      <Clock className="h-3 w-3 text-slate-400" />
      {sla.text}
    </span>
  );
}

const STATUS_MENU_WIDTH = 224;

interface TicketStatusMenuProps {
  options: { key: TicketFilterKey; label: string; countKey: keyof TicketCounts }[];
  activeKey: TicketFilterKey;
  counts?: TicketCounts;
  onSelect: (key: TicketFilterKey) => void;
}

/** Botón de filtros con panel flotante para las vistas de estado menos usadas
 * (mismo patrón que el ícono de filtros de la bandeja de correo). */
function TicketStatusMenu({ options, activeKey, counts, onSelect }: TicketStatusMenuProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const activeInMenu = options.some((option) => option.key === activeKey);

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
        aria-label={activeInMenu ? `Más filtros (activo: ${options.find((o) => o.key === activeKey)?.label})` : "Más filtros"}
        title="Más filtros"
        data-active={activeInMenu}
        className="relative flex h-8 w-8 items-center justify-center rounded-edge border border-line-strong
          bg-white text-brand-gray outline-none transition-all duration-150 hover:border-zinc-400 hover:text-ink
          active:scale-95 focus-visible:border-brand-red focus-visible:ring-3 focus-visible:ring-brand-red/10
          data-[active=true]:border-brand-red/40 data-[active=true]:text-brand-red-dark
          aria-expanded:bg-fill aria-expanded:text-ink"
      >
        <SlidersHorizontal className="h-4 w-4" />
        {activeInMenu && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-red"
          />
        )}
      </button>

      {open &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label="Más filtros de estado"
            style={{ position: "fixed", top: anchor.top, left: anchor.left, width: STATUS_MENU_WIDTH }}
            className="animate-plf-popover-in z-[60] flex flex-col gap-0.5 rounded-edge border border-line/90
              bg-white p-1.5 shadow-[0_4px_16px_-2px_rgba(27,27,29,0.08),0_12px_32px_-4px_rgba(27,27,29,0.14)]"
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
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-edge px-2.5 py-1.5
                    text-left text-[12.5px] font-medium transition-colors ${
                      isActive ? "bg-brand-red/[0.06] text-brand-red-dark" : "text-ink hover:bg-fill"
                    }`}
                >
                  <span>{label}</span>
                  <span
                    className={`rounded-full px-1.5 py-px text-[11px] font-semibold ${
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

/** Señal discreta junto al resumen del encabezado: al hacer clic despliega el
 * aviso de que las filas de la tabla son interactivas y abren el detalle. */
function RowClickHint() {
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
    setAnchor({ top: rect.bottom + 8, left: rect.left });
    setOpen(true);
  }

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="Cómo ver el detalle de un ticket"
        className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-red/15 text-brand-red-dark
          outline-none transition-colors hover:bg-brand-red/25 focus-visible:ring-2 focus-visible:ring-brand-red/25
          cursor-pointer animate-pulse"
      >
        <Info className="h-2.5 w-2.5" />
      </button>

      {open &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="tooltip"
            style={{ position: "fixed", top: anchor.top, left: anchor.left, width: 230 }}
            className="animate-plf-popover-in z-[60] flex items-start gap-1.5 rounded-edge border border-line/90
              bg-white p-2.5 text-[11.5px] leading-relaxed text-subtle
              shadow-[0_4px_16px_-2px_rgba(27,27,29,0.08),0_12px_32px_-4px_rgba(27,27,29,0.14)]"
          >
            <MousePointerClick className="h-3.5 w-3.5 shrink-0 text-brand-red" />
            Haz clic en una fila para ver todos los detalles del ticket.
          </div>,
          document.body,
        )}
    </span>
  );
}

export function TicketsPage() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TicketFilterKey>("todos");
  const [departmentId, setDepartmentId] = useState<number | "todos">("todos");
  const [priority, setPriority] = useState<string>("todas");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "actividad",
    dir: "desc",
  });
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search).trim();

  // Selección múltiple, acciones en lote y alta manual
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkPriorityOpen, setBulkPriorityOpen] = useState(false);
  const [bulkStaffId, setBulkStaffId] = useState<string>("");
  const [bulkPriority, setBulkPriority] = useState<string>("Normal");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ variant: "success" | "error" | "info"; message: string } | null>(null);
  const [staffOptions, setStaffOptions] = useState<TicketStaffOptionResponse[]>([]);

  useEffect(() => {
    departmentsApi
      .list()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  const { onTicketsChanged } = useEmailCounts();
  const receipts = useReceipts();

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

  useEffect(() => {
    return onTicketsChanged(() => {
      refresh();
    });
  }, [onTicketsChanged, refresh]);

  const rows: TicketListItemResponse[] = data?.items ?? [];
  const counts = data?.counts;

  const allVisibleIds = rows.map((r) => r.id);
  const allVisibleSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = allVisibleIds.some((id) => selectedIds.has(id));

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function openBulkAssign() {
    if (staffOptions.length === 0) {
      ticketsApi
        .createOptions()
        .then((opts) => {
          setStaffOptions(opts.assignableStaff);
        })
        .catch(() => {});
    }
    setBulkAssignOpen(true);
  }

  async function handleBulkAssignSubmit() {
    setBulkSubmitting(true);
    setBulkFeedback(null);
    try {
      const targetStaffId = bulkStaffId ? parseInt(bulkStaffId, 10) : null;
      const res = await ticketsApi.bulkAssign({
        ticketIds: Array.from(selectedIds),
        staffId: targetStaffId,
      });
      setBulkAssignOpen(false);
      setSelectedIds(new Set());
      refresh();
      if (res.updatedCount < res.totalRequested) {
        const skipped = res.totalRequested - res.updatedCount;
        setBulkFeedback({
          variant: "info",
          message: `Se reasignaron ${res.updatedCount} de ${res.totalRequested} tickets (${skipped} omitidos por estar cerrados o no autorizados).`,
        });
      } else {
        setBulkFeedback({
          variant: "success",
          message: `Se asignaron exitosamente los ${res.updatedCount} tickets seleccionados.`,
        });
      }
    } catch (err) {
      setBulkFeedback({
        variant: "error",
        message: err instanceof Error ? err.message : "Error al asignar tickets en lote",
      });
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function handleBulkPrioritySubmit() {
    setBulkSubmitting(true);
    setBulkFeedback(null);
    try {
      const res = await ticketsApi.bulkPriority({
        ticketIds: Array.from(selectedIds),
        priority: bulkPriority,
      });
      setBulkPriorityOpen(false);
      setSelectedIds(new Set());
      refresh();
      if (res.updatedCount < res.totalRequested) {
        const skipped = res.totalRequested - res.updatedCount;
        setBulkFeedback({
          variant: "info",
          message: `Se actualizó la prioridad a '${bulkPriority}' en ${res.updatedCount} de ${res.totalRequested} tickets (${skipped} omitidos por estar cerrados).`,
        });
      } else {
        setBulkFeedback({
          variant: "success",
          message: `Se actualizó la prioridad a '${bulkPriority}' en los ${res.updatedCount} tickets seleccionados.`,
        });
      }
    } catch (err) {
      setBulkFeedback({
        variant: "error",
        message: err instanceof Error ? err.message : "Error al cambiar prioridad en lote",
      });
    } finally {
      setBulkSubmitting(false);
    }
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <div className="flex h-full flex-col relative">
      <ModuleHeader
        title="Tickets"
        summary={
          counts ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">
                {counts.all} {counts.all === 1 ? "ticket" : "tickets"}
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {counts.open} abiertos
              </span>
              <span className="text-slate-300">·</span>
              <span
                className={`inline-flex items-center gap-1.5 font-medium ${
                  counts.overdue > 0 ? "text-brand-red font-semibold" : "text-subtle"
                }`}
              >
                {counts.overdue > 0 && <span className="h-1.5 w-1.5 rounded-full bg-brand-red" />}
                {counts.overdue} {counts.overdue === 1 ? "vencido" : "vencidos"}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-subtle">
                {counts.waitingOnClient} en espera
              </span>
              <RowClickHint />
            </span>
          ) : (
            "Cargando bandeja de tickets…"
          )
        }
        action={
          <Button size="sm" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo ticket
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        {/* Barra de criterios: búsqueda, filtros estructurales y pastillas */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-[280px]">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por número, asunto o cliente…"
              className="w-full sm:max-w-[260px] md:max-w-[300px]"
            />

            <Select
              size="sm"
              className="w-[170px]"
              aria-label="Filtrar por departamento"
              value={String(departmentId)}
              onChange={(next) => setDepartmentId(next === "todos" ? "todos" : Number(next))}
              options={[
                { value: "todos", label: "Todos los deptos." },
                ...departments.map((d) => ({
                  value: String(d.id),
                  label: d.name,
                })),
              ]}
            />

            <Select
              size="sm"
              className="w-[160px]"
              aria-label="Filtrar por prioridad"
              value={priority}
              onChange={(next) => setPriority(next)}
              options={[
                { value: "todas", label: "Todas las prioridades" },
                { value: "Emergencia", label: "Emergencia" },
                { value: "Alta", label: "Alta" },
                { value: "Normal", label: "Normal" },
                { value: "Baja", label: "Baja" },
              ]}
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
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

        {bulkFeedback && (
          <div className="mb-3">
            <Alert variant={bulkFeedback.variant}>
              <div className="flex items-center justify-between w-full">
                <span>{bulkFeedback.message}</span>
                <button
                  type="button"
                  onClick={() => setBulkFeedback(null)}
                  className="ml-2 text-xs underline cursor-pointer hover:opacity-80"
                >
                  Cerrar
                </button>
              </div>
            </Alert>
          </div>
        )}

        {error && (
          <div className="mb-3">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {data === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className={`transition-opacity ${isStale ? "opacity-60" : ""}`}>
            <div className="rounded-xl border border-line-soft bg-white shadow-2xs overflow-hidden">
              <DataTable fixed>
                <thead>
                  <tr className="border-b border-line bg-slate-50/70">
                    <Th className="w-11 !pl-4 !pr-2 text-center">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos los tickets visibles"
                        className="h-4 w-4 rounded-[4px] border-line text-brand-red focus:ring-brand-red/30 cursor-pointer accent-brand-red transition-all"
                        checked={allVisibleSelected}
                        ref={(input) => {
                          if (input) {
                            input.indeterminate = someVisibleSelected && !allVisibleSelected;
                          }
                        }}
                        onChange={toggleSelectAll}
                      />
                    </Th>
                    {columns.map(({ key, label, className }) => (
                      <Th
                        key={key}
                        className={className}
                        sort={{
                          dir: sort.key === key ? sort.dir : null,
                          onToggle: () => toggleSort(key),
                        }}
                      >
                        {label}
                      </Th>
                    ))}
                    <Th className={`${ASSIGNED_COLUMN} !pr-4`}>Asignado</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft/80">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 2} className="py-16 text-center text-subtle">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-subtle">
                            <TicketIcon className="h-6 w-6 opacity-50" />
                          </div>
                          <p className="text-[14px] font-semibold text-ink">No se encontraron tickets</p>
                          <p className="text-[12.5px] text-subtle">
                            No hay registros que coincidan con los criterios de búsqueda o filtros seleccionados.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((t) => {
                      const sla = formatSlaRemaining(t.resolutionDueAt, Boolean(t.pausedAt), t.status, t.closedAt);
                      const act = formatActivityDate(t.lastActivityAt);

                      return (
                        <Row
                          key={t.id}
                          onClick={() => navigate(`/tickets/${t.id}`)}
                          className={`group cursor-pointer transition-colors hover:bg-slate-50/75 ${
                            selectedIds.has(t.id) ? "bg-brand-red/[0.04] ring-1 ring-inset ring-brand-red/15" : ""
                          }`}
                        >
                          {/* Selección */}
                          <Td
                            className="w-11 !pl-4 !pr-2 text-center"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <input
                              type="checkbox"
                              aria-label={`Seleccionar ticket ${t.number}`}
                              className="h-4 w-4 rounded-[4px] border-line text-brand-red focus:ring-brand-red/30 cursor-pointer accent-brand-red transition-all"
                              checked={selectedIds.has(t.id)}
                              onChange={() => toggleSelect(t.id)}
                            />
                          </Td>

                          {/* Número */}
                          <Td className={columns[0].className}>
                            <span className="inline-flex items-center font-mono text-[11.5px] font-semibold text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/80 [font-variant-numeric:normal] tracking-tight">
                              {t.number}
                            </span>
                          </Td>

                          {/* Asunto y Tema */}
                          <Td className={columns[1].className}>
                            <div className="truncate font-semibold text-ink text-[13px] group-hover:text-brand-red transition-colors" title={t.subject}>
                              {t.subject}
                            </div>
                            <div className="truncate text-[11.5px] text-subtle mt-0.5">
                              <span className="text-slate-600">{t.topicName || "Sin motivo"}</span>
                              {t.productLineName && (
                                <>
                                  <span className="mx-1.5 text-slate-300">·</span>
                                  <span className="text-slate-500">{t.productLineName}</span>
                                </>
                              )}
                            </div>
                          </Td>

                          {/* Cliente */}
                          <Td className={columns[2].className}>
                            {t.clientName && t.clientName !== "Sin cliente" ? (
                              <>
                                <div className="truncate font-semibold text-ink text-[12.5px]" title={t.clientName}>
                                  {t.clientName}
                                </div>
                                <div className="truncate text-[11px] text-subtle mt-0.5">
                                  {t.contactName ?? (t.clientCode && t.clientCode !== "-" ? t.clientCode : null) ?? "—"}
                                </div>
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-faint italic font-normal">
                                <UserX className="h-3 w-3 opacity-60" /> Sin cliente
                              </span>
                            )}
                          </Td>

                          {/* Departamento */}
                          <Td className={columns[3].className}>
                            {renderDepartmentBadge(t.departmentName)}
                          </Td>

                          {/* Prioridad */}
                          <Td className={columns[4].className}>
                            {renderPriorityBadge(t.priority)}
                          </Td>

                          {/* Estado */}
                          <Td className={columns[5].className}>
                            {renderStatusBadge(t.status)}
                          </Td>

                          {/* SLA */}
                          <Td className={columns[6].className}>
                            {renderSlaBadge(sla)}
                          </Td>

                          {/* Última actividad */}
                          <Td className={columns[7].className}>
                            <span className="text-[11.5px] text-subtle whitespace-nowrap" title={act.full}>
                              {act.compact}
                            </span>
                          </Td>

                          {/* Asignado */}
                          <Td className={`${ASSIGNED_COLUMN} !pr-4`}>
                            {t.assignedStaffName ? (
                              <div className="flex items-center gap-2 min-w-0" title={t.assignedStaffName}>
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white shadow-2xs">
                                  {formatInitials(t.assignedStaffName)}
                                </span>
                                <span className="truncate text-[12px] font-medium text-ink">
                                  {t.assignedStaffName}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-faint italic">
                                <User className="h-3.5 w-3.5 opacity-50" />
                                Sin asignar
                              </span>
                            )}
                          </Td>
                        </Row>
                      );
                    })
                  )}
                </tbody>
              </DataTable>
            </div>

            {data.total > 0 && (
              <div className="mt-3.5">
                <Pagination
                  page={data.page}
                  totalPages={data.totalPages}
                  total={data.total}
                  pageSize={data.pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  noun="tickets"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Barra flotante de acciones en lote */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-slate-700/80 bg-ink/95 backdrop-blur-md px-4 py-2.5 text-white shadow-2xl animate-plf-toast-in">
          <div className="flex items-center gap-2 text-[12.5px] font-medium text-slate-200">
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1.5 text-[10.5px] font-bold text-white">
              {selectedIds.size}
            </span>
            <span>{selectedIds.size === 1 ? "ticket seleccionado" : "tickets seleccionados"}</span>
          </div>
          <span className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openBulkAssign}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/20 cursor-pointer"
            >
              <UserCheck className="h-3.5 w-3.5 text-brand-red" />
              Asignar en lote
            </button>
            <button
              type="button"
              onClick={() => setBulkPriorityOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/20 cursor-pointer"
            >
              <Flag className="h-3.5 w-3.5 text-amber-400" />
              Cambiar prioridad
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg px-2.5 py-1.5 text-[12px] text-slate-400 transition hover:text-white cursor-pointer"
            >
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* Modal alta manual de ticket */}
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

      {/* Modal asignación en lote */}
      {bulkAssignOpen && (
        <Modal
          eyebrow="Acciones en lote"
          title="Asignar tickets en lote"
          description={`Selecciona el colaborador al que deseas asignar los ${selectedIds.size} tickets seleccionados.`}
          onClose={() => {
            if (!bulkSubmitting) setBulkAssignOpen(false);
          }}
          footer={({ requestClose }) => (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={requestClose}
                disabled={bulkSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleBulkAssignSubmit}
                isLoading={bulkSubmitting}
              >
                Confirmar asignación
              </Button>
            </>
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink">Colaborador asignado</label>
              <Select
                size="sm"
                value={bulkStaffId}
                onChange={(val) => setBulkStaffId(val)}
                options={[
                  { value: "", label: "— Sin asignar (desasignar) —" },
                  ...staffOptions.map((s) => ({
                    value: String(s.id),
                    label: `${s.fullName} (${s.email})`,
                  })),
                ]}
              />
            </div>
            <p className="text-[12px] text-subtle leading-relaxed">
              Se validará que el colaborador tenga acceso a los departamentos de cada ticket.
              Los tickets resueltos o cancelados se omitirán automáticamente.
            </p>
          </div>
        </Modal>
      )}

      {/* Modal cambio de prioridad en lote */}
      {bulkPriorityOpen && (
        <Modal
          eyebrow="Acciones en lote"
          title="Cambiar prioridad en lote"
          description={`Selecciona la nueva prioridad para los ${selectedIds.size} tickets seleccionados.`}
          onClose={() => {
            if (!bulkSubmitting) setBulkPriorityOpen(false);
          }}
          footer={({ requestClose }) => (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={requestClose}
                disabled={bulkSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleBulkPrioritySubmit}
                isLoading={bulkSubmitting}
              >
                Actualizar prioridad
              </Button>
            </>
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink">Nueva prioridad</label>
              <Select
                size="sm"
                value={bulkPriority}
                onChange={(val) => setBulkPriority(val)}
                options={[
                  { value: "Emergencia", label: "Emergencia" },
                  { value: "Alta", label: "Alta" },
                  { value: "Normal", label: "Normal" },
                  { value: "Baja", label: "Baja" },
                ]}
              />
            </div>
            <p className="text-[12px] text-subtle leading-relaxed">
              Se recalculará la fecha límite de SLA según la política correspondiente a la nueva prioridad.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
