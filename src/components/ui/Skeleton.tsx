/**
 * Marcador de carga.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTO Y NO UN SPINNER
 * ------------------------------------------------------------------
 * Un spinner dice «esperá» y nada más: la pantalla queda en blanco, el layout
 * salta cuando llegan los datos, y la persona no sabe si lo que viene son tres
 * filas o cincuenta. Un esqueleto ocupa el sitio EXACTO del contenido que va a
 * llegar, así que el salto no existe y la espera se lee como «ya casi» en vez
 * de como «algo se colgó».
 *
 * ------------------------------------------------------------------
 * EL BRILLO SE APAGA SOLO
 * ------------------------------------------------------------------
 * La animación vive en CSS (`plf-shimmer`) y `prefers-reduced-motion` la
 * detiene dejando el bloque gris quieto. Un esqueleto que sigue latiendo
 * cuando el sistema pidió menos movimiento es exactamente el tipo de animación
 * que marea a quien la desactivó a propósito.
 */
export function Skeleton({
  className = "",
  /** Lo que este bloque va a ser cuando cargue. Sólo para lectores de pantalla. */
  label,
  /** Desfase del brillo, en milisegundos. Ver `TableSkeleton`. */
  delay = 0,
}: {
  className?: string;
  label?: string;
  delay?: number;
}) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "status" : undefined}
      className={`plf-skeleton block rounded-edge bg-fill ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    />
  );
}

/* -------------------------------------------------------------------------- */

/**
 * El esqueleto de una tabla de listado.
 *
 * Reproduce la cabecera y `rows` filas con la misma altura y los mismos filetes
 * que `DataTable`, para que al llegar los datos nada se mueva de sitio.
 */
export function TableSkeleton({
  rows = 8,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div role="status" aria-label="Cargando resultados">
      <div className="flex items-center gap-4 border-b border-line px-4 py-3">
        {Array.from({ length: columns }).map((_, column) => (
          <Skeleton key={column} className="h-2.5 flex-1" />
        ))}
      </div>

      {/* El desfase por fila y columna hace que el brillo recorra la tabla en
          diagonal en vez de latir todo junto, que se lee como un parpadeo. Se
          corta a los 480 ms: mas alla, las ultimas filas empiezan a brillar
          cuando los datos ya llegaron. */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex items-center gap-4 border-b border-line-soft px-4 py-3.5 last:border-0"
        >
          {Array.from({ length: columns }).map((_, column) => (
            <span key={column} className="flex-1">
              <Skeleton
                className="h-3.5"
                delay={Math.min(row * 60 + column * 25, 480)}
              />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Lista de conversaciones en la bandeja (columna izquierda). */
export function InboxListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Cargando conversaciones" className="flex flex-col gap-1 p-3 pt-0">
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex gap-2.5 rounded-lg border border-transparent px-2.5 py-2.5"
        >
          <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" delay={row * 40} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-[42%]" delay={row * 40 + 20} />
              <Skeleton className="h-2.5 w-10 shrink-0" delay={row * 40 + 30} />
            </div>
            <Skeleton className="h-3 w-[88%]" delay={row * 40 + 50} />
            <Skeleton className="h-2.5 w-[65%]" delay={row * 40 + 70} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Panel de lectura mientras llega el hilo seleccionado. */
export function MailReadingPaneSkeleton() {
  return (
    <div role="status" aria-label="Cargando mensaje" className="flex h-full flex-col p-6">
      <div className="space-y-3 border-b border-line pb-5">
        <Skeleton className="h-5 w-[70%]" />
        <Skeleton className="h-3 w-[45%]" />
        <Skeleton className="h-3 w-[32%]" delay={80} />
      </div>
      <div className="mt-6 space-y-3 flex-1">
        {Array.from({ length: 6 }).map((_, row) => (
          <Skeleton key={row} className="h-3 w-full" delay={120 + row * 45} />
        ))}
        <Skeleton className="h-3 w-[80%]" delay={400} />
      </div>
    </div>
  );
}
