import {
  Building2,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Lock,
  Package,
  Plus,
  SlidersHorizontal,
  Ticket as TicketIcon,
  X,
} from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animateCardGridPageTurn, consumePageDirection } from "../../hooks/motion";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import { useMenuKeyboard } from "../../hooks/useMenuKeyboard";
import { useNavigate } from "react-router-dom";
import { TicketFilterDropdown, type TicketFilterOption } from "./TicketFilterDropdown";
import { buildDepartmentFilterOptions } from "../../lib/departmentFilterOptions";
import { departmentPaths } from "../../lib/departments";
import { priorityFilterDefaultIcon, priorityFilterOptions } from "../../lib/priorityFilterOptions";
import { formatTicketProductsSummary } from "../../lib/ticketProducts";
import { departmentsApi } from "../../api/departments";
import { ticketsApi } from "../../api/tickets";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { SEGMENTED_TAB_COUNT_BADGE_CLASS } from "../../components/ui/SegmentedTabs";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { Button } from "../../components/ui/Button";
import type { SortDir } from "../../components/ui/DataTable";
import { Modal } from "../../components/ui/Modal";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { SelectBox } from "../../components/ui/SelectBox";
import { ListEmptyState } from "../../components/ui/ListEmptyState";
import { TicketCardsSkeleton } from "../../components/ui/Skeleton";
import { useEmailCounts } from "../../context/useEmailCounts";
import { useReceipts } from "../../context/useReceipts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useLoadErrorReceipt } from "../../hooks/useNoticeReceipts";
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
import { usePermissions } from "../../hooks/usePermissions";
import { CreateTicketModal } from "./CreateTicketModal";
import { AssigneeCell, PriorityCell, SlaCell, StatusCell } from "./ticketCells";
import { TicketSelectionBar } from "./TicketSelectionBar";
import { TICKETS_LIST_ROUTES, type TicketOriginFilter } from "./ticketLegacy";

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
  { key: "vencidos", label: "Vencidos", countKey: "overdue" },
  { key: "espera", label: "En espera del cliente", countKey: "waitingOnClient" },
  { key: "cerrados", label: "Cerrados", countKey: "closed" },
];

const primaryFilters = filters.filter((f) => f.key === "todos" || f.key === "abiertos");

// Múltiplos de 3 para mantener la simetría exacta de la cuadrícula 3×3 en escritorio.
const CARD_PAGE_SIZES = [9, 18, 27, 45];

const DEFAULT_SORT_VALUE = "actividad:desc";

const sortFilterOptions: TicketFilterOption[] = [
  { value: "actividad:desc", label: "Actividad reciente" },
  { value: "actividad:asc", label: "Actividad más antigua" },
  { value: "sla:asc", label: "SLA próximo a vencer" },
  { value: "prioridad:desc", label: "Mayor prioridad" },
  { value: "numero:desc", label: "Código (recientes)" },
  { value: "cliente:asc", label: "Cliente (A–Z)" },
  { value: "departamento:asc", label: "Departamento (A–Z)" },
];

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

const SORT_MENU_WIDTH = 248;

interface TicketSortMenuProps {
  sortValue: string;
  sortOptions: TicketFilterOption[];
  onSortChange: (value: string) => void;
  hasOverdueTickets?: boolean;
}

/** Orden de las tarjetas (sin vistas duplicadas respecto a los filtros del encabezado). */
function TicketSortMenu({ sortValue, sortOptions, onSortChange, hasOverdueTickets }: TicketSortMenuProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number; originX: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { mounted, exiting, ref: panelRef, snap } = useDisclosureMotion<HTMLDivElement>(open);
  const handleMenuKeyDown = useMenuKeyboard(panelRef, open);

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
      snap();
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
  }, [open, snap, panelRef]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, rect.right - SORT_MENU_WIDTH);
    setAnchor({ top: rect.bottom + 6, left, originX: rect.left + rect.width / 2 - left });
    setOpen(true);
  }

  const activeSort = sortOptions.find((option) => option.value === sortValue);
  const menuLabel = activeSort?.label ?? "Ordenar por";

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={mounted ? panelId : undefined}
        aria-label={`Ordenar por (activo: ${menuLabel})`}
        title={`Orden: ${menuLabel}`}
        className={`inline-flex h-7 w-[11rem] shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium transition-colors duration-150 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
          open
            ? "border-zinc-200 bg-white text-zinc-900 shadow-2xs"
            : "border-transparent text-zinc-500 hover:bg-white/60 hover:text-zinc-800"
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <span className="min-w-0 truncate">{menuLabel}</span>
        {hasOverdueTickets && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" title="Hay tickets vencidos" />
        )}
        <ChevronDown
          className={`h-3 w-3 text-zinc-400 transition-transform duration-280 ease-plf-spring motion-reduce:transition-none ${open ? "rotate-180 text-zinc-700" : ""}`}
        />
      </button>

      {mounted &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label="Ordenar tickets"
            aria-hidden={exiting}
            onKeyDown={handleMenuKeyDown}
            style={{
              position: "fixed",
              top: anchor.top,
              left: anchor.left,
              width: SORT_MENU_WIDTH,
              transformOrigin: `${anchor.originX}px top`,
            }}
            className={`z-[60] flex flex-col gap-0.5 rounded-lg border border-zinc-200/90
              bg-white p-1 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)] ${
                exiting ? "pointer-events-none" : ""
              }`}
          >
            <div data-motion-item className="select-none px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-400">
              Ordenar por
            </div>
            {sortOptions.map(({ value, label }) => {
              const isActive = value === sortValue;
              return (
                <button
                  key={value}
                  data-motion-item
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onSortChange(value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={`flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
                    isActive
                      ? "bg-zinc-100 font-semibold text-zinc-900"
                      : "font-medium text-zinc-700 hover:bg-zinc-100/80 hover:text-zinc-900"
                  }`}
                >
                  <span>{label}</span>
                  {isActive ? <Check className="size-3.5 shrink-0 text-zinc-600" aria-hidden /> : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

interface TicketCardProps {
  ticket: TicketListItemResponse;
  checked: boolean;
  department: string | null;
  onToggleSelect: (id: number) => void;
  onOpen: (id: number) => void;
}

/**
 * Ficha arquitectónica simétrica de ticket.
 *
 * Diseñada en cuatro zonas de altura determinista para que las 9 tarjetas de la
 * cuadrícula 3×3 mantengan una alineación horizontal y vertical idéntica:
 * 1. Barra superior (`h-6`): Selección + Código íntegro a la izquierda; Prioridad + Estado a la derecha.
 * 2. Núcleo de asunto (`h-[40px]`): Hasta 2 líneas en Onest (`line-clamp-2`) con altura bloqueada.
 * 3. Panel hundido (`rounded-inset`): 2 franjas de ancho completo (Cliente con código y Departamento con ruta)
 *    + 1 franja inferior bisecada al 50/50 (Motivo | Compromiso SLA).
 * 4. Pie operativo (`h-7`): Responsable con avatar a la izquierda; Productos + Actividad a la derecha.
 */
function TicketCard({ ticket: t, checked, department, onToggleSelect, onOpen }: TicketCardProps) {
  const [copied, setCopied] = useState(false);
  const sla = formatSlaRemaining(t.resolutionDueAt, Boolean(t.pausedAt), t.status, t.closedAt);
  const activity = formatActivityDate(t.lastActivityAt);
  const client = t.clientName && t.clientName !== "Sin cliente" ? t.clientName : null;
  const clientCode = t.clientCode && t.clientCode !== "-" ? t.clientCode : null;
  const productsSummary = formatTicketProductsSummary(t.products);
  const productCount = t.products?.length ?? 0;

  return (
    <article
      tabIndex={0}
      role="button"
      aria-label={`Abrir ticket ${t.number}: ${t.subject}`}
      data-checked={checked || undefined}
      onClick={() => onOpen(t.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(t.id);
        }
      }}
      className={`group relative flex flex-col justify-between rounded-card border bg-white p-4 outline-none transition-all duration-180 ${
        checked
          ? "border-brand-red/45 ring-2 ring-brand-red/12 shadow-card"
          : "border-line shadow-card hover:border-hairline-hover/70 focus-visible:ring-2 focus-visible:ring-brand-red/25"
      }`}
    >
      {/* Zona 1: Cabecera de Identidad y Estado (Simetría bilateral) */}
      <div className="flex h-6 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SelectBox
            checked={checked}
            label={`Seleccionar ${t.number}`}
            onToggle={() => onToggleSelect(t.id)}
          />
          <span className="font-heading text-[12.5px] font-bold tabular-nums tracking-[0.01em] text-ink">
            {t.number}
          </span>
          <button
            type="button"
            title={`Copiar código ${t.number}`}
            aria-label={`Copiar código ${t.number}`}
            onClick={(event) => {
              event.stopPropagation();
              void navigator.clipboard.writeText(t.number);
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            }}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded text-faint opacity-0 transition-opacity hover:bg-canvas hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
          >
            {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
          </button>
          {t.accessLevel === "readOnly" && (
            <span
              title="Solo lectura"
              className="inline-flex items-center text-faint"
              aria-label="Ticket de solo lectura"
            >
              <Lock className="size-3" />
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <PriorityCell priority={t.priority} />
          <span aria-hidden className="h-3 w-px bg-line" />
          <StatusCell status={t.status} />
        </div>
      </div>

      {/* Zona 2: Núcleo del Asunto (Altura bloqueada de 40px = 2 líneas exactas para alineación de fila) */}
      <div className="mt-2.5 flex h-[40px] items-start">
        <h3
          className="line-clamp-2 font-heading text-[13.5px] font-bold leading-[20px] tracking-[-0.012em] text-ink transition-colors group-hover:text-brand-red"
          title={t.subject}
        >
          {t.subject}
        </h3>
      </div>

      {/* Zona 3: Panel Hundido Simétrico (Cliente + Departamento a ancho completo + Bisección 50/50 Motivo/SLA) */}
      <div className="mt-3 overflow-hidden rounded-inset border border-line bg-canvas/85 divide-y divide-line">
        {/* Fila 1: Cliente (ancho completo, eje de rótulo fijo en 78px y código a la derecha) */}
        <div
          className="grid h-8.5 grid-cols-[78px_1fr] items-center gap-2.5 px-3"
          title={client ? `${client}${clientCode ? ` (#${clientCode})` : ""}` : "Sin cliente asignado"}
        >
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full ${
                client ? getClientDotColor(client) : "bg-zinc-300"
              }`}
            />
            <span className="font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-faint">
              Cliente
            </span>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-2">
            <span
              className={`truncate text-[12px] ${
                client ? "font-semibold text-ink" : "font-normal text-faint"
              }`}
            >
              {client ?? "Sin cliente"}
            </span>
            {clientCode && (
              <span className="shrink-0 rounded border border-line bg-white px-1.5 py-0.5 font-heading text-[10px] font-bold leading-none tabular-nums text-subtle">
                #{clientCode}
              </span>
            )}
          </div>
        </div>

        {/* Fila 2: Departamento (ancho completo, mismo eje de rótulo de 78px) */}
        <div
          className="grid h-8.5 grid-cols-[78px_1fr] items-center gap-2.5 px-3"
          title={department ?? "Sin departamento"}
        >
          <div className="flex items-center gap-1.5">
            <Building2 aria-hidden className="size-3 shrink-0 text-faint" />
            <span className="font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-faint">
              Depto.
            </span>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-2">
            <span
              className={`truncate text-[12px] ${
                department ? "font-medium text-ink" : "font-normal text-faint"
              }`}
            >
              {department ?? "Sin departamento"}
            </span>
          </div>
        </div>

        {/* Fila 3: Bisección Simétrica 50/50 (Motivo | Compromiso SLA) */}
        <div className="grid h-[48px] grid-cols-2 divide-x divide-line bg-white/55">
          <div
            className="flex min-w-0 flex-col justify-center gap-0.5 px-3"
            title={t.topicName ?? "Sin motivo"}
          >
            <span className="font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-faint">
              Motivo
            </span>
            <span className="truncate text-[11.5px] font-medium text-ink">
              {t.topicName ?? "Sin motivo"}
            </span>
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-0.5 px-3">
            <span className="font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-faint">
              Compromiso SLA
            </span>
            <div className="flex min-w-0 items-center">
              <SlaCell sla={sla} />
            </div>
          </div>
        </div>
      </div>

      {/* Zona 4: Pie Operativo Simétrico (Responsable a la izquierda; Productos y Actividad a la derecha) */}
      <div className="mt-3 flex h-7 items-center justify-between gap-2 border-t border-line-soft pt-2.5">
        <div className="min-w-0 flex-1">
          <AssigneeCell id={t.assignedStaffId} name={t.assignedStaffName} />
        </div>

        <div className="flex shrink-0 items-center gap-2 text-[11.5px] text-subtle">
          {productsSummary && (
            <span
              className="inline-flex max-w-[130px] items-center gap-1 truncate rounded-md border border-line bg-canvas px-1.5 py-0.5 text-[10.5px] font-medium text-subtle"
              title={productsSummary}
            >
              <Package aria-hidden className="size-3 shrink-0 text-faint" />
              <span className="truncate">
                {productCount === 1 ? productsSummary : `${productCount} prod.`}
              </span>
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] font-medium tabular-nums text-subtle"
            title={`Última actividad: ${activity.full}`}
          >
            <Clock aria-hidden className="size-3 shrink-0 text-faint" />
            {activity.compact}
          </span>
        </div>
      </div>
    </article>
  );
}

interface TicketsPageProps {
  origin?: TicketOriginFilter;
}

/** Bandeja de tickets en cuadrícula simétrica 3×3 (9 por vista por defecto). */
export function TicketsPage({ origin = "plastifar" }: TicketsPageProps) {
  const navigate = useNavigate();
  const receipts = useReceipts();
  const { onTicketsChanged } = useEmailCounts();
  const { can, isAdmin } = usePermissions();
  const canReadAllDepartments = isAdmin || can("tickets.read_all");

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TicketFilterKey>("todos");
  const [departmentId, setDepartmentId] = useState<number | "todos">("todos");
  const [priority, setPriority] = useState<string>("todas");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "actividad", dir: "desc" });
  const [pageSize, setPageSize] = useState(9);
  const debouncedSearch = useDebouncedValue(search).trim();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkModal, setBulkModal] = useState<"asignar" | "prioridad" | null>(null);
  const [bulkStaffId, setBulkStaffId] = useState("");
  const [bulkPriority, setBulkPriority] = useState("Normal");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [staffOptions, setStaffOptions] = useState<TicketStaffOptionResponse[]>([]);
  const prevOriginRef = useRef(origin);
  const [listMotionKey, setListMotionKey] = useState(0);
  const [listEnterMotion, setListEnterMotion] = useState<"forward" | "back">("forward");

  useEffect(() => {
    departmentsApi.list().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  useLayoutEffect(() => {
    if (prevOriginRef.current === origin) return;
    setListEnterMotion(origin === "legacy" ? "forward" : "back");
    prevOriginRef.current = origin;
    setFilter("todos");
    setSelectedIds(new Set());
    setListMotionKey((key) => key + 1);
  }, [origin]);

  // «Por vencer» ya no es vista aparte: mismo criterio que ordenar por SLA próximo a vencer.
  useEffect(() => {
    if (filter !== "por-vencer") return;
    setFilter("todos");
    setSort({ key: "sla", dir: "asc" });
  }, [filter]);

  const canCreateTicket = can("tickets.create");

  const { data, isStale, error, setPage, refresh } = usePagedList<TicketQuery, TicketListResponse>({
    fetch: ticketsApi.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      departmentId: departmentId === "todos" ? undefined : departmentId,
      priority: priority === "todas" ? undefined : priority,
      status: filter,
      origin,
      sort: sort.key,
      dir: sort.dir,
    },
    fallbackError: "No se pudieron cargar los tickets",
  });

  useLoadErrorReceipt(error, "tickets-list", refresh);

  useEffect(() => onTicketsChanged(refresh), [onTicketsChanged, refresh]);

  const listLoading = data === null || isStale;
  const rows: TicketListItemResponse[] = isStale ? [] : (data?.items ?? []);
  const counts = isStale ? undefined : data?.counts;
  const hasCriteria =
    Boolean(debouncedSearch) || filter !== "todos" || departmentId !== "todos" || priority !== "todas";

  const cardsGridRef = useRef<HTMLDivElement>(null);
  const prevCardIdsRef = useRef<string | null>(null);
  const currentCardIds = rows.map((row) => row.id).join(",");

  useLayoutEffect(() => {
    const grid = cardsGridRef.current;
    if (!grid || rows.length === 0) return;

    const prev = prevCardIdsRef.current;
    prevCardIdsRef.current = currentCardIds;

    // En el primer montaje actúa plf-results-in; si los IDs son los mismos (ej. marcar selección), no reanimamos.
    if (prev === null || prev === currentCardIds) return;

    animateCardGridPageTurn(grid, consumePageDirection(), 3);
  }, [currentCardIds, rows.length]);

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

  const sortValue = `${sort.key}:${sort.dir}`;
  function handleSortChange(next: string) {
    const [nextKey, nextDir] = next.split(":") as [SortKey, SortDir];
    if (nextKey && (nextDir === "asc" || nextDir === "desc")) {
      setSort({ key: nextKey, dir: nextDir });
    }
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

  const departmentOptions = useMemo(
    () =>
      buildDepartmentFilterOptions(
        canReadAllDepartments
          ? departments
          : departments.filter((department) => can("tickets.read", department.id)),
      ),
    [can, canReadAllDepartments, departments],
  );

  useEffect(() => {
    if (departmentId === "todos") return;
    const allowed = departmentOptions.some((option) => Number(option.value) === departmentId);
    if (!allowed) setDepartmentId("todos");
  }, [departmentId, departmentOptions]);
  // Rotula cada departamento con su ruta jerárquica para distinguir nombres repetidos y cae al nombre si falta el id.
  const departmentPathById = departmentPaths(departments);

  const priorityFilterOpts = priorityFilterOptions() as TicketFilterOption[];

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Tickets"
        sections={[
          {
            label: (
              <span className="flex items-center gap-1.5">
                <span>Actuales</span>
                {counts != null && (
                  <span className={SEGMENTED_TAB_COUNT_BADGE_CLASS}>{counts.plastifar}</span>
                )}
              </span>
            ),
            to: TICKETS_LIST_ROUTES.actuales,
            end: true,
          },
          {
            label: (
              <span className="flex items-center gap-1.5">
                <span>Histórico</span>
                {counts != null && (
                  <span className={SEGMENTED_TAB_COUNT_BADGE_CLASS}>{counts.legacy}</span>
                )}
              </span>
            ),
            to: TICKETS_LIST_ROUTES.historico,
            end: true,
          },
        ]}
        summary={
          counts ? (
            <div
              key={origin}
              className="animate-plf-header-fade flex flex-wrap items-center gap-1.5 tabular-nums"
            >
              <HeaderTag
                label={counts.all === 1 ? "ticket" : "tickets"}
                count={counts.all}
                active={filter === "todos"}
                onClick={() => setFilter("todos")}
                tone="neutral"
                title="Mostrar todos los tickets"
              />

              {(counts.open > 0 || filter === "abiertos") && (
                <>
                  <span aria-hidden className="text-zinc-300">·</span>
                  <HeaderTag
                    label={counts.open === 1 ? "abierto" : "abiertos"}
                    count={counts.open}
                    active={filter === "abiertos"}
                    onClick={() => setFilter("abiertos")}
                    tone="emerald"
                    dot
                    title="Filtrar por tickets abiertos"
                  />
                </>
              )}

              {(counts.overdue > 0 || filter === "vencidos") && (
                <>
                  <span aria-hidden className="text-zinc-300">·</span>
                  <HeaderTag
                    label={counts.overdue === 1 ? "vencido" : "vencidos"}
                    count={counts.overdue}
                    active={filter === "vencidos"}
                    onClick={() => setFilter("vencidos")}
                    tone="red"
                    dot
                    title="Filtrar por tickets vencidos de SLA"
                  />
                </>
              )}

              {(counts.waitingOnClient > 0 || filter === "espera") && (
                <>
                  <span aria-hidden className="text-zinc-300">·</span>
                  <HeaderTag
                    label="en espera"
                    count={counts.waitingOnClient}
                    active={filter === "espera"}
                    onClick={() => setFilter("espera")}
                    tone="amber"
                    dot
                    title="Filtrar por tickets en espera del cliente"
                  />
                </>
              )}

              {filter === "cerrados" && (
                <>
                  <span aria-hidden className="text-zinc-300">·</span>
                  <HeaderTag
                    label="cerrados"
                    count={counts.closed}
                    active={filter === "cerrados"}
                    onClick={() => setFilter("cerrados")}
                    tone="neutral"
                    title="Filtrar por tickets cerrados"
                  />
                </>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando los tickets…
            </span>
          )
        }
        action={
          canCreateTicket && origin === "plastifar" ? (
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="h-8 gap-1.5 px-3.5 text-[12.5px] font-semibold shadow-2xs active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              <span>Nuevo ticket</span>
            </Button>
          ) : undefined
        }
      />

      <div
        key={listMotionKey}
        className={`min-h-0 flex-1 overflow-y-auto pb-8 ${
          listEnterMotion === "forward" ? "animate-plf-side-panel-in" : "animate-plf-side-panel-back"
        }`}
      >
        {/* Barra de herramientas en una sola línea: selección, búsqueda, filtros y orden a la izquierda; vistas de estado a la derecha */}
        <div className="mb-3.5 grid min-h-8">
          {showCriteria && (
            <div
              inert={criteriaExiting ? true : undefined}
              className={`col-start-1 row-start-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${
                criteriaExiting ? "animate-plf-tabs-out" : "animate-plf-tabs-in"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {visibleIds.length > 0 && (
                  <div
                    className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 shadow-2xs"
                    title={
                      pageState === true
                        ? "Quitar la selección de esta página"
                        : "Seleccionar las tarjetas de esta página"
                    }
                  >
                    <SelectBox
                      checked={pageState}
                      label={
                        pageState === true
                          ? "Quitar la selección de esta página"
                          : "Seleccionar toda la página"
                      }
                      onToggle={togglePage}
                    />
                  </div>
                )}

                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar por número, asunto o cliente…"
                  className="w-[260px] sm:w-[290px]"
                />
                <TicketFilterDropdown
                  title="Seleccionar departamento"
                  value={String(departmentId)}
                  onChange={(next) => setDepartmentId(next === "todos" ? "todos" : Number(next))}
                  options={departmentOptions}
                  defaultIcon={<Building2 className="h-4 w-4 text-zinc-500" />}
                  aria-label="Filtrar por departamento"
                  searchable
                  searchPlaceholder="Buscar departamento…"
                />
                <TicketFilterDropdown
                  title="Seleccionar prioridad"
                  value={priority}
                  onChange={setPriority}
                  options={priorityFilterOpts}
                  defaultIcon={priorityFilterDefaultIcon}
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

              {/* Vista rápida: Todos y Abiertos; orden en el menú contiguo. */}
              <div
                role="group"
                aria-label="Vista de estado"
                className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5"
              >
                {primaryFilters.map(({ key, label, countKey }) => {
                  const isActive = filter === key;
                  const count = counts?.[countKey] ?? 0;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      aria-pressed={isActive}
                      className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] transition-colors duration-150 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
                        isActive
                          ? "border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                          : "border-transparent font-medium text-zinc-500 hover:bg-white/60 hover:text-zinc-800"
                      }`}
                    >
                      <span>{label}</span>
                      <span
                        className={`font-heading text-[10px] font-bold leading-none tabular-nums transition-colors ${
                          isActive ? "text-zinc-900" : "text-zinc-400"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
                <TicketSortMenu
                  sortValue={sortValue}
                  sortOptions={sortFilterOptions}
                  onSortChange={handleSortChange}
                  hasOverdueTickets={(counts?.overdue ?? 0) > 0}
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

        {/* Superficie de resultados: las 9 tarjetas flotan directamente sobre el lienzo tintado (sin anidar tarjetas) */}
        {listLoading ? (
          error === null && <TicketCardsSkeleton count={pageSize} />
        ) : rows.length === 0 ? (
          <section className="overflow-hidden rounded-card border border-line bg-white shadow-card">
            <ListEmptyState
              icon={TicketIcon}
              isFiltered={hasCriteria}
              filteredTitle="Ningún ticket coincide con estos criterios."
              onClearFilters={clearCriteria}
              emptyTitle={
                origin === "legacy" ? "El histórico está vacío." : "Todavía no hay tickets."
              }
              emptyDescription={
                origin === "legacy"
                  ? "Aquí verás los tickets migrados del sistema anterior."
                  : "Se crean desde un correo de la bandeja o a mano con «Nuevo ticket»."
              }
            />
          </section>
        ) : (
          <div className="plf-results-in">
            <div
              ref={cardsGridRef}
              className="grid auto-rows-fr grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3"
            >
              {rows.map((t) => {
                const checked = selectedIds.has(t.id);
                const department =
                  t.departmentName && t.departmentName !== "Sin departamento"
                    ? ((t.departmentId != null ? departmentPathById.get(t.departmentId) : undefined) ??
                      t.departmentName)
                    : null;

                return (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    checked={checked}
                    department={department}
                    onToggleSelect={toggleSelect}
                    onOpen={(id) => navigate(`/tickets/${id}`)}
                  />
                );
              })}
            </div>

            {data && data.total > 0 && (
              <div className="mt-2">
                <Pagination
                  page={data.page}
                  pageSize={data.pageSize}
                  total={data.total}
                  totalPages={data.totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  pageSizes={CARD_PAGE_SIZES}
                  rowsLabel="Tarjetas"
                  noun="tickets"
                  nounSingular="ticket"
                />
              </div>
            )}
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
