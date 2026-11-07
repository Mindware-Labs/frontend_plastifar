import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  X,
} from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "../../lib/portal";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";

export interface DatePickerProps {
  value: string; // Formato "YYYY-MM-DD" o cadena vacía
  onChange: (value: string) => void;
  showTime?: boolean;
  timeValue?: string; // Formato "HH:mm" o cadena vacía
  onTimeChange?: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  headerLabel?: string;
  className?: string;
  align?: "start" | "center" | "end";
  error?: string;
  state?: "idle" | "valid" | "error";
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

function formatTime12h(timeStr?: string): string {
  if (!timeStr) return "";
  const [hStr, mStr] = timeStr.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const period = h >= 12 ? "p.m." : "a.m.";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = String(m).padStart(2, "0");
  return `${displayH}:${displayM} ${period}`;
}

function formatDisplayValue(dateStr: string, showTime?: boolean, timeStr?: string): string {
  const d = formatDisplayDate(dateStr);
  if (!d) return "";
  if (showTime && timeStr) {
    return `${d} · ${formatTime12h(timeStr)}`;
  }
  return d;
}

function parseTime24(timeStr: string): { h24: number; minute: number } | null {
  if (!timeStr) return null;
  const [hStr, mStr] = timeStr.split(":");
  const h24 = Number(hStr);
  const minute = Number(mStr);
  if (isNaN(h24) || isNaN(minute) || h24 < 0 || h24 > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { h24, minute };
}

function toTime24(h24: number, minute: number): string {
  const h = ((h24 % 24) + 24) % 24;
  const m = ((minute % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function to12hParts(h24: number): { hour12: number; period: "am" | "pm" } {
  const period: "am" | "pm" = h24 >= 12 ? "pm" : "am";
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour12, period };
}

function from12h(hour12: number, period: "am" | "pm"): number {
  if (period === "am") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

const TIME_QUICK_PRESETS: { label: string; value: string }[] = [
  { label: "9 a.m.", value: "09:00" },
  { label: "12 m.", value: "12:00" },
  { label: "5 p.m.", value: "17:00" },
  { label: "Fin día", value: "23:59" },
];

function TimeStepButton({
  direction,
  label,
  onClick,
}: {
  direction: "up" | "down";
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "up" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-4 w-full items-center justify-center rounded text-faint outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/20 cursor-pointer"
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}

function InlineTimePicker({
  timeValue,
  onTimeChange,
  onNeedDate,
}: {
  timeValue: string;
  onTimeChange: (value: string) => void;
  onNeedDate: () => void;
}) {
  const parsed = parseTime24(timeValue);
  const hasTime = Boolean(parsed);
  const { h24, minute } = parsed ?? { h24: 12, minute: 0 };
  const { hour12, period } = to12hParts(h24);

  function commit(nextH24: number, nextMinute: number) {
    onTimeChange(toTime24(nextH24, nextMinute));
    onNeedDate();
  }

  function bumpHour(delta: number) {
    const nextH24 = ((h24 + delta) % 24 + 24) % 24;
    commit(nextH24, minute);
  }

  function bumpMinute(delta: number) {
    let total = h24 * 60 + minute + delta * 5;
    total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    commit(Math.floor(total / 60), total % 60);
  }

  function setPeriod(next: "am" | "pm") {
    if (next === period && hasTime) return;
    commit(from12h(hour12, next), minute);
  }

  function applyPreset(value: string) {
    onTimeChange(value);
    onNeedDate();
  }

  const valueClass = hasTime
    ? "text-[13px] font-bold text-zinc-900"
    : "text-[13px] font-semibold text-zinc-400";

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1">
        <div
          className="flex flex-col items-center rounded-md border border-zinc-200 bg-white px-0.5 shadow-2xs"
          aria-label="Hora"
        >
          <TimeStepButton direction="up" label="Aumentar hora" onClick={() => bumpHour(1)} />
          <span className={`tabular-nums leading-none ${valueClass}`}>
            {String(hour12).padStart(2, "0")}
          </span>
          <TimeStepButton direction="down" label="Disminuir hora" onClick={() => bumpHour(-1)} />
        </div>

        <span className="text-[12px] font-bold text-zinc-300">:</span>

        <div
          className="flex flex-col items-center rounded-md border border-zinc-200 bg-white px-0.5 shadow-2xs"
          aria-label="Minutos"
        >
          <TimeStepButton direction="up" label="Aumentar minutos" onClick={() => bumpMinute(1)} />
          <span className={`tabular-nums leading-none ${valueClass}`}>
            {String(minute).padStart(2, "0")}
          </span>
          <TimeStepButton direction="down" label="Disminuir minutos" onClick={() => bumpMinute(-1)} />
        </div>

        <div
          role="group"
          aria-label="Periodo del día"
          className="flex flex-col gap-0.5 rounded-md border border-zinc-200 bg-white p-0.5 shadow-2xs"
        >
          {(["am", "pm"] as const).map((p) => {
            const selected = hasTime && period === p;
            const label = p === "am" ? "a.m." : "p.m.";
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-red/20 ${
                  selected
                    ? "bg-zinc-100 text-zinc-900 shadow-2xs"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {TIME_QUICK_PRESETS.map((preset) => {
          const isSelected = timeValue === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => applyPreset(preset.value)}
              className={`h-6 rounded-md text-[10px] font-medium transition-all cursor-pointer shadow-2xs ${
                isSelected
                  ? "border border-zinc-300 bg-zinc-200/80 font-semibold text-zinc-900"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
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
    label: "+3 días",
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return toDateString(d);
    },
  },
  {
    label: "+1 sem.",
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return toDateString(d);
    },
  },
];

const PANEL_WIDTH = 276;
const PANEL_HEIGHT = 310;
const PANEL_HEIGHT_WITH_TIME = 430;
const VIEWPORT_PAD = 12;
const TRIGGER_GAP = 6;

export function DatePicker({
  value,
  onChange,
  showTime = false,
  timeValue = "",
  onTimeChange,
  placeholder = "Seleccionar fecha...",
  id,
  disabled = false,
  minDate,
  maxDate,
  headerLabel = "Fecha límite",
  className = "",
  align = "center",
  error,
  state = "idle",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{
    top: number;
    left: number;
    originX: number;
    width: number;
    maxHeight: number;
    dropUp: boolean;
  } | null>(null);

  const initialDate = parseDate(value) ?? new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const measureRafRef = useRef<number | null>(null);
  const generatedId = useId();
  const pickerId = id ?? generatedId;

  const dropUp = anchor?.dropUp ?? false;
  const { mounted, exiting, ref: motionRef } = useDisclosureMotion<HTMLDivElement>(open, {
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

  function measure(contentHeight?: number) {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const panelWidth = PANEL_WIDTH;
    const estimatedHeight = contentHeight ?? (showTime ? PANEL_HEIGHT_WITH_TIME : PANEL_HEIGHT);
    const viewportMax = window.innerHeight - 2 * VIEWPORT_PAD;

    let top: number;
    let maxHeight: number;
    let dropUp: boolean;

    if (estimatedHeight <= viewportMax) {
      maxHeight = estimatedHeight;
      top = rect.bottom + TRIGGER_GAP;
      const maxTop = window.innerHeight - VIEWPORT_PAD - estimatedHeight;
      if (top > maxTop) {
        top = maxTop;
      }
      if (top < VIEWPORT_PAD) {
        top = VIEWPORT_PAD;
      }
      dropUp = top + estimatedHeight / 2 < rect.top + rect.height / 2;
    } else {
      top = VIEWPORT_PAD;
      maxHeight = viewportMax;
      dropUp = false;
    }

    let left = rect.left;
    if (align === "center") {
      left = rect.left + (rect.width - panelWidth) / 2;
    } else if (align === "end") {
      left = rect.right - panelWidth;
    }

    if (left + panelWidth > window.innerWidth - VIEWPORT_PAD) {
      left = Math.max(VIEWPORT_PAD, window.innerWidth - panelWidth - VIEWPORT_PAD);
    }
    if (left < VIEWPORT_PAD) {
      left = VIEWPORT_PAD;
    }

    setAnchor({
      left,
      top,
      originX: rect.left + rect.width / 2 - left,
      width: panelWidth,
      maxHeight,
      dropUp,
    });
  }

  const measureRef = useRef(measure);
  measureRef.current = measure;

  function scheduleMeasure() {
    if (measureRafRef.current != null) return;
    measureRafRef.current = requestAnimationFrame(() => {
      measureRafRef.current = null;
      const naturalHeight = panelRef.current?.scrollHeight;
      measureRef.current(naturalHeight);
    });
  }

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    scheduleMeasure();
  }, [open, showTime, value, timeValue]);

  useEffect(() => {
    return () => {
      if (measureRafRef.current != null) {
        cancelAnimationFrame(measureRafRef.current);
      }
    };
  }, []);

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

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      if (
        target instanceof Element &&
        target.closest("[data-datepicker-portal]") !== null
      ) {
        return;
      }
      close();
    }

    function handleScroll(event: Event) {
      const target = event.target;
      if (panelRef.current?.contains(target as Node)) {
        return;
      }

      if (
        target !== document &&
        target !== document.documentElement &&
        target !== document.body &&
        target !== window
      ) {
        scheduleMeasure();
        return;
      }

      scheduleMeasure();
    }

    function handleResize() {
      scheduleMeasure();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

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
    if (!showTime) {
      close();
      triggerRef.current?.focus();
    }
  }

  function handleClear() {
    onChange("");
    if (showTime && onTimeChange) {
      onTimeChange("");
    }
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    const target = preset.getDate();
    onChange(target);
    const parsed = parseDate(target);
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
    if (!showTime) {
      close();
      triggerRef.current?.focus();
    }
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
        className={`w-full flex items-center justify-between gap-2 rounded-md border bg-white px-2.5 h-8 text-left text-[12.5px] shadow-2xs outline-none transition-all cursor-pointer ${
          error || state === "error"
            ? "border-brand-red bg-red-50/15 ring-1 ring-brand-red/20"
            : open
            ? "border-brand-red ring-2 ring-brand-red/10"
            : "border-zinc-200 hover:border-zinc-300 focus-visible:border-brand-red focus-visible:ring-2 focus-visible:ring-brand-red/20"
        } ${disabled ? "cursor-not-allowed bg-zinc-50 text-faint" : "text-zinc-800"} ${className}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <span className="truncate whitespace-nowrap tabular-nums">
            {hasSelection ? (
              <span className="font-semibold text-zinc-900">
                {formatDisplayValue(value, showTime, timeValue)}
              </span>
            ) : (
              <span className="font-normal text-faint">{placeholder}</span>
            )}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {hasSelection && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Limpiar fecha"
              title="Limpiar fecha"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="flex h-4 w-4 items-center justify-center rounded text-faint hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            >
              <X className="h-3 w-3" />
            </span>
          ) : (
            <span className="h-4 w-4 shrink-0" aria-hidden />
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
                className="fixed inset-0 z-[70] pointer-events-none"
                aria-hidden="true"
              />
            )}
            <div
              ref={(node) => {
                panelRef.current = node;
                motionRef.current = node;
              }}
              data-datepicker-portal
              role="dialog"
              aria-modal="false"
              style={{
                position: "fixed",
                left: anchor.left,
                top: anchor.top,
                width: anchor.width,
                maxHeight: anchor.maxHeight,
                transformOrigin: `${anchor.originX}px ${dropUp ? "bottom" : "top"}`,
              }}
              className={`${
                exiting ? "pointer-events-none" : ""
              } no-scrollbar z-[80] flex flex-col gap-1.5 rounded-lg border border-zinc-200/90
                bg-white p-2 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)] select-none overflow-y-auto overscroll-contain`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-faint">
                  {headerLabel}
                </span>
                {hasSelection ? (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="shrink-0 text-[10px] font-medium text-brand-red hover:underline cursor-pointer"
                  >
                    Borrar
                  </button>
                ) : (
                  <span className="text-[10px] text-faint truncate">
                    {showTime ? "Sin fecha/hora" : "Sin fecha"}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1">
                {PRESETS.map((preset) => {
                  const target = preset.getDate();
                  const isSelected = value === target;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`h-6 rounded-md text-[10.5px] font-medium transition-all outline-none select-none cursor-pointer active:scale-[0.98] shadow-2xs ${
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

              <div className="rounded-md border border-zinc-200/90 bg-white p-1.5 shadow-2xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-heading text-[11px] font-bold tracking-tight text-zinc-900 capitalize">
                    {MONTH_NAMES[viewMonth].slice(0, 3)} {viewYear}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={prevMonth}
                      aria-label="Mes anterior"
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 shadow-2xs outline-none transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/20 cursor-pointer"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={nextMonth}
                      aria-label="Mes siguiente"
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 shadow-2xs outline-none transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/20 cursor-pointer"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="mb-0.5 grid grid-cols-7 text-center">
                  {WEEKDAY_NAMES.map((name) => (
                    <span
                      key={name}
                      className="font-heading text-[9px] font-semibold uppercase tracking-wide text-faint"
                    >
                      {name}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 text-center">
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
                        className={`flex h-6 w-full items-center justify-center text-[10px] tabular-nums outline-none transition-colors select-none active:scale-95 ${dayClass}`}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>

                {!showTime && (
                  <p className="mt-1 border-t border-zinc-100 pt-1 text-[9.5px] font-medium text-faint truncate">
                    {hasSelection
                      ? `${formatFriendlyDate(value)} seleccionada`
                      : "Elige un día"}
                  </p>
                )}
              </div>

              {showTime && (
                <div className="flex flex-col gap-1 rounded-md border border-zinc-200/90 bg-zinc-50/70 p-1.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1 font-heading text-[10px] font-semibold text-zinc-600">
                      <Clock className="h-3 w-3 text-zinc-400" />
                      Hora
                    </span>
                    {timeValue ? (
                      <button
                        type="button"
                        onClick={() => onTimeChange?.("")}
                        className="text-[9.5px] font-medium text-faint hover:text-brand-red transition-colors cursor-pointer"
                      >
                        Quitar
                      </button>
                    ) : (
                      <span className="text-[9.5px] text-faint">Opc.</span>
                    )}
                  </div>

                  <InlineTimePicker
                    timeValue={timeValue ?? ""}
                    onTimeChange={(next) => onTimeChange?.(next)}
                    onNeedDate={() => {
                      if (!value) onChange(todayStr);
                    }}
                  />
                </div>
              )}

              {showTime && (
                <div className="flex items-center justify-end border-t border-zinc-100 pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      triggerRef.current?.focus();
                    }}
                    className="inline-flex h-7 items-center justify-center rounded-md bg-zinc-900 px-3 text-[11px] font-semibold text-white shadow-2xs hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
                  >
                    Listo
                  </button>
                </div>
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
