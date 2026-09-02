import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
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

export function Button({
  variant = "primary",
  isLoading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-edge px-4
        font-heading text-[11.5px] font-semibold uppercase tracking-[0.06em]
        transition-[filter,background-color,color,transform] outline-none
        focus-visible:ring-3 focus-visible:ring-brand-red/25
        disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100
        ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
