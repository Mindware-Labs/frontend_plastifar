import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  /** md en formularios y dialogos; sm alineado con las pestanas de seccion. */
  size?: "md" | "sm";
  isLoading?: boolean;
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
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg
        font-medium tracking-normal
        transition-all outline-none
        focus-visible:ring-2 focus-visible:ring-brand-red/25
        disabled:cursor-not-allowed disabled:opacity-50
        ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
