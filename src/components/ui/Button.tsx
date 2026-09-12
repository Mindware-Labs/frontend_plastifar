import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonTone = "primary" | "ink" | "success";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  /** md en formularios y dialogos; sm alineado con las pestanas de seccion. */
  size?: "md" | "sm";
  isLoading?: boolean;
  /** Tono contextual para informar del resultado o fallo sin empujar el layout (como en el login). */
  tone?: ButtonTone;
  /** Etiqueta que sustituye a children mientras tone no es primary. */
  toneLabel?: ReactNode;
}

/** Sobre el rojo 185 C pleno un matiz no se percibe: el hover cambia de color y de sombra. */
const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-brand-red text-white shadow-2xs " +
    "hover:bg-brand-red-dark " +
    "active:scale-[0.98] " +
    "disabled:hover:bg-brand-red",
  secondary:
    "border border-zinc-200 bg-white text-zinc-700 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.98]",
  danger: "border border-brand-red/40 bg-white text-brand-red shadow-2xs hover:bg-red-50 active:scale-[0.98]",
  ghost: "text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900 active:scale-[0.98]",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  md: "h-9 px-3.5 text-[13px]",
  sm: "h-8 px-3 text-[12.5px]",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  tone = "primary",
  toneLabel,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const showTone = tone !== "primary" && toneLabel != null;
  const layer =
    "transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-opacity";

  const toneClass =
    tone === "ink"
      ? "bg-ink text-white shadow-2xs hover:bg-ink"
      : tone === "success"
        ? "bg-brand-green text-white shadow-2xs hover:bg-brand-green"
        : variantClasses[variant];

  return (
    <button
      disabled={disabled || isLoading}
      className={`relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-lg
        font-medium tracking-normal
        transition-all outline-none
        focus-visible:ring-2 focus-visible:ring-brand-red/25
        disabled:cursor-not-allowed disabled:opacity-50
        ${sizeClasses[size]} ${toneClass} ${className}`}
      {...props}
    >
      <span
        className={`inline-flex items-center justify-center gap-1.5 ${layer} ${
          showTone ? "opacity-0 -translate-y-2 motion-reduce:translate-y-0" : ""
        }`}
      >
        {isLoading && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </span>
      {toneLabel != null && (
        <span
          aria-hidden={!showTone}
          className={`absolute inset-0 flex items-center justify-center gap-1.5 px-3 font-semibold text-white ${layer} ${
            showTone ? "" : "pointer-events-none opacity-0 translate-y-2 motion-reduce:translate-y-0"
          }`}
        >
          {toneLabel}
        </span>
      )}
    </button>
  );
}
