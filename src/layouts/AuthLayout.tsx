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

const CURRENT_YEAR = new Date().getFullYear();

/** Layout corporativo centrado para pantallas de acceso. */
export function AuthLayout({ title, subtitle, footer, children, settle = false }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh flex-col justify-between items-center bg-[#f8f9fa] px-4 py-10 sm:py-14 overflow-hidden selection:bg-brand-red/10 selection:text-brand-red">
      {/* Fondo ambiental sutil con luz cenital tenue */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[380px] bg-[radial-gradient(ellipse_at_top,rgba(228,0,43,0.05),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#e2e4e8_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,#000_60%,transparent_100%)] opacity-50" />
      </div>

      <div className="w-full" /> {/* Spacer top para equilibrio visual */}

      {/* Tarjeta central amplia y distinguida */}
      <main className="relative z-10 w-full max-w-[440px] animate-plf-rise">
        <div
          className={`relative rounded-2xl sm:rounded-[22px] border border-zinc-200/90 bg-white p-8 sm:p-10 shadow-[0_2px_4px_rgba(0,0,0,0.02),0_12px_28px_-6px_rgba(27,27,29,0.05),0_28px_56px_-12px_rgba(27,27,29,0.07)] overflow-hidden transition-transform duration-300 ${
            settle ? "animate-plf-settle" : ""
          }`}
        >
          {/* Cabecera con Logotipo oficial */}
          <header className="text-center">
            <div className="flex justify-center mb-6">
              <Logo variant="color" height={36} />
            </div>

            <h1 className="font-heading text-[22px] sm:text-[23px] font-bold tracking-[-0.03em] text-zinc-900 leading-tight">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-2 text-center text-[13.5px] text-zinc-500 font-normal leading-relaxed max-w-[34ch] mx-auto">
                {subtitle}
              </p>
            )}
          </header>

          {/* Formulario / Contenido */}
          <div className="mt-8">
            {children}
          </div>

          {/* Pie interior de la tarjeta */}
          {footer && (
            <div className="mt-8 pt-6 border-t border-zinc-100">
              {footer}
            </div>
          )}
        </div>
      </main>

      {/* Pie institucional exterior */}
      <footer className="relative z-10 mt-8 flex flex-col items-center gap-2.5 text-center animate-plf-fade">
        <p className="text-[12px] tracking-normal text-zinc-400">
          © {CURRENT_YEAR} Plastifar, S.A. · Autopista Duarte Km. 13½
        </p>
        <a
          href="https://www.cquest.do/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/70 px-3 py-1 text-[11.5px] text-zinc-500 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:border-zinc-300 hover:bg-white"
        >
          <span>Desarrollado por</span>
          <img
            src="/brand/centerquest-icon.png"
            alt="Center Quest"
            width={16}
            height={16}
            draggable={false}
            className="select-none"
          />
          <span className="font-semibold text-zinc-700 hover:text-brand-red hover:underline underline-offset-2">
            Center Quest
          </span>
        </a>
      </footer>
    </div>
  );
}
