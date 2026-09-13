import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  /** md en formularios y dialogos; sm alineado con las pestanas de seccion. */
  size?: "md" | "sm";
  isLoading?: boolean;
}

/** Sobre el rojo 185 C pleno un matiz no se percibe: el hover cambia de color y de sombra. */
const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  // Apagado el primario pierde el rojo y la sombra, no solo opacidad: el 185 C
  // al 60 % sigue siendo un rojo intenso, y "Guardar cambios" se leia como
  // disponible cuando no habia nada que guardar. Un boton que parece pulsable y
  // no responde es peor que uno que no esta.
  primary:
    "bg-brand-red text-white shadow-[0_10px_20px_-12px_rgba(228,0,43,0.55)] " +
    "hover:bg-brand-red-dark hover:shadow-[0_14px_24px_-10px_rgba(228,0,43,0.7)] " +
    "active:translate-y-px active:bg-brand-red-dark active:shadow-[0_6px_12px_-9px_rgba(228,0,43,0.6)] " +
    "disabled:bg-line-strong disabled:text-subtle disabled:shadow-none " +
    "disabled:hover:bg-line-strong disabled:hover:shadow-none",
  /* Las tres llevan el mismo `active:translate-y-px` que la primaria. Solo la
     primaria acusaba la pulsacion, asi que «Crear» se hundia bajo el dedo y
     «Cancelar», a dos centimetros, no se movia: el mismo gesto contestado en
     una y muerto en la otra. El hundimiento es el acuse; la sombra de color se
     queda solo en la primaria, que es la unica que la tiene en reposo. */
  secondary:
    "border border-line-strong bg-white text-brand-gray hover:border-hairline-hover hover:bg-canvas hover:text-ink " +
    "active:translate-y-px active:bg-fill",
  danger:
    "border border-brand-red bg-white text-brand-red hover:bg-brand-red/[0.06] " +
    "active:translate-y-px active:bg-brand-red/[0.11]",
  ghost: "text-brand-gray hover:bg-fill hover:text-ink active:translate-y-px active:bg-line-soft",
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
        disabled:cursor-not-allowed disabled:opacity-70
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
