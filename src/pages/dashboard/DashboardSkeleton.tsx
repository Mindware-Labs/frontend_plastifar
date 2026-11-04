import type { ReactNode } from "react";
import { Skeleton } from "../../components/ui/Skeleton";

/* ========================================================================== *
 *  Esqueleto del tablero.
 *
 *  Calca la pantalla cargada pieza por pieza, no solo la reparticion de cajas:
 *  la fila de cuatro cifras partida por filetes, la cabecera de cada `Board`
 *  con su filete inferior, y dentro de cada caja la silueta de lo que va a
 *  llegar — curva con su cuadricula, anillo del indicador, barras horizontales
 *  y filas de tabla. Al llegar los datos las piezas se llenan en su sitio; no
 *  hay salto ni cambio de forma.
 *
 *  Los altos y rellenos son los de `board.tsx`, `boardCharts.tsx` y
 *  `DataTable`. Si cambia uno de esos, cambia aqui tambien.
 * ========================================================================== */

/** La misma caja que `Board`, con barras en lugar de titulo y linea de apoyo. */
function BoardShell({
  className = "",
  bodyClassName = "",
  titleWidth,
  hintWidth,
  actions,
  children,
}: {
  className?: string;
  bodyClassName?: string;
  titleWidth: string;
  hintWidth: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-edge border border-line bg-white ${className}`}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 py-px">
          <Skeleton className={`h-2 ${titleWidth}`} />
          <Skeleton className={`h-2.5 ${hintWidth}`} delay={40} />
        </span>
        {actions}
      </header>
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden p-4 ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}

/** Cuadro de icono de la cabecera: 22 px, igual que el real. */
function ChipSlot() {
  return <Skeleton className="h-[22px] w-[22px] shrink-0" />;
}

/* -------------------------------------------------------------------------- */

/** Fila de cifras: una sola caja, cuatro celdas, los mismos filetes que `KpiRow`. */
function KpiRowSkeleton() {
  const widths = ["w-20", "w-24", "w-28", "w-24"];
  return (
    <div className="grid grid-cols-1 rounded-edge border border-line bg-white sm:grid-cols-2 xl:grid-cols-4">
      {widths.map((width, index) => (
        <div
          key={index}
          className={`flex min-w-0 flex-col gap-2.5 border-b-2 border-b-transparent px-4 py-3.5
            ${index === 0 ? "" : "border-t border-line-soft"}
            sm:[&:nth-child(2n+1)]:border-l-0 sm:[&:nth-child(-n+2)]:border-t-0
            sm:[&:nth-child(2n)]:border-l sm:[&:nth-child(2n)]:border-line-soft
            xl:border-t-0 xl:[&:nth-child(n)]:border-l xl:[&:nth-child(n)]:border-line-soft
            xl:[&:nth-child(1)]:border-l-0`}
        >
          <span className="flex h-[22px] items-center gap-2">
            <ChipSlot />
            <Skeleton className={`h-2 ${width}`} delay={index * 60} />
          </span>
          <span className="flex h-[30px] items-end gap-2.5">
            <Skeleton className="h-[26px] w-20" delay={index * 60 + 30} />
            {/* La tercera ficha (clientes) no lleva pastilla en la real. */}
            {index !== 2 && (
              <Skeleton className="h-5 w-14 !rounded-pill" delay={index * 60 + 60} />
            )}
          </span>
          <Skeleton className="h-2.5 w-36 max-w-full" delay={index * 60 + 90} />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Ejes y cuadricula punteada como los de Recharts, con la curva recortada. */
function TrendSkeleton() {
  return (
    <div className="flex min-h-[180px] flex-1 flex-col">
      <div className="flex min-h-0 flex-1 gap-2">
        {/* Eje Y: cinco marcas, `tickCount={5}`. */}
        <span className="flex w-[22px] shrink-0 flex-col justify-between py-0.5">
          {Array.from({ length: 5 }).map((_, tick) => (
            <Skeleton key={tick} className="h-2 w-full" delay={tick * 30} />
          ))}
        </span>
        <div className="relative min-h-0 flex-1">
          <span aria-hidden className="absolute inset-0 flex flex-col justify-between py-1">
            {Array.from({ length: 5 }).map((_, line) => (
              <span key={line} className="block border-t border-dashed border-line-soft" />
            ))}
          </span>
          {/* La silueta de un area que sube: lo bastante concreta para leerse
              como "curva", lo bastante plana para no prometer una forma. */}
          <span
            className="plf-skeleton absolute inset-x-0 bottom-1 top-[18%] block bg-fill"
            style={{
              clipPath:
                "polygon(0% 72%, 9% 58%, 18% 64%, 27% 44%, 36% 52%, 45% 34%, 54% 42%, 63% 26%, 72% 36%, 81% 20%, 90% 30%, 100% 14%, 100% 100%, 0% 100%)",
            }}
          />
        </div>
      </div>
      {/* Eje X: un mes por marca. */}
      <span className="ml-[30px] flex justify-between pt-2.5">
        {Array.from({ length: 12 }).map((_, month) => (
          <Skeleton key={month} className="h-2 w-5" delay={Math.min(month * 30, 360)} />
        ))}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * El anillo del indicador: mismo arco de 200° a -20°, mismo centro al 64 % del
 * alto y el mismo grosor relativo (78 %–95 % del radio).
 */
function GaugeSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-[140px] w-full flex-1">
        <svg
          aria-hidden
          viewBox="0 0 200 140"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full motion-safe:animate-pulse"
        >
          <path
            d="M 33.3 114.3 A 71 71 0 1 1 166.7 114.3"
            fill="none"
            stroke="var(--color-fill)"
            strokeWidth="12"
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-x-0 top-[64%] flex -translate-y-[70%] flex-col items-center gap-2">
          <Skeleton className="h-[26px] w-16" />
          <Skeleton className="h-2 w-14" delay={60} />
        </span>
      </div>
      <span className="flex shrink-0 flex-col gap-1.5 border-t border-line-soft pt-2.5">
        <Skeleton className="h-2.5 w-[85%]" delay={90} />
        <Skeleton className="h-2 w-[65%]" delay={120} />
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Siete barras horizontales de largo decreciente, con su columna de nombres. */
function CategoryBarsSkeleton() {
  const lengths = [92, 78, 64, 52, 40, 30, 20];
  return (
    <div className="flex min-h-[190px] flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-around gap-2">
        {lengths.map((length, bar) => (
          <span key={bar} className="flex items-center gap-3">
            <span className="flex w-[96px] shrink-0 justify-end">
              <Skeleton className="h-2 w-[72%]" delay={bar * 50} />
            </span>
            <span className="flex-1">
              {/* El largo va en un envoltorio: `Skeleton` no recibe estilo propio. */}
              <span className="block" style={{ width: `${length}%` }}>
                <Skeleton className="h-[18px]" delay={bar * 50 + 25} />
              </span>
            </span>
          </span>
        ))}
      </div>
      <span className="ml-[108px] flex justify-between pt-2.5">
        {Array.from({ length: 5 }).map((_, tick) => (
          <Skeleton key={tick} className="h-2 w-5" delay={tick * 30} />
        ))}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** La tabla de territorios: cabecera de 36 px y filas de densidad de panel. */
function TerritoriesTableSkeleton({ rows = 7 }: { rows?: number }) {
  const names = ["w-24", "w-20", "w-28", "w-16", "w-24", "w-20", "w-14"];
  return (
    <div className="w-full">
      <div className="flex h-9 items-center gap-6 border-b border-line px-3">
        <Skeleton className="h-2 w-20" />
        <span className="ml-auto hidden items-center gap-6 sm:flex">
          <Skeleton className="h-2 w-12" delay={25} />
          <Skeleton className="h-2 w-12" delay={50} />
          <Skeleton className="h-2 w-[104px]" delay={75} />
        </span>
        <Skeleton className="h-2 w-14 max-sm:ml-auto" delay={100} />
      </div>
      {Array.from({ length: rows }).map((_, row) => {
        const delay = Math.min(row * 60, 420);
        return (
          <div
            key={row}
            className="flex h-10 items-center gap-6 border-b border-line-soft px-3 last:border-0"
          >
            <Skeleton className={`h-3 ${names[row % names.length]}`} delay={delay} />
            <span className="ml-auto hidden items-center gap-6 sm:flex">
              <Skeleton className="h-3 w-12" delay={delay + 25} />
              <Skeleton className="h-3 w-12" delay={delay + 50} />
              <span className="flex w-[104px] items-center gap-2.5">
                <Skeleton className="h-1 flex-1 !rounded-pill" delay={delay + 75} />
                <Skeleton className="h-3 w-9" delay={delay + 75} />
              </span>
            </span>
            <Skeleton className="h-5 w-14 !rounded-pill max-sm:ml-auto" delay={delay + 100} />
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Esqueleto del tablero: las mismas tres bandas, las mismas columnas en `xl` y
 * los mismos pisos (320 px la segunda banda, 340 px la tabla).
 */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Cargando el tablero" className="flex flex-col gap-4">
      <KpiRowSkeleton />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <BoardShell
          className="min-h-[320px] xl:col-span-8"
          titleWidth="w-36"
          hintWidth="w-52"
          actions={
            <span className="flex shrink-0 items-center gap-3">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-2.5 w-16" delay={40} />
            </span>
          }
        >
          <TrendSkeleton />
        </BoardShell>

        <BoardShell
          className="min-h-[320px] xl:col-span-4"
          titleWidth="w-24"
          hintWidth="w-28"
          actions={<ChipSlot />}
        >
          <GaugeSkeleton />
        </BoardShell>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <BoardShell
          className="xl:col-span-5"
          titleWidth="w-36"
          hintWidth="w-48"
          actions={<ChipSlot />}
        >
          <CategoryBarsSkeleton />
        </BoardShell>

        <BoardShell
          className="min-h-[340px] xl:col-span-7"
          bodyClassName="!p-0"
          titleWidth="w-32"
          hintWidth="w-52"
          actions={<Skeleton className="h-2.5 w-20" />}
        >
          <TerritoriesTableSkeleton />
        </BoardShell>
      </div>

      <Skeleton className="h-2.5 w-[60%]" />
    </div>
  );
}
