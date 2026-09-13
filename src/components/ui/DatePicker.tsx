import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";

export interface DatePickerProps {
  value: string; // Formato "YYYY-MM-DD" o cadena vacía
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  headerLabel?: string;
  className?: string;
  align?: "start" | "center" | "end";
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEKDAY_NAMES = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDisplayDate(str: string): string {
  const d = parseDate(str);
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatFriendlyDate(str: string): string {
  const d = parseDate(str);
  if (!d) return "";
  const day = d.getDate();
  const monthShort = MONTH_NAMES[d.getMonth()].slice(0, 3).toLowerCase();
  return `${day} ${monthShort}`;
}

const PRESETS = [
  {
    label: "Hoy",
    getDate: () => toDateString(new Date()),
  },
  {
    label: "Mañana",
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return toDateString(d);
    },
  },
  {
    label: "En 3 días",
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return toDateString(d);
    },
  },
  {
    label: "En 1 sem.",
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return toDateString(d);
    },
  },
];

const PANEL_WIDTH = 310;
const PANEL_HEIGHT = 380;

export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha...",
  id,
  disabled = false,
  minDate,
  maxDate,
  headerLabel = "Fecha límite",
  className = "",
  align = "center",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    originX: number;
  } | null>(null);

  const initialDate = parseDate(value) ?? new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const pickerId = id ?? generatedId;

  const dropUp = anchor?.bottom !== undefined;
  const { mounted, exiting, ref: motionRef, snap } = useDisclosureMotion<HTMLDivElement>(open, {
    direction: dropUp ? "up" : "down",
  });

  const todayStr = toDateString(new Date());

  // Si el valor cambia desde fuera, el mes visible lo acompaña sin disparar efectos en cascada
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    const parsed = value ? parseDate(value) : null;
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }

  function close() {
    setOpen(false);
  }

  function measure() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldDropUp = spaceBelow < PANEL_HEIGHT && rect.top > spaceBelow;

    let left = rect.left;
    if (align === "center") {
      left = rect.left + (rect.width - PANEL_WIDTH) / 2;
    } else if (align === "end") {
      left = rect.right - PANEL_WIDTH;
    }

    if (left + PANEL_WIDTH > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - PANEL_WIDTH - 12);
    }
    if (left < 12) {
      left = 12;
    }

    setAnchor({
      left,
      top: shouldDropUp ? undefined : rect.bottom + 6,
      bottom: shouldDropUp ? window.innerHeight - rect.top + 6 : undefined,
      originX: rect.left + rect.width / 2 - left,
    });
  }

  function toggle() {
    if (disabled) return;
    if (open) {
      close();
      return;
    }
    measure();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    }

    function handleViewportChange() {
      close();
      snap();
    }

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open, snap]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleDateClick(dateStr: string) {
    if (minDate && dateStr < minDate) return;
    if (maxDate && dateStr > maxDate) return;

    onChange(dateStr);
    close();
    triggerRef.current?.focus();
  }

  function handleClear() {
    onChange("");
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    const target = preset.getDate();
    onChange(target);
    const parsed = parseDate(target);
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
    close();
    triggerRef.current?.focus();
  }

  // Generar cuadrícula de días comenzando en lunes
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);

  let startOffset = firstDay.getDay() - 1;
  if (startOffset === -1) startOffset = 6;

  const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(viewYear, viewMonth - 1, prevMonthLastDay - i);
    days.push({
      dateStr: toDateString(d),
      dayNum: prevMonthLastDay - i,
      isCurrentMonth: false,
    });
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(viewYear, viewMonth, i);
    days.push({
      dateStr: toDateString(d),
      dayNum: i,
      isCurrentMonth: true,
    });
  }

  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewYear, viewMonth + 1, i);
      days.push({
        dateStr: toDateString(d),
        dayNum: i,
        isCurrentMonth: false,
      });
    }
  }

  const hasSelection = Boolean(value);

  return (
    <div className={`relative ${className}`}>
      {/* Botón Disparador estilo nativo Plastifar */}
      <button
        ref={triggerRef}
        id={pickerId}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 rounded-md border bg-white px-3 py-1.5 text-left text-[12.5px] shadow-2xs outline-none transition-all cursor-pointer ${
          open
            ? "border-brand-red ring-2 ring-brand-red/10"
            : "border-zinc-200 hover:border-zinc-300 focus-visible:border-brand-red focus-visible:ring-2 focus-visible:ring-brand-red/20"
        } ${disabled ? "cursor-not-allowed bg-zinc-50 text-zinc-400" : "text-zinc-800"}`}
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          {hasSelection ? (
            <span className="font-semibold text-zinc-900 tabular-nums">
              {formatDisplayDate(value)}
            </span>
          ) : (
            <span className="text-zinc-400 font-normal">{placeholder}</span>
          )}
        </span>

        <span className="flex items-center gap-1.5 shrink-0">
          {hasSelection && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Limpiar fecha"
              title="Limpiar fecha"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="flex h-4 w-4 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      {/* Popover desplegable mediante Portal */}
      {mounted &&
        anchor &&
        createPortal(
          <>
            {!exiting && (
              <div
                className="fixed inset-0 z-[70]"
                aria-hidden="true"
                onPointerDown={close}
              />
            )}
            <div
              ref={(node) => {
                panelRef.current = node;
                motionRef.current = node;
              }}
              style={{
                position: "fixed",
                left: anchor.left,
                top: anchor.top,
                bottom: anchor.bottom,
                width: PANEL_WIDTH,
                transformOrigin: `${anchor.originX}px ${dropUp ? "bottom" : "top"}`,
              }}
              className={`${
                exiting ? "pointer-events-none" : ""
              } z-[80] flex flex-col gap-2.5 rounded-lg border border-zinc-200/90
                bg-white p-3 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)] select-none`}
            >
              {/* Cabecera y estado de selección */}
              <div className="flex items-center justify-between">
                <span className="font-heading text-[10.5px] font-bold uppercase tracking-wider text-zinc-400">
                  {headerLabel}
                </span>

                {hasSelection ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200/90 bg-red-50/80 px-2 py-0.5 text-[11px] font-semibold text-brand-red shadow-2xs">
                    <CalendarIcon className="h-3 w-3 shrink-0 text-brand-red" />
                    <span className="tabular-nums">{formatDisplayDate(value)}</span>
                    <button
                      type="button"
                      onClick={handleClear}
                      aria-label="Quitar fecha"
                      title="Quitar fecha"
                      className="ml-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-brand-red hover:bg-red-200/50 transition-colors cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-zinc-400">Sin fecha límite</span>
                )}
              </div>

              {/* Accesos rápidos de un solo clic */}
              <div className="grid grid-cols-4 gap-1.5">
                {PRESETS.map((preset) => {
                  const target = preset.getDate();
                  const isSelected = value === target;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`h-7.5 rounded-lg text-[11.5px] font-medium transition-all outline-none select-none cursor-pointer active:scale-[0.98] shadow-2xs ${
                        isSelected
                          ? "border border-zinc-300 bg-zinc-100 font-semibold text-zinc-900"
                          : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Calendario interactivo Plastifar */}
              <div className="rounded-lg border border-zinc-200/90 bg-white p-2.5 shadow-2xs">
                {/* Navegación de mes */}
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-heading text-[12px] font-bold tracking-tight text-zinc-900 capitalize">
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={prevMonth}
                      aria-label="Mes anterior"
                      className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 shadow-2xs outline-none transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/20 cursor-pointer"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={nextMonth}
                      aria-label="Mes siguiente"
                      className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 shadow-2xs outline-none transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/20 cursor-pointer"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Encabezados de días */}
                <div className="mb-1 grid grid-cols-7 text-center">
                  {WEEKDAY_NAMES.map((name) => (
                    <span
                      key={name}
                      className="font-heading text-[10px] font-semibold uppercase tracking-wider text-zinc-400 py-0.5"
                    >
                      {name}
                    </span>
                  ))}
                </div>

                {/* Cuadrícula de días */}
                <div className="grid grid-cols-7 gap-y-0.5 text-center">
                  {days.map(({ dateStr, dayNum, isCurrentMonth }) => {
                    const isSelected = dateStr === value;
                    const isToday = dateStr === todayStr;
                    const isDisabled =
                      (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate);

                    let dayClass = "";
                    if (isDisabled) {
                      dayClass = "text-zinc-300 cursor-not-allowed";
                    } else if (isSelected) {
                      dayClass =
                        "rounded-md bg-brand-red text-white font-semibold shadow-2xs cursor-pointer";
                    } else if (isToday) {
                      dayClass =
                        "rounded-md font-bold text-brand-red bg-red-50/70 ring-1 ring-red-200/90 cursor-pointer";
                    } else if (!isCurrentMonth) {
                      dayClass =
                        "text-zinc-300 hover:text-zinc-500 hover:bg-zinc-50 rounded-md cursor-pointer";
                    } else {
                      dayClass =
                        "text-zinc-700 font-medium hover:bg-zinc-100 hover:text-zinc-900 rounded-md cursor-pointer";
                    }

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        disabled={Boolean(isDisabled)}
                        onClick={() => handleDateClick(dateStr)}
                        aria-label={dateStr}
                        className={`flex h-7 w-full items-center justify-center text-[11px] tabular-nums outline-none transition-colors select-none active:scale-95 ${dayClass}`}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>

                {/* Mensaje de guía inferior */}
                <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2 text-[10.5px]">
                  <span className="font-medium text-zinc-400">
                    {hasSelection
                      ? `${formatFriendlyDate(value)} seleccionada`
                      : "Elige un día del calendario"}
                  </span>
                  {hasSelection && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="font-medium text-brand-red hover:underline cursor-pointer"
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
