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

/** Enlace secundario bajo formularios de acceso (volver al login, etc.). */
export const authBackLinkClass =
  "inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-subtle transition-colors hover:text-brand-red-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25";

/** Layout centrado para login y recuperación de acceso, alineado con tarjetas del panel. */
export function AuthLayout({ title, subtitle, footer, children, settle = false }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden bg-canvas px-4 py-10 selection:bg-brand-red/10 selection:text-brand-red sm:py-14">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 h-[320px] w-[880px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(228,0,43,0.04),transparent_72%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#e2e4e8_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,#000_55%,transparent_100%)] opacity-40" />
      </div>

      <div className="w-full" aria-hidden />

      <main className="relative z-10 w-full max-w-[420px] animate-plf-rise">
        <div
          className={`overflow-hidden rounded-card border border-line bg-white p-7 shadow-card sm:p-9 ${
            settle ? "animate-plf-settle" : ""
          }`}
        >
          <header className="text-center">
            <div className="mb-5 flex justify-center">
              <Logo variant="color" height={34} />
            </div>

            <h1 className="font-heading text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[21px]">
              {title}
            </h1>

            {subtitle && (
              <p className="mx-auto mt-2 max-w-[36ch] text-center text-[13px] font-normal leading-relaxed text-subtle">
                {subtitle}
              </p>
            )}
          </header>

          <div className="mt-7">{children}</div>

          {footer && <div className="mt-7 border-t border-line pt-6">{footer}</div>}
        </div>
      </main>

      <footer className="relative z-10 mt-8 flex animate-plf-fade flex-col items-center gap-2.5 text-center">
        <p className="text-[12px] text-faint">
          © {CURRENT_YEAR} Plastifar, S.A. · Autopista Duarte Km. 13½
        </p>
        <a
          href="https://www.cquest.do/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full border border-line bg-white/80 px-3 py-1 text-[11.5px] text-subtle shadow-2xs transition-colors hover:border-zinc-300 hover:bg-white"
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
          <span className="font-semibold text-ink hover:text-brand-red hover:underline underline-offset-2">
            Center Quest
          </span>
        </a>
      </footer>
    </div>
  );
}
