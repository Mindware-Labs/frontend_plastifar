import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "./Select";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  noun: string;
  nounSingular?: string;
  layout?: "toolbar" | "panel";
}

const pageSizes = [10, 25, 50];

function opcionesDeTamano(actual: number): number[] {
  return pageSizes.includes(actual) ? pageSizes : [...pageSizes, actual].sort((a, b) => a - b);
}

type Slot = number | "gap-start" | "gap-end";

function pageSlots(page: number, totalPages: number, maxSlots = 7): Slot[] {
  if (totalPages <= maxSlots) return Array.from({ length: totalPages }, (_, i) => i + 1);

  if (maxSlots <= 5) {
    if (page <= 3) return [1, 2, 3, "gap-end", totalPages];
    if (page >= totalPages - 2) return [1, "gap-start", totalPages - 2, totalPages - 1, totalPages];
    return [1, "gap-start", page, "gap-end", totalPages];
  }

  if (page <= 4) return [1, 2, 3, 4, 5, "gap-end", totalPages];
  if (page >= totalPages - 3) {
    return [1, "gap-start", ...Array.from({ length: 5 }, (_, i) => totalPages - 4 + i)];
  }
  return [1, "gap-start", page - 1, page, page + 1, "gap-end", totalPages];
}

function nounLabel(total: number, noun: string, nounSingular?: string) {
  return total === 1 ? (nounSingular ?? noun) : noun;
}

function RangeBar({
  from,
  to,
  total,
  className = "w-14",
}: {
  from: number;
  to: number;
  total: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative h-1 shrink-0 overflow-hidden rounded-pill bg-fill ${className}`}
    >
      <span
        className="absolute inset-y-0 rounded-pill bg-brand-red"
        style={{
          left: `${((from - 1) / total) * 100}%`,
          width: `${Math.max(((to - from + 1) / total) * 100, 8)}%`,
        }}
      />
    </span>
  );
}

type NavTone = "brand" | "neutral";

function PageNav({
  page,
  totalPages,
  onPageChange,
  tone = "brand",
  maxSlots = 7,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  tone?: NavTone;
  maxSlots?: 5 | 7;
}) {
  const safeTotalPages = Math.max(totalPages, 1);
  const slots = pageSlots(page, safeTotalPages, maxSlots);

  const cell =
    "flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center px-1 text-[12px] font-medium leading-none tabular-nums outline-none transition-colors focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand-red/30";

  const arrow = `${cell} text-subtle hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:text-line-strong disabled:hover:bg-transparent`;

  const activeClass = tone === "brand" ? "bg-brand-red text-white" : "bg-zinc-800 text-white shadow-sm";

  const idleClass =
    tone === "brand"
      ? "text-brand-gray hover:bg-canvas hover:text-ink"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";

  return (
    <nav
      aria-label="Paginación"
      className="flex max-w-full shrink-0 items-center divide-x divide-line-strong overflow-hidden rounded-edge border border-line-strong bg-white"
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
        title="Página anterior"
        className={arrow}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {slots.map((slot) =>
        typeof slot === "number" ? (
          <button
            key={slot}
            type="button"
            onClick={() => onPageChange(slot)}
            aria-label={`Página ${slot}`}
            aria-current={slot === page ? "page" : undefined}
            className={`${cell} ${slot === page ? activeClass : idleClass}`}
          >
            {slot}
          </button>
        ) : (
          <span
            key={slot}
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 select-none items-center justify-center text-[12px] leading-none text-faint"
          >
            …
          </span>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= safeTotalPages}
        aria-label="Página siguiente"
        title="Página siguiente"
        className={arrow}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </nav>
  );
}

function ToolbarRowsSelect({
  pageSize,
  onPageSizeChange,
}: {
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <label className="flex h-7 shrink-0 items-center gap-1.5 text-[12px] leading-none text-subtle">
      <span>Filas</span>
      <Select
        size="xs"
        centered
        className="w-[52px]"
        buttonClassName="!h-7 !gap-1 !rounded-edge !border-line-strong !bg-white !px-2 !py-0 !text-[12px] !font-medium !leading-none !tabular-nums !text-ink !shadow-none hover:!border-hairline-hover hover:!bg-canvas"
        matchTriggerWidth
        aria-label="Filas por página"
        value={String(pageSize)}
        onChange={(next) => onPageSizeChange(Number(next))}
        options={opcionesDeTamano(pageSize).map((size) => ({
          value: String(size),
          label: String(size),
        }))}
      />
    </label>
  );
}

/** Pie compacto de la bandeja: dos filas simétricas alineadas a los bordes del panel. */
function PanelPagination({
  page,
  pageSize,
  total,
  totalPages,
  from,
  to,
  noun,
  nounSingular,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
  noun: string;
  nounSingular?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const label = nounLabel(total, noun, nounSingular);
  const safeTotalPages = Math.max(totalPages, 1);

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5 py-2 text-[12px] text-subtle">
      <div className="flex h-4 min-w-0 items-center justify-between gap-2 leading-none tabular-nums">
        <p
          className="min-w-0 truncate"
          title={`Mostrando ${from} a ${to} de ${total}`}
        >
          <span className="font-semibold text-ink">{total}</span> {label}
          <span className="sr-only">
            {" "}
            (mostrando {from} a {to})
          </span>
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <RangeBar from={from} to={to} total={total} className="w-10" />
          <span aria-hidden="true">
            Pág. <span className="font-semibold text-ink">{page}</span>/{safeTotalPages}
          </span>
        </div>
      </div>

      <div className="flex h-7 min-w-0 items-center justify-between gap-2">
        <ToolbarRowsSelect pageSize={pageSize} onPageSizeChange={onPageSizeChange} />
        <PageNav
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          tone="brand"
          maxSlots={5}
        />
      </div>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  noun,
  nounSingular,
  layout = "toolbar",
}: PaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  if (layout === "panel") {
    return (
      <PanelPagination
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        from={from}
        to={to}
        noun={noun}
        nounSingular={nounSingular}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );
  }

  const label = nounLabel(total, noun, nounSingular);

  return (
    <div className="flex flex-nowrap items-center justify-between gap-3 py-2 text-[12px] text-subtle">
      <p
        className="flex min-w-0 items-center gap-2.5 tabular-nums"
        title={`Mostrando ${from} a ${to} de ${total}`}
      >
        <span className="truncate">
          <span className="font-semibold text-ink">{total}</span> {label}
        </span>
        <RangeBar from={from} to={to} total={total} />
        <span className="sr-only">
          Mostrando {from} a {to} de {total}
        </span>
      </p>

      <div className="flex shrink-0 flex-nowrap items-center gap-3">
        <ToolbarRowsSelect pageSize={pageSize} onPageSizeChange={onPageSizeChange} />
        <PageNav page={page} totalPages={totalPages} onPageChange={onPageChange} tone="brand" />
      </div>
    </div>
  );
}
