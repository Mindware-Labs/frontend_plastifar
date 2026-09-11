import { Info, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { DashboardCard } from "./DashboardCard";
import { CARD_RADIUS, INSET_RADIUS } from "./radii";

/* ========================================================================== *
 *  Piezas del tablero, en la anatomia de la referencia aprobada.
 *
 *  La referencia venia en azul. Aqui el acento es el 185 C de Plastifar: el
 *  Brandbook 2026 es vinculante y un panel interno con el azul de otro producto
 *  seria la unica pantalla del sistema que no es de la empresa. Lo que se copia
 *  es la ANATOMIA —el chip de icono, la jerarquia, la densidad, la pastilla de
 *  variacion, la rejilla— que es lo que hace que el tablero se lea rapido.
 * ========================================================================== */

export type Tone = "neutral" | "brand" | "red" | "green" | "warn";

const chipTone: Record<Tone, string> = {
  neutral: "bg-brand-gray/8 text-brand-gray",
  brand: "bg-brand-red/10 text-brand-red",
  red: "bg-brand-red/10 text-brand-red",
  green: "bg-brand-green/10 text-brand-green",
  warn: "bg-warn/10 text-warn",
};

interface StatCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  /** Que significa la cifra, para el icono de ayuda. */
  help: string;
  tone?: Tone;
  /**
   * Variacion contra el periodo anterior, en puntos porcentuales.
   *
   * Opcional Y HOY SIEMPRE AUSENTE: la referencia trae una pastilla verde o
   * roja en cada tarjeta, pero ningun endpoint devuelve una comparacion contra
   * el periodo previo. La ranura esta cableada y se enciende sola el dia que el
   * servidor la calcule; inventar un "+10,5 %" seria exactamente lo que este
   * repositorio ya corrigio dos veces.
   */
  delta?: number;
}

/**
 * Cifra de cabecera: chip de icono, nombre, numero y variacion.
 *
 * DENSA A PROPOSITO. El icono va EN LINEA con la etiqueta, no en un renglon
 * propio: apilados, una ficha que muestra un solo numero medía 160 px y la
 * pantalla entera mostraba seis cifras con el resto en blanco. La referencia
 * hace lo contrario —fichas chicas y apretadas— y esa densidad es justamente
 * lo que hace que un tablero se lea de un vistazo.
 *
 * Sin `h-full`: estirar la tarjeta para igualar la fila mete el hueco DENTRO de
 * ella, y una tarjeta con 40 % de vacio se lee como un panel a medio cargar.
 */
export function StatCard({ icon: Icon, label, value, help, tone = "brand", delta }: StatCardProps) {
  return (
    <DashboardCard padding="sm" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center ${INSET_RADIUS} ${chipTone[tone]}`}
          >
            <Icon className="h-[15px] w-[15px]" />
          </span>
          <span className="truncate text-[12.5px] text-subtle">{label}</span>
        </span>
        {/* `title` y no un tooltip propio: es una aclaracion de una linea que
            nadie necesita para operar, y un portal aqui seria mas maquinaria
            que informacion. */}
        <span
          title={help}
          // "line-strong" daba 1.3:1 sobre blanco: el icono existia pero no se
          // veia. "faint" es el piso de contraste del sistema.
          className="shrink-0 cursor-help text-faint transition-colors hover:text-brand-gray"
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">{help}</span>
        </span>
      </div>

      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="font-heading text-[28px] font-bold leading-none tracking-[-0.02em] text-ink">
            {value}
          </p>
          {delta !== undefined && (
            <span
              className={`inline-flex h-[20px] items-center gap-0.5 rounded-full px-1.5
                text-[11px] font-semibold tabular-nums ${
                  delta >= 0
                    ? "bg-brand-green/10 text-brand-green"
                    : "bg-brand-red/10 text-brand-red-dark"
                }`}
            >
              {delta >= 0 ? (
                <TrendingUp className="h-3 w-3" aria-hidden />
              ) : (
                <TrendingDown className="h-3 w-3" aria-hidden />
              )}
              {Math.abs(delta).toFixed(1).replace(".", ",")}%
            </span>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}

/* -------------------------------------------------------------------------- */

interface PanelProps {
  title: string;
  /** Controles de la esquina derecha: selector de periodo, refrescar. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Contenedor de grafico con su cabecera, igual en los dos paneles. */
export function Panel({ title, actions, children, className = "" }: PanelProps) {
  return (
    <DashboardCard padding="chart" className={`flex min-w-0 flex-col ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 className="font-heading text-[13px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {/* El contenido toma el alto sobrante y se centra en el. Cuando la fila la
          marca una tarjeta mas alta, el grafico corto queda con aire arriba y
          abajo en vez de colgado del titulo con el vacio al pie. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
    </DashboardCard>
  );
}

/** Boton de refrescar de la cabecera de un panel. */
export function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label="Actualizar"
      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-edge
        border border-line text-subtle outline-none transition-colors
        hover:border-line-strong hover:text-ink
        focus-visible:ring-3 focus-visible:ring-brand-red/25
        disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
    </button>
  );
}

/* -------------------------------------------------------------------------- */

interface QuickStat {
  label: string;
  value: string;
}

/**
 * Banda de resumen: varias cifras en una sola fila, separadas por filete.
 *
 * Son cifras de CONTEXTO —el tamano de la cartera— que enmarcan todo lo que
 * viene debajo, no metricas que pidan accion. Si fueran cinco tarjetas mas,
 * competirian en rango con las de Calidad, que si piden que alguien haga algo
 * hoy. Por eso siguen siendo una banda y no cinco recuadros.
 *
 * El filete entre cifras, y no una tarjeta por cifra: cinco recuadros dentro de
 * un recuadro son tarjetas anidadas, que es justo lo que el sistema prohibe.
 *
 * SIN TINTE, por pedido explicito. Antes llevaba un degradado rojo y un borde
 * rojo, y eso rompia la Regla del Rojo Unico dos veces: tenia el rojo de marca
 * pintando un area grande —que es color de relleno de ACCION, no de superficie—
 * y ademas un segundo rojo en el titulo que no marcaba nada accionable. Ahora se
 * sostiene igual que el resto, con filete y jerarquia tipografica.
 */
export function QuickOverview({ title, stats }: { title: string; stats: QuickStat[] }) {
  return (
    <section className={`${CARD_RADIUS} border border-line bg-white p-5`}>
      <h2 className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
        {title}
      </h2>

      <dl className="mt-4 grid grid-cols-2 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`px-4 first:pl-0 ${
              // El filete separa dentro de la fila, nunca al inicio de una: en
              // dos columnas el de la izquierda arrancaria con una raya suelta.
              index % 2 === 0 ? "border-l-0" : "border-l border-line"
            } sm:[&:nth-child(3n+1)]:border-l-0 sm:[&:nth-child(3n+2)]:border-l
              lg:[&:nth-child(n)]:border-l lg:[&:nth-child(5n+1)]:border-l-0
              lg:[&:nth-child(5n+1)]:pl-0`}
          >
            {/* 20px, el paso `headline`: estas son cifras de CONTEXTO y tienen
                que ceder frente a las de Calidad, que son las que piden accion.
                A 26px competian con ellas y la pantalla no decia que mirar
                primero. */}
            <dd className="font-heading text-[20px] font-bold leading-none tracking-[-0.02em] text-ink">
              {stat.value}
            </dd>
            <dt className="mt-1.5 text-[12px] leading-tight text-subtle">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

interface MiniStatProps {
  label: string;
  value: string;
  /** Una linea que dice de donde sale la cifra. */
  hint: string;
  tone?: Tone;
}

const dotTone: Record<Tone, string> = {
  // Gris para lo informativo. Un punto de color en cada tarjeta convierte el
  // recurso en decoracion: si todo esta marcado, nada esta marcado.
  neutral: "bg-line-strong",
  brand: "bg-brand-red",
  red: "bg-brand-red",
  green: "bg-brand-green",
  warn: "bg-warn",
};

/**
 * Cifra suelta con su punto de estado, en la rejilla de la referencia.
 *
 * El punto es un refuerzo y jamas la unica senal: el veredicto viaja tambien en
 * la linea de apoyo. Un tablero que solo dice "verde" o "rojo" con un circulo
 * no lo puede leer una de cada doce personas.
 */
export function MiniStat({ label, value, hint, tone = "neutral" }: MiniStatProps) {
  return (
    // Sin `h-full`: estas tarjetas viven al lado de un panel alto, y estirarlas
    // para igualarlo deja el hueco DENTRO de cada una, que se lee como un panel
    // a medio cargar. El aire sobrante va al final de la columna.
    <DashboardCard padding="sm" className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {/* 28px, el mismo paso que toda cifra de cabecera del tablero: estas
            si son las que hacen que alguien se levante de la silla. */}
        <p className="font-heading text-[28px] font-bold leading-none tabular-nums text-ink">
          {value}
        </p>
        <p className="mt-1.5 text-[12.5px] font-medium text-brand-gray">{label}</p>
        <p className="mt-0.5 text-[11.5px] leading-tight text-faint">{hint}</p>
      </div>
      <span aria-hidden className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotTone[tone]}`} />
    </DashboardCard>
  );
}
