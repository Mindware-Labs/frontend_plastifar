import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatPercentDecimal } from "./format";

/* ========================================================================== *
 *  Piezas del tablero.
 *
 *  La ANATOMIA sale de la referencia (image.png): fila de cifras arriba, curva
 *  ancha, comparacion por categoria, indicador de salud y tabla al pie.
 *
 *  El ESTILO no sale de ahi. La referencia es azul, con tarjetas blandas y
 *  sombra; aqui la pantalla vuelve al sistema del panel — filete de 1 px, canto
 *  de 2 px, nada que haga scroll lleva sombra y el unico acento es el 185 C.
 *  El Dashboard deja de ser la superficie de tarjetas que era: era la unica
 *  pantalla del panel con otro lenguaje.
 * ========================================================================== */

export type Tone = "neutral" | "red" | "green" | "warn";

/* -------------------------------------------------------------------------- */

/**
 * Caja del tablero: filete, canto de 2 px y nada mas.
 *
 * Es el unico contenedor de esta pantalla. No hay tarjeta, no hay sombra y no
 * hay fondo tintado para "senalar seccion": la separacion la hace el filete,
 * igual que en el resto del panel.
 */
export function Board({
  title,
  hint,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  /** Una linea que dice de donde sale lo que se esta mirando. */
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-edge border border-line bg-white ${className}`}
    >
      {/* Envuelve a proposito. Con `flex-nowrap` el titulo y su linea de apoyo
          se comian en puntos suspensivos a ancho de telefono para dejarle sitio
          a una leyenda que puede bajar de renglon sin costo. */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-line px-4 py-2.5">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="truncate font-heading text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-faint">
            {title}
          </h2>
          {hint && <p className="truncate text-[11.5px] leading-tight text-subtle">{hint}</p>}
        </span>
        {/* `basis-full` en angosto: sin el, el titulo se encogia hasta los puntos
            suspensivos para dejarle la linea a la leyenda. Bajando de renglon,
            los dos caben enteros. */}
        {actions && (
          <span className="flex basis-full items-center gap-2 sm:basis-auto sm:shrink-0">
            {actions}
          </span>
        )}
      </header>
      {/* `overflow-hidden`: el cuerpo reparte el alto que le queda; sin el, una
          grafica que pide mas alto del disponible se dibuja sobre la cabecera. */}
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden p-4 ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * La tercera capa de una cifra: cuanto cambio y hacia donde.
 *
 * Flecha Y signo Y color, los tres: el color solo no sobrevive a una impresion
 * en gris ni a un daltonismo rojo-verde, y esta pastilla es justamente la que
 * dice si el numero de arriba es una buena o una mala noticia.
 *
 * Verde es "subio", rojo es "bajo" — y no al reves — porque las cuatro cifras
 * del tablero son cifras donde mas es mejor. Una cifra donde subir es malo pasa
 * `invert` y la lectura se mantiene: el color dice el veredicto, nunca la
 * direccion aritmetica.
 */
export function DeltaPill({ value, invert = false }: { value: number; invert?: boolean }) {
  const up = value >= 0;
  const good = invert ? !up : up;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={`inline-flex h-[20px] shrink-0 items-center gap-1 rounded-pill px-2
        font-heading text-[10.5px] font-semibold tabular-nums ${
          good ? "bg-brand-green/10 text-brand-green" : "bg-brand-red/10 text-brand-red-dark"
        }`}
    >
      <Arrow className="h-3 w-3" aria-hidden />
      {up ? "+" : "−"}
      {formatPercentDecimal(Math.abs(value) / 100)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

export interface KpiItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  /** De donde sale la cifra. Va siempre: el numero solo no dice a que responde. */
  hint: string;
  /** Variacion contra el periodo anterior, en porcentaje. */
  delta?: number;
  /** `true` cuando subir es malo (vencidas, tiempo de cierre). */
  invert?: boolean;
  tone?: Tone;
  /** A donde lleva la cifra: la lista que la produjo. */
  to?: string;
}

/**
 * La fila de cuatro cifras, en UNA caja partida por filetes verticales.
 *
 * Cuatro cajas sueltas serian cuatro tarjetas con otro nombre. Partida, la fila
 * se lee como una sola unidad —que es lo que es: el estado del periodo— y los
 * filetes hacen el trabajo que en la referencia hace la separacion por sombra.
 */
export function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <dl className="grid grid-cols-1 rounded-edge border border-line bg-white sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <KpiCell key={item.label} item={item} index={index} />
      ))}
    </dl>
  );
}

function KpiCell({ item, index }: { item: KpiItem; index: number }) {
  const { icon: Icon, label, value, hint, delta, invert, tone = "neutral", to } = item;

  return (
    <div
      className={`group relative flex min-w-0 flex-col gap-2.5 px-4 py-3.5
        ${/* Filete inferior que se enciende: es el mismo gesto que el panel ya
             usa para decir "esto responde" en todo control (`hairline-hover`).
             La celda es un enlace entero y su unico aviso era una flecha que
             aparecia de la nada en la esquina. */ ""}
        border-b-2 border-b-transparent transition-colors
        hover:border-b-hairline-hover hover:bg-canvas
        focus-within:border-b-brand-red focus-within:bg-canvas
        ${/* El filete separa DENTRO de la fila, nunca al inicio de una: en
             angosto la columna es una sola y no lleva ninguno. */ ""}
        ${index === 0 ? "" : "border-t border-line-soft"}
        sm:[&:nth-child(2n+1)]:border-l-0 sm:[&:nth-child(-n+2)]:border-t-0
        sm:[&:nth-child(2n)]:border-l sm:[&:nth-child(2n)]:border-line-soft
        xl:border-t-0 xl:[&:nth-child(n)]:border-l xl:[&:nth-child(n)]:border-line-soft
        xl:[&:nth-child(1)]:border-l-0`}
    >
      <dt className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-edge ${chipTone[tone]}`}
        >
          <Icon className="h-[13px] w-[13px]" />
        </span>
        {to ? (
          <Link
            to={to}
            className="truncate font-heading text-[10px] font-semibold uppercase leading-[1.4] tracking-[0.08em]
              text-faint outline-none transition-colors group-hover:text-ink
              focus-visible:ring-3 focus-visible:ring-brand-red/25
              after:absolute after:inset-0 after:cursor-pointer after:content-['']"
          >
            <span className="sr-only">Ver </span>
            {label}
          </Link>
        ) : (
          <span className="truncate font-heading text-[10px] font-semibold uppercase leading-[1.4] tracking-[0.08em] text-faint">
            {label}
          </span>
        )}
      </dt>

      {/* Las tres capas de la referencia, en una linea: cifra grande, variacion
          y direccion. La flecha vive DENTRO de la pastilla — separada, serian
          dos elementos diciendo lo mismo a dos alturas distintas. */}
      <dd className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
        <span className="font-heading text-[30px] font-bold leading-none tracking-[-0.03em] tabular-nums text-ink">
          {value}
        </span>
        {delta !== undefined && <DeltaPill value={delta} invert={invert} />}
      </dd>

      <p className="truncate text-[11.5px] leading-tight text-faint">{hint}</p>

      {to && (
        <ArrowUpRight
          aria-hidden
          className="pointer-events-none absolute right-3.5 top-3.5 h-3.5 w-3.5 text-line-strong
            opacity-0 transition-opacity duration-150 group-hover:opacity-100
            group-focus-within:opacity-100"
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Selector de periodo como chips, no como `Select`.
 *
 * Son tres opciones y siempre las mismas: un desplegable esconde dos de las tres
 * detras de un click para ahorrar 120 px que esta cabecera tiene de sobra. El
 * activo va en rojo solido, que es el mismo estado activo del resto del panel.
 */
export function PeriodTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Período"
      className="flex shrink-0 items-center gap-1 rounded-edge border border-line p-0.5"
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.key)}
            className={`h-7 cursor-pointer rounded-edge px-2.5 font-heading text-[11px] font-semibold
              uppercase tracking-[0.06em] outline-none transition-colors
              focus-visible:ring-3 focus-visible:ring-brand-red/25 ${
                active
                  ? "bg-brand-red text-white"
                  : "text-subtle hover:bg-fill hover:text-ink"
              }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Boton de refrescar de la cabecera. Uno solo en la pantalla: se pide todo junto. */
export function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label="Actualizar"
      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-edge
        border border-line-strong bg-white text-subtle outline-none transition-colors
        hover:border-hairline-hover hover:text-ink
        focus-visible:ring-3 focus-visible:ring-brand-red/25
        disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden />
    </button>
  );
}

/* -------------------------------------------------------------------------- */

/** Tinte del cuadro de icono. 10 %, el mismo valor de insignia del sistema. */
const chipTone: Record<Tone, string> = {
  neutral: "bg-fill text-subtle",
  red: "bg-brand-red/10 text-brand-red-dark",
  green: "bg-brand-green/10 text-brand-green",
  warn: "bg-warn/10 text-warn",
};
