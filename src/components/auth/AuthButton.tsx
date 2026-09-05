import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

/**
 * Boton principal del area de autenticacion.
 *
 * Plano y en 185 C puro: sobre un fondo tan claro no hace falta degradado, la
 * pieza ya es el unico bloque de color de la pantalla. Lleva el mismo destello
 * (`shadow-bloom`) que el boton primario del panel, no una sombra propia: el
 * sistema tiene tres elevaciones y esta area no anade una cuarta.
 */
export function AuthButton({
  isLoading = false,
  disabled,
  className = "",
  children,
  ...props
}: AuthButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={`flex h-14 w-full cursor-pointer items-center justify-center gap-2.5
        rounded-edge bg-brand-red font-heading text-[12.5px] font-semibold uppercase
        tracking-[0.16em] text-white shadow-bloom
        transition-[transform,box-shadow,filter,opacity] duration-200 ease-out
        hover:-translate-y-px hover:brightness-105
        active:translate-y-px active:brightness-[0.97]
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red
        disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none
        disabled:hover:translate-y-0 disabled:hover:brightness-100
        motion-reduce:hover:translate-y-0
        ${className}`}
      {...props}
    >
      {isLoading && <LoaderCircle className="h-[17px] w-[17px] animate-spin" aria-hidden />}
      <span>{children}</span>
    </button>
  );
}
