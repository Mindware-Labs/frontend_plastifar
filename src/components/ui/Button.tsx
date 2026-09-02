import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  /** md en formularios y dialogos; sm alineado con las pestanas de seccion. */
  size?: "md" | "sm";
  isLoading?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-brand-red text-white shadow-[0_10px_20px_-12px_rgba(228,0,43,0.55)] hover:brightness-105 active:translate-y-px",
  secondary:
    "border border-line-strong bg-white text-brand-gray hover:bg-canvas hover:text-ink",
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
        transition-[filter,background-color,color,transform] outline-none
        focus-visible:ring-3 focus-visible:ring-brand-red/25
        disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100
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
