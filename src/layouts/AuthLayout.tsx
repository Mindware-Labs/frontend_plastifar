import type { ReactNode } from "react";
import { Logo } from "../components/Logo";

interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  /** Bloque bajo el formulario: separador, avisos, enlaces de vuelta. */
  footer?: ReactNode;
  children: ReactNode;
  /** Asentamiento de la tarjeta cuando el envío no prospera: baja 3px y vuelve. */
  settle?: boolean;
}

/**
 * Layout principal de autenticación:
 * Diseño centrado, sobrio y corporativo. Una tarjeta blanca compacta con bordes sutiles,
 * micro-sombras elegantes y el logotipo de Plastifar encabezando la vista sobre un fondo suave.
 */
export function AuthLayout({ title, subtitle, footer, children, settle = false }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh flex-col justify-between items-center bg-[#f8f9fa] px-4 py-8 sm:py-12 overflow-hidden selection:bg-brand-red/10 selection:text-brand-red">
      {/* Fondo ambiental sutil con luz cenital tenue */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[340px] bg-[radial-gradient(ellipse_at_top,rgba(196,18,48,0.06),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,#000_60%,transparent_100%)] opacity-55" />
      </div>

      <div className="w-full" /> {/* Spacer top para equilibrio visual */}

      {/* Tarjeta central compacta */}
      <main className="relative z-10 w-full max-w-[396px] animate-plf-rise">
        <div
          className={`rounded-2xl border border-zinc-200/80 bg-white p-7 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_12px_32px_-4px_rgba(15,23,42,0.06)] ${
            settle ? "animate-plf-settle" : ""
          }`}
        >
          {/* Cabecera con Logotipo oficial */}
          <header className="text-center">
            <div className="flex justify-center mb-5">
              <Logo variant="color" height={32} />
            </div>

            <h1 className="font-heading text-[20px] font-bold tracking-[-0.025em] text-zinc-900 leading-tight">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-1.5 text-center text-[13px] text-zinc-500 leading-relaxed max-w-[32ch] mx-auto">
                {subtitle}
              </p>
            )}
          </header>

          {/* Formulario / Contenido */}
          <div className="mt-6">
            {children}
          </div>

          {/* Pie interior de la tarjeta */}
          {footer && (
            <div className="mt-6 pt-5 border-t border-zinc-100">
              {footer}
            </div>
          )}
        </div>
      </main>

      {/* Pie institucional exterior */}
      <footer className="relative z-10 mt-8 text-center animate-plf-fade">
        <p className="text-[11.5px] tracking-wide text-zinc-400">
          © {new Date().getFullYear()} Plastifar, S.A. · Autopista Duarte Km. 13½
        </p>
        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
          <span>Desarrollado por</span>
          <img
            src="/brand/centerquest-icon.png"
            alt="Center Quest"
            width={13}
            height={13}
            draggable={false}
            className="select-none opacity-75"
          />
          <span className="font-medium text-zinc-500">Center Quest</span>
        </div>
      </footer>
    </div>
  );
}
