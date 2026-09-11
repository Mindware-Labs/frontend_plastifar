import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";

interface DateRangePickerProps {
  since: string;
  until: string;
  onChange: (since: string, until: string) => void;
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

function countDays(since: string, until: string): number {
  const s = parseDate(since);
  const u = parseDate(until);
  if (!s || !u) return 1;
  const diffTime = Math.abs(u.getTime() - s.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

const PRESETS = [
  {
    label: "Hoy",
    getRange: () => {
      const today = toDateString(new Date());
      return { since: today, until: today };
    },
  },
  {
    label: "7 días",
    getRange: () => {
      const now = new Date();
      const until = toDateString(now);
      const past = new Date(now);
      past.setDate(now.getDate() - 6);
      return { since: toDateString(past), until };
    },
  },
  {
    label: "30 días",
    getRange: () => {
      const now = new Date();
      const until = toDateString(now);
      const past = new Date(now);
      past.setDate(now.getDate() - 29);
      return { since: toDateString(past), until };
    },
  },
  {
    label: "Este mes",
    getRange: () => {
      const now = new Date();
      const until = toDateString(now);
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { since: toDateString(start), until };
    },
  },
];

export function DateRangePicker({ since, until, onChange }: DateRangePickerProps) {
  const initialDate = parseDate(since) ?? parseDate(until) ?? new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const todayStr = toDateString(new Date());
  const hasSelection = Boolean(since || until);
  const isSingleDay = since && until && since === until;
  const isRange = since && until && since !== until;

  // Estado de selección interactiva: si solo hay 'since' y se está esperando el segundo clic
  const isSelectingRange = Boolean(since && (!until || isSingleDay));

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
    // Si no hay nada seleccionado, o ya había un rango completo definido:
    // El primer clic fija un día único y permite expandir en el segundo clic
    if (!since || (since && until && since !== until)) {
      onChange(dateStr, dateStr);
      setHoveredDate(null);
      return;
    }

    // Si ya había una fecha inicial (o día único):
    if (since === until) {
      if (dateStr === since) {
        // Clic en el mismo día de nuevo: se mantiene como día único
        return;
      }
      if (dateStr < since) {
        onChange(dateStr, since);
      } else {
        onChange(since, dateStr);
      }
      setHoveredDate(null);
      return;
    }

    // Caso general
    onChange(dateStr, dateStr);
    setHoveredDate(null);
  }

  function clearDates() {
    onChange("", "");
    setHoveredDate(null);
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    const range = preset.getRange();
    onChange(range.since, range.until);
    setHoveredDate(null);
    const parsed = parseDate(range.since);
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }

  // Generar cuadrícula de días con inicio de semana en lunes (convención RD / LatAm)
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

  // Resumen textual amigable
  let summaryText = "Cualquier fecha";
  let hintText = "Haz clic en un día o selecciona dos para definir un período.";

  if (isSingleDay) {
    summaryText = formatDisplayDate(since);
    hintText = `${formatFriendlyDate(since)} · Haz clic en otra fecha para crear un rango.`;
  } else if (isRange) {
    const daysCount = countDays(since, until);
    summaryText = `${formatDisplayDate(since)} – ${formatDisplayDate(until)}`;
    hintText = `${formatFriendlyDate(since)} al ${formatFriendlyDate(until)} (${daysCount} días).`;
  } else if (since && !until) {
    summaryText = `Desde ${formatDisplayDate(since)}`;
    hintText = `Desde ${formatFriendlyDate(since)} · Elige la fecha final o aplica.`;
  }

  return (
    <div className="flex flex-col gap-2.5 select-none">
      {/* Cabecera de período y estado de selección */}
      <div className="flex items-center justify-between">
        <span className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
          Período
        </span>

        {hasSelection ? (
          <span className="inline-flex items-center gap-1.5 rounded-edge bg-brand-red/[0.08] px-2 py-0.5 text-[11px] font-medium text-brand-red-dark">
            <CalendarIcon className="h-3 w-3 shrink-0" />
            <span className="tabular-nums">{summaryText}</span>
            <button
              type="button"
              onClick={clearDates}
              aria-label="Quitar filtro de fecha"
              title="Quitar filtro de fecha"
              className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-brand-red-dark/70 transition-colors hover:bg-brand-red/15 hover:text-brand-red-dark"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ) : (
          <span className="text-[11px] font-medium text-faint">Cualquier fecha</span>
        )}
      </div>

      {/* Accesos rápidos de un solo clic */}
      <div className="flex items-center gap-1">
        {PRESETS.map((preset) => {
          const range = preset.getRange();
          const isSelected = since === range.since && until === range.until;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className={`flex-1 rounded-edge py-1 text-[10.5px] font-medium transition-all ${
                isSelected
                  ? "bg-brand-red font-semibold text-white shadow-[0_1px_3px_rgba(228,0,43,0.3)]"
                  : "border border-line bg-fill/60 text-brand-gray hover:border-zinc-300 hover:bg-fill hover:text-ink"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Calendario interactivo Plastifar */}
      <div className="rounded-edge border border-line bg-canvas/40 p-2">
        {/* Navegación de mes */}
        <div className="mb-2 flex items-center justify-between">
          <span className="font-heading text-[11.5px] font-bold tracking-tight text-ink">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Mes anterior"
              className="flex h-6 w-6 items-center justify-center rounded-edge text-brand-gray outline-none transition-colors hover:bg-fill hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-red/20"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Mes siguiente"
              className="flex h-6 w-6 items-center justify-center rounded-edge text-brand-gray outline-none transition-colors hover:bg-fill hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-red/20"
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
              className="font-heading text-[9.5px] font-semibold uppercase tracking-wider text-faint"
            >
              {name}
            </span>
          ))}
        </div>

        {/* Cuadrícula de días */}
        <div
          className="grid grid-cols-7 gap-y-0.5 text-center"
          onMouseLeave={() => setHoveredDate(null)}
        >
          {days.map(({ dateStr, dayNum, isCurrentMonth }) => {
            const isStart = dateStr === since;
            const isEnd = dateStr === until;
            const inSelectedRange = since && until && dateStr > since && dateStr < until;
            const isToday = dateStr === todayStr;

            // Previsualización interactiva al pasar el ratón mientras se define el rango
            const inHoverRange =
              isSelectingRange &&
              hoveredDate &&
              ((hoveredDate > since && dateStr > since && dateStr <= hoveredDate) ||
                (hoveredDate < since && dateStr >= hoveredDate && dateStr < since));

            let dayClass = "";
            if (isStart && isEnd) {
              dayClass =
                "rounded-edge bg-brand-red text-white font-semibold shadow-[0_1px_3px_rgba(228,0,43,0.35)]";
            } else if (isStart) {
              dayClass = until
                ? "rounded-l-edge rounded-r-none bg-brand-red text-white font-semibold shadow-[0_1px_3px_rgba(228,0,43,0.35)]"
                : "rounded-edge bg-brand-red text-white font-semibold shadow-[0_1px_3px_rgba(228,0,43,0.35)]";
            } else if (isEnd) {
              dayClass = since
                ? "rounded-r-edge rounded-l-none bg-brand-red text-white font-semibold shadow-[0_1px_3px_rgba(228,0,43,0.35)]"
                : "rounded-edge bg-brand-red text-white shadow-[0_1px_3px_rgba(228,0,43,0.35)]";
            } else if (inSelectedRange) {
              dayClass = "rounded-none bg-brand-red/[0.08] font-medium text-brand-red-dark";
            } else if (inHoverRange) {
              dayClass = "rounded-none bg-brand-red/[0.05] text-brand-red-dark";
            } else if (isToday) {
              dayClass = "rounded-edge font-bold text-brand-red ring-1 ring-brand-red/40";
            } else if (!isCurrentMonth) {
              dayClass = "text-zinc-300 hover:text-zinc-500 hover:bg-fill/50 rounded-edge";
            } else {
              dayClass = "text-ink hover:bg-fill hover:text-ink rounded-edge";
            }

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => handleDateClick(dateStr)}
                onMouseEnter={() => {
                  if (isSelectingRange) setHoveredDate(dateStr);
                }}
                aria-label={dateStr}
                className={`flex h-7 w-full items-center justify-center text-[11px] tabular-nums outline-none transition-colors ${dayClass}`}
              >
                {dayNum}
              </button>
            );
          })}
        </div>

        {/* Mensaje de guía intuitivo */}
        <p className="mt-2 border-t border-line/70 pt-1.5 text-center text-[10.5px] text-faint">
          {hintText}
        </p>
      </div>
    </div>
  );
}
