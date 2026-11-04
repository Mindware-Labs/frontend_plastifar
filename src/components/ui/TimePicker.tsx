import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import type { FieldState } from "./fieldStyles";

export interface TimePickerProps {
  value: string; // HH:mm format, e.g. "08:00"
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  error?: string;
  state?: FieldState;
  className?: string;
  presets?: { label: string; value: string }[];
  /** En modales con scroll, evita que el panel quede recortado abajo del trigger. */
  preferDropUp?: boolean;
}

function parseTime24(time: string): { h24: number; minute: number } | null {
  if (!time) return null;
  const parts = time.split(":").map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return { h24: parts[0], minute: parts[1] };
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

function formatDisplayTime(timeValue: string): string {
  const parsed = parseTime24(timeValue);
  if (!parsed) return "";
  const { hour12, period } = to12hParts(parsed.h24);
  const m = String(parsed.minute).padStart(2, "0");
  const p = period === "am" ? "a.m." : "p.m.";
  return `${String(hour12).padStart(2, "0")}:${m} ${p}`;
}

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
      className="flex h-5 w-full items-center justify-center rounded text-zinc-400 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/20 cursor-pointer"
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}

const DEFAULT_PRESETS = [
  { label: "07:00 a.m.", value: "07:00" },
  { label: "08:00 a.m.", value: "08:00" },
  { label: "08:30 a.m.", value: "08:30" },
  { label: "09:00 a.m.", value: "09:00" },
  { label: "04:00 p.m.", value: "16:00" },
  { label: "05:00 p.m.", value: "17:00" },
  { label: "05:30 p.m.", value: "17:30" },
  { label: "06:00 p.m.", value: "18:00" },
];

export function TimePicker({
  value,
  onChange,
  placeholder = "Seleccionar hora...",
  id,
  disabled = false,
  error,
  state = "idle",
  className = "",
  presets = DEFAULT_PRESETS,
  preferDropUp = false,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; dropUp: boolean } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const pickerId = id ?? generatedId;

  const dropUp = coords?.dropUp ?? false;
  const { mounted, exiting, ref: motionRef } = useDisclosureMotion<HTMLDivElement>(open, {
    direction: dropUp ? "up" : "down",
  });

  const parsed = parseTime24(value);
  const hasTime = Boolean(parsed);
  const { h24, minute } = parsed ?? { h24: 8, minute: 0 };
  const { hour12, period } = to12hParts(h24);

  function measure() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const presetRows = presets.length > 0 ? Math.ceil(presets.length / 2) : 0;
    const panelHeight = presets.length > 0 ? 118 + presetRows * 28 : 118;
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldDropUp =
      preferDropUp || (spaceBelow < panelHeight && rect.top > panelHeight);

    setCoords({
      top: shouldDropUp ? rect.top - 6 : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 210)),
      dropUp: shouldDropUp,
    });
  }

  function toggle() {
    if (disabled) return;
    if (!open) measure();
    setOpen((prev) => !prev);
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function handleScroll() {
      measure();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  function commit(nextH24: number, nextMinute: number) {
    onChange(toTime24(nextH24, nextMinute));
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

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={pickerId}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-skip-autofocus
        className={`w-full flex items-center justify-between gap-2 rounded-md border bg-white px-2.5 h-8 text-left text-[12.5px] shadow-2xs outline-none transition-all cursor-pointer ${
          error || state === "error"
            ? "border-brand-red bg-red-50/15 ring-1 ring-brand-red/20"
            : open
            ? "border-brand-red ring-2 ring-brand-red/10"
            : "border-zinc-200 hover:border-zinc-300 focus-visible:border-brand-red focus-visible:ring-2 focus-visible:ring-brand-red/20"
        } ${disabled ? "cursor-not-allowed bg-zinc-50 text-zinc-400" : "text-zinc-800"}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <span className="truncate whitespace-nowrap tabular-nums">
            {hasTime ? (
              <span className="font-semibold text-zinc-900">{formatDisplayTime(value)}</span>
            ) : (
              <span className="font-normal text-zinc-400">{placeholder}</span>
            )}
          </span>
        </span>

        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {mounted &&
        coords &&
        createPortal(
          <div
            ref={(node) => {
              panelRef.current = node;
              motionRef.current = node;
            }}
            data-skip-autofocus
            style={{
              position: "fixed",
              top: coords.dropUp ? undefined : coords.top,
              bottom: coords.dropUp ? window.innerHeight - coords.top : undefined,
              left: coords.left,
              width: 200,
              zIndex: 9999,
            }}
            className={`rounded-xl border border-zinc-200/90 bg-white p-2.5 shadow-xl text-left ${
              exiting ? "pointer-events-none" : ""
            }`}
          >
            {/* Control giratorio de horas y minutos */}
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1">
                <div
                  className="flex flex-col items-center rounded-md border border-zinc-200 bg-zinc-50/50 px-1 py-0.5"
                  aria-label="Hora"
                >
                  <TimeStepButton direction="up" label="Aumentar hora" onClick={() => bumpHour(1)} />
                  <span className="tabular-nums leading-tight text-[13px] font-bold text-zinc-900">
                    {String(hour12).padStart(2, "0")}
                  </span>
                  <TimeStepButton direction="down" label="Disminuir hora" onClick={() => bumpHour(-1)} />
                </div>

                <span className="text-[12px] font-bold text-zinc-300">:</span>

                <div
                  className="flex flex-col items-center rounded-md border border-zinc-200 bg-zinc-50/50 px-1 py-0.5"
                  aria-label="Minutos"
                >
                  <TimeStepButton direction="up" label="Aumentar minutos" onClick={() => bumpMinute(1)} />
                  <span className="tabular-nums leading-tight text-[13px] font-bold text-zinc-900">
                    {String(minute).padStart(2, "0")}
                  </span>
                  <TimeStepButton direction="down" label="Disminuir minutos" onClick={() => bumpMinute(-1)} />
                </div>

                <div
                  role="group"
                  aria-label="Periodo del día"
                  className="flex flex-col gap-0.5 rounded-md border border-zinc-200 bg-zinc-50/50 p-0.5"
                >
                  {(["am", "pm"] as const).map((p) => {
                    const selected = period === p;
                    const label = p === "am" ? "a.m." : "p.m.";
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPeriod(p)}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-brand-red ${
                          selected
                            ? "bg-white text-zinc-900 shadow-2xs font-bold border border-zinc-200/80"
                            : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Presets rápidos */}
              {presets.length > 0 && (
                <div className="flex flex-col gap-1 border-t border-zinc-100 pt-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Horas habituales
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    {presets.map((preset) => {
                      const isSelected = value === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => {
                            onChange(preset.value);
                            setOpen(false);
                          }}
                          className={`rounded px-1.5 py-1 text-[11px] font-medium transition-all cursor-pointer text-left ${
                            isSelected
                              ? "bg-zinc-100 font-bold text-zinc-900 border border-zinc-200"
                              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
