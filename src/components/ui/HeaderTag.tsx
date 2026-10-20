import type { ReactNode } from "react";

export type HeaderTagTone = "neutral" | "emerald" | "amber" | "red" | "blue";

interface HeaderTagProps {
  label: string;
  count?: number | string;
  active: boolean;
  onClick: () => void;
  tone?: HeaderTagTone;
  dot?: boolean;
  dotPulse?: boolean;
  title?: string;
  ariaLabel?: string;
  className?: string;
  children?: ReactNode;
}

export function HeaderTag({
  label,
  count,
  active,
  onClick,
  tone = "neutral",
  dot = false,
  dotPulse = false,
  title,
  ariaLabel,
  className = "",
  children,
}: HeaderTagProps) {
  const dotColorClass =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "red"
      ? "bg-brand-red"
      : tone === "amber"
      ? "bg-amber-500"
      : tone === "blue"
      ? "bg-blue-500"
      : "bg-zinc-400";

  const activeStyles: Record<HeaderTagTone, string> = {
    neutral:
      "border-brand-red-dark bg-brand-red text-white font-semibold shadow-[0_1px_2px_rgba(184,0,31,0.35)] hover:bg-brand-red-dark hover:border-brand-red-dark",
    emerald:
      "border-emerald-600 bg-emerald-100/80 text-emerald-950 font-bold shadow-xs hover:bg-emerald-100 hover:border-emerald-700",
    red:
      "border-brand-red bg-red-100/80 text-red-950 font-bold shadow-xs hover:bg-red-100 hover:border-red-700",
    amber:
      "border-amber-500 bg-amber-100/80 text-amber-950 font-bold shadow-xs hover:bg-amber-100 hover:border-amber-600",
    blue:
      "border-blue-600 bg-blue-100/80 text-blue-950 font-bold shadow-xs hover:bg-blue-100 hover:border-blue-700",
  };

  const hoverByTone: Record<HeaderTagTone, string> = {
    neutral: "hover:border-zinc-300 hover:bg-zinc-100/80 hover:text-zinc-900",
    emerald: "hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900",
    red: "hover:border-red-400 hover:bg-red-50 hover:text-brand-red",
    amber: "hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900",
    blue: "hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={title || `${label} (${count ?? ""})`}
      aria-label={ariaLabel || label}
      aria-pressed={active}
      className={`inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11.5px] transition-colors duration-150 antialiased outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
        active
          ? activeStyles[tone]
          : `border-zinc-200/90 bg-white text-zinc-600 shadow-2xs ${hoverByTone[tone]} hover:shadow-xs`
      } ${className}`}
    >
      {dot && (
        <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
          {dotPulse && active && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotColorClass}`}
            />
          )}
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              active && tone === "neutral" ? "bg-white" : dotColorClass
            } ${
              active && tone !== "neutral" ? "shadow-[0_0_6px_currentColor]" : ""
            }`}
          />
        </span>
      )}

      {count !== undefined && (
        <span
          className={`tabular-nums ${
            active
              ? tone === "neutral"
                ? "text-white font-bold"
                : tone === "red"
                ? "text-brand-red font-bold"
                : "text-zinc-950 font-bold"
              : "text-zinc-900 font-semibold"
          }`}
        >
          {count}
        </span>
      )}

      <span className={active ? "font-semibold" : "font-medium"}>{label}</span>
      {children}
    </button>
  );
}
