import {
  Building2,
  Check,
  Clock,
  Copy,
  Lock,
  Package,
  Plus,
  Ticket as TicketIcon,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { animateCardGridPageTurn, consumePageDirection } from "../../hooks/motion";
import { ListSortMenu } from "../../components/ui/ListSortMenu";
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
  TicketListItemResponse,
  TicketListResponse,
  TicketProductResponse,
  TicketQuery,
  TicketStaffOptionResponse,
} from "../../types/api";
import { usePermissions } from "../../hooks/usePermissions";
import { CreateTicketModal } from "./CreateTicketModal";
import { AssigneeCell, CardPriorityStatus, SlaCell } from "./ticketCells";
import { TicketSelectionBar } from "./TicketSelectionBar";
import { TICKETS_LIST_ROUTES, type TicketOriginFilter } from "./ticketLegacy";

type TicketFilterKey = "todos" | "abiertos" | "por-vencer" | "vencidos" | "espera" | "cerrados";
type SortKey = "numero" | "asunto" | "cliente" | "departamento" | "prioridad" | "estado" | "sla" | "actividad";

// Múltiplos de 3 para mantener la simetría exacta de la cuadrícula 3×3 en escritorio.
const CARD_PAGE_SIZES = [9, 18, 27, 45];

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

interface TicketCardProps {
  ticket: TicketListItemResponse;
  checked: boolean;
  department: string | null;
  onToggleSelect: (id: number) => void;
  onOpen: (id: number) => void;
}

/** Eje compartido de las tres franjas de hecho. Cabe «Productos» en versalitas de 10px. */
const FACT_ROW_CLASS =
  "grid h-7 grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-2 px-3";

function CodeBadge({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded border border-line bg-white px-1.5 py-0.5 font-heading text-[10px] font-bold leading-none tabular-nums text-subtle">
      {children}
    </span>
  );
}

function FactRow({
  mark,
  label,
  title,
  children,
}: {
  mark: ReactNode;
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={FACT_ROW_CLASS} title={title}>
      <div className="flex items-center gap-1.5 text-faint">
        <span className="flex size-3 shrink-0 items-center justify-center">{mark}</span>
        <span className="whitespace-nowrap font-heading text-[10px] font-bold uppercase leading-none tracking-[0.06em]">
          {label}
        </span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * La fila repite el gesto del cliente: el nombre ocupa el espacio y el código
 * se queda entero a la derecha. Si hay más de uno, el recuento acompaña al código
 * y el título de la fila enumera el resto, sin partir nombres a la mitad.
 */
function ProductValue({ products }: { products: TicketProductResponse[] | undefined }) {
  const list = products ?? [];
  const summary = formatTicketProductsSummary(list);

  if (list.length === 0) {
    return <span className="block truncate text-[12px] font-normal leading-[16px] text-faint">Sin productos</span>;
  }

  const [first, ...rest] = list;
  const extraLabel =
    rest.length > 0 ? `${rest.length} ${rest.length === 1 ? "producto más" : "productos más"}. ${summary ?? ""}` : undefined;

  return (
    <span className="flex min-w-0 items-center justify-between gap-2">
      <span className="truncate text-[12px] font-medium leading-[16px] text-ink">{first.productName}</span>
      <span className="flex shrink-0 items-center gap-1">
        {rest.length > 0 && (
          <span title={summary ?? undefined} aria-label={extraLabel}>
            <CodeBadge>+{rest.length}</CodeBadge>
          </span>
        )}
        {first.productCode ? <CodeBadge>{first.productCode}</CodeBadge> : null}
      </span>
    </span>
  );
}

/**
 * Ficha de ticket. El alto exterior medido sigue en 278px: el borde de la tarjeta
 * suma 2px al presupuesto interior, que no cambió.
 *
 * Presupuesto interior, idéntico al anterior:
 * 16 + 24 + 10 + 40 + 12 + 126 + 8 + 24 + 16 = 276.
 * 1. Cabecera `h-6`: código a la izquierda; prioridad y estado a la derecha.
 * 2. Asunto `h-[40px]`: dos líneas de 20px, alineadas por arriba entre tarjetas.
 * 3. Panel `126px`: tres franjas de 28px (cliente, departamento, productos) sobre el mismo eje,
 *    y una banda blanca de 40px partida al 50% (motivo | SLA). El borde del panel suma 2px.
 * 4. Pie `h-6`: responsable a la izquierda, actividad a la derecha.
 */
function TicketCard({ ticket: t, checked, department, onToggleSelect, onOpen }: TicketCardProps) {
  const [copied, setCopied] = useState(false);
  const sla = formatSlaRemaining(t.resolutionDueAt, Boolean(t.pausedAt), t.status, t.closedAt);
  const activity = formatActivityDate(t.lastActivityAt);
  const client = t.clientName && t.clientName !== "Sin cliente" ? t.clientName : null;
  const clientCode = t.clientCode && t.clientCode !== "-" ? t.clientCode : null;
  const productsSummary = formatTicketProductsSummary(t.products);
  const topic = t.topicName?.trim() ? t.topicName : null;

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
      className={`group relative flex min-w-0 flex-col justify-between rounded-card border bg-white p-4 outline-none transition-all duration-180 ${
        checked
          ? "border-brand-red/45 ring-2 ring-brand-red/12 shadow-card"
          : "border-line shadow-card hover:border-hairline-hover/70 focus-visible:ring-2 focus-visible:ring-brand-red/25"
      }`}
    >
      <div className="flex h-6 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <SelectBox
            checked={checked}
            label={`Seleccionar ${t.number}`}
            onToggle={() => onToggleSelect(t.id)}
          />
          <span className="truncate font-heading text-[12.5px] font-bold tabular-nums tracking-[0.01em] text-ink">
            {t.number}
          </span>
          <button
            type="button"
            title={copied ? "Código copiado" : `Copiar código ${t.number}`}
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

        <CardPriorityStatus priority={t.priority} status={t.status} />
      </div>

      <div className="mt-2.5 flex h-[40px] items-start">
        <h3
          className="line-clamp-2 font-heading text-[13.5px] font-bold leading-[20px] tracking-[-0.012em] text-ink transition-colors group-hover:text-brand-red"
          title={t.subject}
        >
          {t.subject}
        </h3>
      </div>

      <div className="mt-3 overflow-hidden rounded-inset border border-line bg-canvas/85 divide-y divide-line">
        <FactRow
          mark={
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${client ? getClientDotColor(client) : "bg-zinc-300"}`}
            />
          }
          label="Cliente"
          title={client ? `${client}${clientCode ? ` (#${clientCode})` : ""}` : "Sin cliente asignado"}
        >
          <span className="flex min-w-0 items-center justify-between gap-2">
            <span
              className={`truncate text-[12px] leading-[16px] ${
                client ? "font-semibold text-ink" : "font-normal text-faint"
              }`}
            >
              {client ?? "Sin cliente"}
            </span>
            {clientCode && <CodeBadge>#{clientCode}</CodeBadge>}
          </span>
        </FactRow>

        <FactRow
          mark={<Building2 aria-hidden className="size-3" />}
          label="Depto."
          title={department ?? "Sin departamento"}
        >
          <span
            className={`block truncate text-[12px] leading-[16px] ${
              department ? "font-medium text-ink" : "font-normal text-faint"
            }`}
          >
            {department ?? "Sin departamento"}
          </span>
        </FactRow>

        <FactRow
          mark={<Package aria-hidden className="size-3" />}
          label="Productos"
          title={productsSummary ?? "Sin productos"}
        >
          <ProductValue products={t.products} />
        </FactRow>

        <div className="grid h-10 grid-cols-2 divide-x divide-line bg-white/55">
          <div className="flex min-w-0 flex-col justify-center gap-0.5 px-3" title={topic ?? "Sin motivo"}>
            <span className="truncate font-heading text-[10px] font-bold uppercase leading-[12px] tracking-[0.06em] text-faint">
              Motivo
            </span>
            <span
              className={`truncate text-[12px] leading-[16px] ${
                topic ? "font-medium text-ink" : "font-normal text-faint"
              }`}
            >
              {topic ?? "Sin motivo"}
            </span>
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-0.5 px-3" title="Compromiso SLA">
            <span className="truncate font-heading text-[10px] font-bold uppercase leading-[12px] tracking-[0.06em] text-faint">
              Compromiso SLA
            </span>
            <div className="flex min-w-0 items-center">
              <SlaCell sla={sla} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex h-6 items-center justify-between gap-3 border-t border-line-soft">
        <div className="min-w-0 flex-1">
          <AssigneeCell id={t.assignedStaffId} name={t.assignedStaffName} />
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-medium tabular-nums leading-none text-subtle"
          title={`Última actividad: ${activity.full}`}
        >
          <Clock aria-hidden className="size-3 shrink-0 text-faint" />
          {activity.compact}
        </span>
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

              <ListSortMenu
                sortValue={sortValue}
                sortOptions={sortFilterOptions}
                onSortChange={handleSortChange}
                menuAriaLabel="Ordenar tickets"
              />
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
