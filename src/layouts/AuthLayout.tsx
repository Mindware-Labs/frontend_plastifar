import type { ReactNode } from "react";
import { BrandPanel } from "../components/auth/BrandPanel";
import { Logo } from "../components/Logo";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:min-h-screen lg:grid-cols-[minmax(0,46%)_minmax(0,54%)] xl:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
      <BrandPanel />

      <main className="relative flex min-h-screen flex-col px-6 py-9 sm:px-10 lg:px-12">
        {/* Halo tenue del rojo institucional: da temperatura al blanco sin ensuciarlo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(62%_46%_at_100%_0%,rgba(228,0,43,0.05),transparent_68%)]"
        />

        {/* Filete rojo/verde + marca: cabecera solo para pantallas sin panel lateral */}
        <div className="relative lg:hidden">
          <div className="mx-auto mb-7 flex h-1 w-20 overflow-hidden">
            <div className="w-2/3 bg-brand-red" />
            <div className="w-1/3 bg-brand-green" />
          </div>
          <div className="flex justify-center">
            <Logo height={30} />
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px] py-12">
            <header className="animate-plf-rise text-center">
              <h1 className="font-heading text-[30px] font-bold leading-[1.15] tracking-[-0.025em] text-ink sm:text-[32px]">
                {title}
              </h1>
              {subtitle && (
                <p className="mx-auto mt-2.5 max-w-[34ch] text-[14.5px] leading-relaxed text-zinc-500">
                  {subtitle}
                </p>
              )}
            </header>

            <div className="animate-plf-rise mt-9" style={{ animationDelay: "90ms" }}>
              {children}
            </div>
          </div>
        </div>

        <footer className="relative text-center text-[11.5px] tracking-wide text-zinc-400">
          © {new Date().getFullYear()} Plastifar, S.A. · Todos los derechos reservados
        </footer>
      </main>
    </div>
  );
}
