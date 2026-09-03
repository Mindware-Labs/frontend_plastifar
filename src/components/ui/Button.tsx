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
    "bg-brand-red text-white shadow-[0_10px_20px_-12px_rgba(228,0,43,0.55)] " +
    "hover:bg-brand-red-dark hover:shadow-[0_14px_24px_-10px_rgba(228,0,43,0.7)] " +
    "active:translate-y-px active:bg-brand-red-dark active:shadow-[0_6px_12px_-9px_rgba(228,0,43,0.6)] " +
    "disabled:hover:bg-brand-red disabled:hover:shadow-[0_10px_20px_-12px_rgba(228,0,43,0.55)]",
  secondary:
    "border border-line-strong bg-white text-brand-gray hover:border-zinc-400 hover:bg-canvas hover:text-ink",
  danger: "border border-brand-red bg-white text-brand-red hover:bg-red-50",
  ghost: "text-brand-gray hover:bg-fill hover:text-ink",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  md: "h-9 px-4",
  sm: "h-8 px-3.5",
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
      className={`inline-flex items-center justify-center gap-2 rounded-edge
        font-heading text-[11.5px] font-semibold uppercase tracking-[0.06em]
        transition-[background-color,border-color,color,box-shadow,transform] outline-none
        focus-visible:ring-3 focus-visible:ring-brand-red/25
        disabled:cursor-not-allowed disabled:opacity-60
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
