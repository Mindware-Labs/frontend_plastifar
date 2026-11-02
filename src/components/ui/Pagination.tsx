import { useLayoutEffect, useRef } from "react";
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

const SLOTS = 7;

type Slot = number | "gap-start" | "gap-end";

function pageSlots(page: number, totalPages: number): Slot[] {
  if (totalPages <= SLOTS) return Array.from({ length: totalPages }, (_, i) => i + 1);

  if (page <= 4) return [1, 2, 3, 4, 5, "gap-end", totalPages];
  if (page >= totalPages - 3) {
    return [1, "gap-start", ...Array.from({ length: 5 }, (_, i) => totalPages - 4 + i)];
  }
  return [1, "gap-start", page - 1, page, page + 1, "gap-end", totalPages];
}

function nounLabel(total: number, noun: string, nounSingular?: string) {
  return total === 1 ? (nounSingular ?? noun) : noun;
}

function RangeBar({ from, to, total }: { from: number; to: number; total: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative h-1 w-14 shrink-0 overflow-hidden rounded-pill bg-fill"
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
  integrated = false,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  tone?: NavTone;
  integrated?: boolean;
}) {
  const safeTotalPages = Math.max(totalPages, 1);
  const slots = pageSlots(page, safeTotalPages);
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!integrated) return;
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth + 1) return;
    const navBox = nav.getBoundingClientRect();
    const box = current.getBoundingClientRect();
    const pad = 4;
    if (box.left < navBox.left + pad) {
      nav.scrollLeft -= navBox.left + pad - box.left;
    } else if (box.right > navBox.right - pad) {
      nav.scrollLeft += box.right - (navBox.right - pad);
    }
  }, [integrated, page, safeTotalPages]);

  if (integrated) {
    const tile =
      "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-[13px] font-medium tabular-nums leading-none outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400/70";
    const arrow = `${tile} text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent`;
    const active = `${tile} bg-zinc-950 text-white hover:bg-zinc-900`;
    const idle = `${tile} text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900`;

    return (
      <nav
        ref={navRef}
        aria-label="Paginación"
        className="no-scrollbar flex h-8 min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain"
      >
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          title="Página anterior"
          className={arrow}
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>

        {slots.map((slot) =>
          typeof slot === "number" ? (
            <button
              key={slot}
              type="button"
              onClick={() => onPageChange(slot)}
              aria-label={`Página ${slot}`}
              aria-current={slot === page ? "page" : undefined}
              className={slot === page ? active : idle}
            >
              {slot}
            </button>
          ) : (
            <span
              key={slot}
              aria-hidden="true"
              className="inline-flex h-8 w-8 shrink-0 select-none items-center justify-center text-[13px] leading-none text-zinc-400"
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
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </nav>
    );
  }

  const cell =
    "flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center px-1 text-[12px] font-medium tabular-nums outline-none transition-colors focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand-red/30";

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
        <ChevronLeft className="h-4 w-4" />
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
            className="flex h-7 w-6 select-none items-center justify-center text-faint"
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
        <ChevronRight className="h-4 w-4" />
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
    <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-subtle">
      Filas
      <Select
        size="xs"
        className="w-[50px]"
        buttonClassName="!gap-1 !px-1.5"
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

/** Pie de la bandeja: conteo, bloque de controles y estado, en un solo eje centrado. */
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
    <div className="flex w-full min-w-0 flex-col items-center gap-2.5 py-3">
      <p
        className="max-w-full px-1 text-center text-[13px] font-normal leading-none text-zinc-600 tabular-nums"
        title={`Mostrando ${from} a ${to} de ${total}`}
      >
        {from} – {to} de {total} {label}
      </p>

      <div className="w-fit max-w-full min-w-0 rounded-[12px] border border-zinc-200 bg-white">
        <div className="grid min-w-0 grid-cols-[auto_1px_minmax(0,max-content)] grid-rows-[auto_auto] items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
          <span className="col-start-1 row-start-1 justify-self-center text-[10px] font-medium uppercase leading-none tracking-[0.16em] text-zinc-500">
            Filas
          </span>

          <Select
            size="xs"
            className="col-start-1 row-start-2 w-[3.75rem] justify-self-center"
            buttonClassName="!h-8 !gap-1 !rounded-lg !border-zinc-200 !px-2 !py-0 !text-[13px] !font-medium !leading-none !tabular-nums !shadow-none"
            matchTriggerWidth
            aria-label="Filas por página"
            value={String(pageSize)}
            onChange={(next) => onPageSizeChange(Number(next))}
            options={opcionesDeTamano(pageSize).map((size) => ({
              value: String(size),
              label: String(size),
            }))}
          />

          <div
            aria-hidden="true"
            className="col-start-2 row-span-2 row-start-1 w-px self-stretch bg-zinc-200"
          />

          <div className="col-start-3 row-start-2 min-w-0">
            <PageNav
              page={page}
              totalPages={totalPages}
              onPageChange={onPageChange}
              tone="neutral"
              integrated
            />
          </div>
        </div>
      </div>

      <p
        className="text-center text-[11px] font-normal leading-none tracking-[0.01em] text-zinc-500 tabular-nums"
        aria-hidden="true"
      >
        Página {page} de {safeTotalPages}
      </p>
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
