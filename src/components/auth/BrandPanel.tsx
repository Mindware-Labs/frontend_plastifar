import { LogoReserve } from "../Logo";

/**
 * Panel de marca del area de autenticacion.
 *
 * Composicion segun el Brandbook 2026: el rojo 185 C domina la superficie, el
 * verde 348 C aparece solo como acompanamiento (el halo inferior, eco del aro
 * del isotipo) y el logotipo viaja dentro de una reserva blanca de esquinas
 * redondeadas, tal como exige el manual para fondos saturados.
 */
export function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-red lg:flex lg:flex-col">
      <div aria-hidden className="absolute inset-0">
        {/* Base degradada: 185 C iluminado arriba a la izquierda, profundo abajo */}
        <div className="absolute inset-0 bg-[radial-gradient(118%_112%_at_14%_6%,var(--color-brand-red-light)_0%,var(--color-brand-red)_44%,var(--color-brand-red-dark)_100%)]" />

        {/* Masas organicas */}
        <div className="animate-plf-float absolute -left-32 -top-40 h-[560px] w-[560px] rounded-full bg-white/[0.07]" />
        <div className="animate-plf-drift absolute -right-40 top-[16%] h-[460px] w-[460px] rounded-full bg-white/[0.05]" />
        <div className="absolute -bottom-48 -left-40 h-[620px] w-[620px] rounded-full bg-brand-green/35 blur-[110px]" />
        <div className="absolute -bottom-64 -right-32 h-[600px] w-[600px] rounded-full bg-[#82001a]/50 blur-[90px]" />

        {/* Aros: eco geometrico del isotipo */}
        <div className="absolute -bottom-[220px] -right-[140px] h-[560px] w-[560px] rounded-full border-2 border-white/15" />
        <div className="absolute -bottom-[320px] -right-[240px] h-[760px] w-[760px] rounded-full border border-white/10" />

        {/* Trama de puntos */}
        <div
          className="absolute left-10 top-12 h-[212px] w-[152px] opacity-30 xl:left-16"
          style={{
            backgroundImage: "radial-gradient(currentColor 1.6px, transparent 1.7px)",
            backgroundSize: "19px 19px",
            color: "#ffffff",
          }}
        />

        {/* Asiento inferior para que el texto de pie no flote */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgba(0,0,0,0.30),transparent)]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-16">
        <div className="animate-plf-fade">
          <LogoReserve height={30} />
        </div>

        <div className="max-w-[30rem] py-10 xl:py-14">
          <div className="animate-plf-rise flex items-center gap-3.5">
            <span className="h-px w-9 bg-white/55" />
            <span className="font-heading text-[11px] font-semibold uppercase tracking-[0.3em] text-white/75">
              Panel interno
            </span>
          </div>

          <h2
            className="animate-plf-rise mt-7 max-w-[14ch] text-balance font-heading text-[clamp(2.5rem,3.4vw,3.65rem)] font-bold leading-[1.04] tracking-[-0.025em] text-white"
            style={{ animationDelay: "80ms" }}
          >
            La operación de Plastifar, en un solo lugar.
          </h2>

          <p
            className="animate-plf-rise mt-7 max-w-[40ch] text-[15px] font-light leading-[1.75] text-white/75"
            style={{ animationDelay: "160ms" }}
          >
            Personal, departamentos, roles y accesos administrados desde un mismo
            panel, con el control y la trazabilidad que exige la operación diaria.
          </p>
        </div>

        <div className="animate-plf-fade" style={{ animationDelay: "260ms" }}>
          <div className="mb-5 h-px w-16 bg-white/30" />
          <p className="font-heading text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80">
            Plastifar, S.A.
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/50">
            Autopista Duarte Km. 13½ · Santo Domingo, República Dominicana
          </p>
        </div>
      </div>
    </aside>
  );
}
