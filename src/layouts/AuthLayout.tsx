import type { ReactNode } from "react";
import { Logo } from "../components/Logo";

interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  /** Bloque bajo el formulario: separador, avisos, enlaces de vuelta. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Estructura del area de autenticacion.
 *
 * Una sola columna centrada, sin panel lateral: el aro del isotipo, ampliado
 * y al 10 % de opacidad, es lo que estructura el espacio. La marca aparece una
 * sola vez y en su version reducida —el isotipo, autorizado por el manual para
 * uso digital pequeno— porque aqui no compite con nada.
 */
export function AuthLayout({ title, subtitle, footer, children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-canvas px-5 py-14 sm:px-6">
      {/* Aros concentricos: eco geometrico del isotipo, no el isotipo */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[980px] w-[980px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-brand-red/10" />
        <div className="absolute left-1/2 top-1/2 h-[1360px] w-[1360px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-brand-green/10" />
        <div className="absolute left-1/2 top-[-320px] h-[640px] w-[900px] -translate-x-1/2 rounded-full bg-brand-red/[0.09] blur-[110px]" />
        <div className="absolute inset-x-0 bottom-0 h-80 bg-linear-to-t from-canvas to-transparent" />
      </div>

      <main className="relative w-full max-w-[408px]">
        <header className="animate-plf-rise text-center">
          <div className="flex justify-center">
            <Logo variant="isotipo" height={62} />
          </div>

          <h1 className="mt-[26px] text-balance font-heading text-[30px] font-bold leading-[1.12] tracking-[-0.03em] text-ink">
            {title}
          </h1>

          {subtitle && (
            <p className="mx-auto mt-2.5 max-w-[36ch] text-[14px] leading-relaxed text-zinc-500">
              {subtitle}
            </p>
          )}
        </header>

        <div className="animate-plf-rise mt-[34px]" style={{ animationDelay: "90ms" }}>
          {children}
        </div>

        {footer && (
          <div className="animate-plf-rise mt-[30px]" style={{ animationDelay: "150ms" }}>
            {footer}
          </div>
        )}
      </main>

      <p className="relative mt-14 text-center text-[11.5px] leading-relaxed tracking-[0.04em] text-zinc-400">
        © {new Date().getFullYear()} Plastifar, S.A. · Autopista Duarte Km. 13½ · Santo Domingo,
        República Dominicana
      </p>
    </div>
  );
}
