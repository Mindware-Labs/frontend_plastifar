import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

/**
 * Boton principal del area de autenticacion.
 *
 * Recto como los campos. El volumen no lo da el radio sino el material:
 * degradado vertical corto sobre el 185 C, luz interior de 1px en el borde
 * superior, sombra de contacto pegada y una sombra proyectada larga y teñida.
 * Al pulsar, la pieza se hunde: baja 1px y la sombra pasa a interior.
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
      className={`group relative flex h-14 w-full cursor-pointer items-center justify-center gap-2.5
        overflow-hidden rounded-edge bg-linear-to-b from-brand-red-light to-brand-red
        font-heading text-[13px] font-semibold uppercase tracking-[0.14em] text-white
        shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(140,0,24,0.35),0_12px_26px_-12px_rgba(228,0,43,0.65)]
        transition-[--tw-gradient-from,--tw-gradient-to,box-shadow,transform,opacity] duration-200 ease-out
        hover:from-brand-red hover:to-brand-red-dark
        hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(140,0,24,0.4),0_16px_34px_-12px_rgba(228,0,43,0.72)]
        active:translate-y-px active:shadow-[inset_0_2px_5px_rgba(110,0,19,0.45)]
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red
        disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none
        disabled:hover:from-brand-red-light disabled:hover:to-brand-red
        ${className}`}
      {...props}
    >
      {/* Destello que recorre la pieza al pasar el cursor */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(105deg,transparent_25%,rgba(255,255,255,0.22)_50%,transparent_75%)]
          transition-transform duration-700 ease-out group-hover:translate-x-full motion-reduce:hidden"
      />
      {isLoading && <LoaderCircle className="h-[17px] w-[17px] animate-spin" aria-hidden />}
      <span className="relative">{children}</span>
    </button>
  );
}
