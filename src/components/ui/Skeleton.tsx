import { MODULE_HEADER_TITLE_GUTTER_CLASS } from "../app/ModuleHeader";

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

/**
 * Esqueleto simétrico de la cuadrícula de tickets (3×3 por defecto).
 * Reproduce las 4 zonas arquitectónicas de cada tarjeta para evitar cualquier salto de layout.
 */
export function TicketCardsSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Cargando tickets"
      className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3 auto-rows-fr"
    >
      {Array.from({ length: count }).map((_, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const baseDelay = Math.min(row * 75 + col * 40, 420);
        return (
          <div
            key={i}
            className="flex flex-col justify-between rounded-card border border-line bg-white p-4 shadow-card"
          >
            {/* Zona 1: Cabecera simétrica (Código + Estado/Prioridad) */}
            <div className="flex h-6 items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="size-4.5 rounded-[5px]" delay={baseDelay} />
                <Skeleton className="h-4 w-28 rounded-md" delay={baseDelay + 20} />
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-5 w-14 rounded-md" delay={baseDelay + 40} />
                <Skeleton className="h-5 w-20 rounded-md" delay={baseDelay + 60} />
              </div>
            </div>

            {/* Zona 2: Bloque de asunto de altura fija (40px) */}
            <div className="mt-2.5 flex h-[40px] flex-col justify-center gap-1.5">
              <Skeleton className="h-3.5 w-[92%] rounded" delay={baseDelay + 50} />
              <Skeleton className="h-3.5 w-[68%] rounded" delay={baseDelay + 70} />
            </div>

            {/* Zona 3: Panel Hundido Simétrico (Cliente + Departamento + 50/50 Motivo y SLA) */}
            <div className="mt-3 overflow-hidden rounded-inset border border-line bg-canvas/85 divide-y divide-line">
              <div className="grid h-8.5 grid-cols-[76px_1fr] items-center gap-2.5 px-3">
                <Skeleton className="h-2.5 w-14 rounded" delay={baseDelay + 80} />
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-36 rounded" delay={baseDelay + 95} />
                  <Skeleton className="h-4 w-12 rounded" delay={baseDelay + 110} />
                </div>
              </div>
              <div className="grid h-8.5 grid-cols-[76px_1fr] items-center gap-2.5 px-3">
                <Skeleton className="h-2.5 w-12 rounded" delay={baseDelay + 100} />
                <Skeleton className="h-3 w-44 rounded" delay={baseDelay + 115} />
              </div>
              <div className="grid h-[46px] grid-cols-2 divide-x divide-line bg-white/50">
                <div className="flex flex-col justify-center gap-1.5 px-3">
                  <Skeleton className="h-2 w-12 rounded" delay={baseDelay + 120} />
                  <Skeleton className="h-3 w-24 rounded" delay={baseDelay + 135} />
                </div>
                <div className="flex flex-col justify-center gap-1.5 px-3">
                  <Skeleton className="h-2 w-16 rounded" delay={baseDelay + 130} />
                  <Skeleton className="h-3.5 w-20 rounded" delay={baseDelay + 145} />
                </div>
              </div>
            </div>

            {/* Zona 4: Pie operativo simétrico */}
            <div className="mt-3 flex h-7 items-center justify-between gap-2 border-t border-line-soft pt-2.5">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-full" delay={baseDelay + 140} />
                <Skeleton className="h-3 w-24 rounded" delay={baseDelay + 155} />
              </div>
              <Skeleton className="h-3 w-16 rounded" delay={baseDelay + 165} />
            </div>
          </div>
        );
      })}
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

/**
 * Esqueleto ejecutivo de alta fidelidad para la ficha de ticket.
 *
 * Mantiene la arquitectura exacta de ModuleHeader, métricas superiores y
 * tarjetas de contenido para evitar el Cumulative Layout Shift (CLS) y
 * brindar una transición de carga elegante, continua y de grado premium.
 */
export function TicketDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando ticket"
      className="flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-apple-tab select-none"
    >
      {/* 1. Header estructural idéntico a ModuleHeader para 0 saltos de layout */}
      <div className="shrink-0 border-b border-zinc-200/80 -mx-3 lg:-mx-4 px-3 lg:px-4 mb-3 h-14 flex items-center justify-between gap-x-4">
        <div className="flex shrink-0 items-center gap-x-3">
          {/* Botón volver */}
          <div className="h-8 w-8 rounded-lg border border-zinc-200/90 bg-white shadow-2xs flex items-center justify-center p-2">
            <Skeleton className="h-3.5 w-3.5 rounded" />
          </div>

          {/* Código de ticket + badges */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-full" delay={60} />
            <Skeleton className="h-5 w-16 rounded-full" delay={120} />
          </div>

          <span aria-hidden className="hidden h-4 w-px bg-zinc-200/90 sm:inline-block" />

          {/* Tira de pestañas */}
          <div className="hidden md:flex items-center gap-1.5">
            <Skeleton className="h-6 w-14 rounded-md" delay={140} />
            <Skeleton className="h-6 w-24 rounded-md" delay={180} />
            <Skeleton className="h-6 w-18 rounded-md" delay={220} />
            <Skeleton className="h-6 w-24 rounded-md" delay={260} />
            <Skeleton className="h-6 w-20 rounded-md" delay={300} />
          </div>
        </div>

        {/* Acciones superiores derechas */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" delay={100} />
          <Skeleton className="h-8 w-28 rounded-lg" delay={160} />
        </div>
      </div>

      {/* 2. Zona de contenido con scroll vertical asegurado */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-8">
        <div className="pt-2 pr-3 lg:pr-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Asunto */}
            <div className={`min-w-0 max-w-full lg:max-w-2xl ${MODULE_HEADER_TITLE_GUTTER_CLASS}`}>
              <Skeleton className="h-6 w-80 max-w-full rounded-md" delay={80} />
            </div>

            {/* Metadatos (creado por...) */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-44 rounded-md" delay={120} />
            </div>
          </div>
        </div>

        {/* 3. Rejilla ejecutiva de tarjetas y métricas */}
        <div className="mt-3.5 mx-auto max-w-6xl space-y-3.5">
          {/* Métricas rápidas superiores (4 tarjetas SaaS) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-2.5 w-14 rounded" delay={i * 40} />
                  <Skeleton className="size-2 rounded-full" delay={i * 40} />
                </div>
                <Skeleton className="h-4 w-20 rounded" delay={i * 40 + 60} />
                <Skeleton className="h-2 w-28 rounded" delay={i * 40 + 100} />
              </div>
            ))}
          </div>

          {/* Contenido en 2 columnas: Ficha principal + Panel lateral de tiempos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
            {/* Columna izquierda (2 cols): Datos del solicitante, descripción y detalle */}
            <div className="lg:col-span-2 space-y-3.5">
              {/* Tarjeta Solicitante / Cliente */}
              <div className="rounded-card border border-zinc-200/80 bg-white p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-4 rounded" delay={100} />
                    <Skeleton className="h-3 w-28 rounded" delay={120} />
                  </div>
                  <Skeleton className="h-3 w-16 rounded" delay={140} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <Skeleton className="h-2 w-16 mb-1.5" delay={160} />
                    <Skeleton className="h-3.5 w-24" delay={180} />
                  </div>
                  <div>
                    <Skeleton className="h-2 w-16 mb-1.5" delay={200} />
                    <Skeleton className="h-3.5 w-32" delay={220} />
                  </div>
                  <div>
                    <Skeleton className="h-2 w-16 mb-1.5" delay={240} />
                    <Skeleton className="h-3.5 w-20" delay={260} />
                  </div>
                </div>
              </div>

              {/* Tarjeta Descripción del caso */}
              <div className="rounded-card border border-zinc-200/80 bg-white p-4 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
                  <Skeleton className="size-4 rounded" delay={200} />
                  <Skeleton className="h-3 w-32 rounded" delay={220} />
                </div>
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-3 w-full" delay={240} />
                  <Skeleton className="h-3 w-[94%]" delay={270} />
                  <Skeleton className="h-3 w-[82%]" delay={300} />
                  <Skeleton className="h-3 w-[88%]" delay={330} />
                </div>
              </div>

              {/* Tarjeta Productos vinculados */}
              <div className="rounded-card border border-zinc-200/80 bg-white p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-4 rounded" delay={280} />
                    <Skeleton className="h-3 w-36 rounded" delay={300} />
                  </div>
                  <Skeleton className="h-4 w-12 rounded-md" delay={320} />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-9 w-full rounded-lg" delay={340} />
                  <Skeleton className="h-9 w-full rounded-lg" delay={380} />
                </div>
              </div>
            </div>

            {/* Columna derecha (1 col): SLA y seguimiento */}
            <div className="space-y-3.5">
              <div className="rounded-card border border-zinc-200/80 bg-white p-4 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                  <Skeleton className="h-3 w-24 rounded" delay={150} />
                  <Skeleton className="size-3.5 rounded" delay={170} />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-32 rounded" delay={190} />
                  <Skeleton className="h-2 w-full rounded-full" delay={220} />
                  <div className="flex justify-between">
                    <Skeleton className="h-2 w-16" delay={250} />
                    <Skeleton className="h-2 w-12" delay={280} />
                  </div>
                </div>
              </div>

              <div className="rounded-card border border-zinc-200/80 bg-white p-4 shadow-2xs space-y-3">
                <div className="border-b border-zinc-100 pb-2">
                  <Skeleton className="h-3 w-28 rounded" delay={260} />
                </div>
                <div className="space-y-2.5">
                  <Skeleton className="h-7 w-full rounded-lg" delay={300} />
                  <Skeleton className="h-7 w-full rounded-lg" delay={340} />
                  <Skeleton className="h-7 w-full rounded-lg" delay={380} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Esqueleto de la ficha de un colaborador, con la misma arquitectura que la
 * ficha de ticket: cabecera con botón volver y pestañas, y debajo el resumen
 * (métricas + rejilla 2/3 · 1/3) o, en «Accesos», las dos tablas.
 */
export function StaffDetailSkeleton({ section = "datos" }: { section?: "datos" | "accesos" | "actividad" }) {
  const cardHead = (delay: number, width = "w-28") => (
    <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded" delay={delay} />
        <Skeleton className={`h-3 ${width} rounded`} delay={delay + 20} />
      </div>
      <Skeleton className="h-3 w-14 rounded" delay={delay + 40} />
    </div>
  );
  const rows = (count: number, delay: number) => (
    <div className="divide-y divide-zinc-100 px-4 py-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-2.5">
          <Skeleton className="h-3 w-20 rounded" delay={delay + i * 40} />
          <Skeleton className="h-3 w-32 rounded" delay={delay + i * 40 + 20} />
        </div>
      ))}
    </div>
  );
  const card = "overflow-hidden rounded-card border border-line bg-white shadow-card";

  return (
    <div
      role="status"
      aria-label="Cargando colaborador"
      className="flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-apple-tab select-none"
    >
      {/* Cabecera idéntica a ModuleHeader */}
      <div className="shrink-0 border-b border-zinc-200/80 -mx-3 lg:-mx-4 px-3 lg:px-4 mb-3 h-14 flex items-center justify-between gap-x-4">
        <div className="flex shrink-0 items-center gap-x-3">
          <div className="h-8 w-8 rounded-lg border border-zinc-200/90 bg-white shadow-2xs flex items-center justify-center p-2">
            <Skeleton className="h-3.5 w-3.5 rounded" />
          </div>
          <Skeleton className="h-5 w-40 rounded-md" />
          <span aria-hidden className="hidden h-4 w-px bg-zinc-200/90 sm:inline-block" />
          <div className="hidden md:flex items-center gap-1.5">
            <Skeleton className="h-6 w-14 rounded-md" delay={140} />
            <Skeleton className="h-6 w-18 rounded-md" delay={180} />
            <Skeleton className="h-6 w-20 rounded-md" delay={220} />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-8">
        {section === "datos" ? (
          <div className="mt-3.5 mx-auto max-w-6xl space-y-3.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-2.5 w-16 rounded" delay={i * 40} />
                    <Skeleton className="size-2 rounded-full" delay={i * 40} />
                  </div>
                  <Skeleton className="h-4 w-24 rounded" delay={i * 40 + 60} />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
              <div className="lg:col-span-2 space-y-3.5">
                <div className={card}>
                  {cardHead(100, "w-32")}
                  <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
                    <Skeleton className="size-9 rounded-full" delay={140} />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-40 rounded" delay={160} />
                      <Skeleton className="h-2.5 w-28 rounded" delay={180} />
                    </div>
                  </div>
                  {rows(2, 200)}
                </div>
                <div className={card}>
                  {cardHead(220, "w-44")}
                  <div className="divide-y divide-zinc-100 px-4 py-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <Skeleton className="size-6 rounded-md" delay={260 + i * 40} />
                          <div className="space-y-1.5">
                            <Skeleton className="h-3 w-36 rounded" delay={280 + i * 40} />
                            <Skeleton className="h-2.5 w-24 rounded" delay={300 + i * 40} />
                          </div>
                        </div>
                        <Skeleton className="h-5 w-16 rounded-md" delay={320 + i * 40} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3.5">
                <div className={card}>
                  {cardHead(150, "w-16")}
                  {rows(3, 180)}
                </div>
                <div className={card}>
                  {cardHead(220, "w-16")}
                  {rows(2, 250)}
                </div>
                <div className={card}>
                  {cardHead(280, "w-36")}
                  <div className="grid grid-cols-3 gap-2 p-3.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-lg" delay={320 + i * 40} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : section === "accesos" ? (
          <div className="mt-3.5 mx-auto max-w-6xl space-y-3.5">
            <div className={card}>
              <TableSkeleton rows={3} columns={6} />
            </div>
            <div className={card}>
              <TableSkeleton rows={6} columns={3} />
            </div>
          </div>
        ) : (
          <div className="mt-3.5 mx-auto max-w-6xl space-y-3.5">
            <div className="flex justify-between items-center">
              <Skeleton className="h-8 w-64 rounded-lg" delay={80} />
              <Skeleton className="h-8 w-48 rounded-lg" delay={120} />
            </div>
            <div className={card}>
              <div className="divide-y divide-zinc-100 p-4 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 pt-3 first:pt-0">
                    <Skeleton className="size-8 shrink-0 rounded-lg" delay={i * 40} />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-36 rounded" delay={i * 40 + 20} />
                        <Skeleton className="h-3 w-24 rounded" delay={i * 40 + 40} />
                      </div>
                      <Skeleton className="h-3 w-3/4 rounded" delay={i * 40 + 60} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Esqueleto de la ficha de cliente (misma arquitectura que la pestaña Datos). */
export function ClientDetailSkeleton({
  section = "datos",
}: {
  section?: "datos" | "contactos" | "historial";
}) {
  const cardHead = (delay: number, width = "w-28") => (
    <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded" delay={delay} />
        <Skeleton className={`h-3 ${width} rounded`} delay={delay + 20} />
      </div>
      <Skeleton className="h-3 w-14 rounded" delay={delay + 40} />
    </div>
  );
  const rows = (count: number, delay: number) => (
    <div className="divide-y divide-zinc-100 px-4 py-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-2.5">
          <Skeleton className="h-3 w-20 rounded" delay={delay + i * 40} />
          <Skeleton className="h-3 w-32 rounded" delay={delay + i * 40 + 20} />
        </div>
      ))}
    </div>
  );
  const card = "overflow-hidden rounded-card border border-line bg-white shadow-card";
  const listPanel = (
    <div className={`${card} mt-3.5`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
        <Skeleton className="h-8 w-[260px] rounded-lg" delay={80} />
        <Skeleton className="h-8 w-32 rounded-lg" delay={120} />
      </div>
      <TableSkeleton rows={8} columns={7} />
      <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2.5">
        <Skeleton className="h-3 w-24 rounded" delay={200} />
        <Skeleton className="h-8 w-48 rounded-lg" delay={220} />
      </div>
    </div>
  );

  return (
    <div
      role="status"
      aria-label="Cargando cliente"
      className="flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-apple-tab select-none"
    >
      <div className="mb-3 flex h-14 shrink-0 items-center justify-between gap-x-4 border-b border-zinc-200/80 -mx-3 px-3 lg:-mx-4 lg:px-4">
        <div className="flex shrink-0 items-center gap-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200/90 bg-white p-2 shadow-2xs">
            <Skeleton className="h-3.5 w-3.5 rounded" />
          </div>
          <Skeleton className="h-5 w-44 rounded-md" />
          <span aria-hidden className="hidden h-4 w-px bg-zinc-200/90 sm:inline-block" />
          <div className="hidden items-center gap-1.5 md:flex">
            <Skeleton className="h-6 w-14 rounded-md" delay={140} />
            <Skeleton className="h-6 w-16 rounded-md" delay={180} />
          </div>
        </div>
        <Skeleton className="hidden h-8 w-28 rounded-lg sm:block" delay={200} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 pb-8">
        <div className="mx-auto w-full max-w-6xl">
          {section === "datos" ? (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="space-y-2.5 rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-2.5 w-16 rounded" delay={i * 40} />
                      <Skeleton className="size-2 rounded-full" delay={i * 40} />
                    </div>
                    <Skeleton className="h-4 w-24 rounded" delay={i * 40 + 60} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
                <div className="space-y-3.5 lg:col-span-2">
                  <div className={card}>
                    {cardHead(100, "w-40")}
                    {rows(4, 160)}
                  </div>
                  <div className={card}>
                    {cardHead(220, "w-48")}
                    {rows(4, 260)}
                  </div>
                </div>
                <div className="space-y-3.5">
                  <div className={card}>
                    {cardHead(150, "w-28")}
                    {rows(3, 180)}
                  </div>
                  <div className={card}>
                    {cardHead(220, "w-32")}
                    <div className="space-y-2 p-3.5">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full rounded-lg" delay={280 + i * 40} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            listPanel
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Esqueleto de la ficha de tarea (misma arquitectura que ticket: header, métricas, rejilla).
 */
export function TaskDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando tarea"
      className="flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-apple-tab select-none"
    >
      <div className="shrink-0 border-b border-zinc-200/80 -mx-3 lg:-mx-4 px-3 lg:px-4 mb-3 h-14 flex items-center justify-between gap-x-4">
        <div className="flex shrink-0 items-center gap-x-3">
          <div className="h-8 w-8 rounded-lg border border-zinc-200/90 bg-white shadow-2xs flex items-center justify-center p-2">
            <Skeleton className="h-3.5 w-3.5 rounded" />
          </div>

          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-full" delay={60} />
            <Skeleton className="h-5 w-16 rounded-full" delay={120} />
          </div>

          <span aria-hidden className="hidden h-4 w-px bg-zinc-200/90 sm:inline-block" />

          <div className="hidden md:flex items-center gap-1.5">
            <Skeleton className="h-6 w-14 rounded-md" delay={140} />
            <Skeleton className="h-6 w-24 rounded-md" delay={180} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" delay={100} />
          <Skeleton className="h-8 w-28 rounded-lg" delay={160} />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="pt-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 max-w-full lg:max-w-2xl">
                <Skeleton className="h-6 w-80 max-w-full rounded-md" delay={80} />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-52 rounded-md" delay={120} />
              </div>
            </div>
          </div>

          <div className="mt-3.5 space-y-3.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-2.5 w-14 rounded" delay={i * 40} />
                    <Skeleton className="size-2 rounded-full" delay={i * 40} />
                  </div>
                  <Skeleton className="h-4 w-20 rounded" delay={i * 40 + 60} />
                  <Skeleton className="h-2 w-28 rounded" delay={i * 40 + 100} />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
              <div className="lg:col-span-2 space-y-3.5">
                <div className="rounded-card border border-zinc-200/80 bg-white p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-4 rounded" delay={100} />
                      <Skeleton className="h-3 w-36 rounded" delay={120} />
                    </div>
                    <Skeleton className="h-6 w-24 rounded-md" delay={140} />
                  </div>
                  <div className="space-y-0 divide-y divide-zinc-100">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between py-2.5">
                        <Skeleton className="h-3 w-24 rounded" delay={160 + i * 35} />
                        <Skeleton className="h-3 w-32 rounded" delay={180 + i * 35} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-card border border-zinc-200/80 bg-white p-4 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
                    <Skeleton className="size-4 rounded" delay={200} />
                    <Skeleton className="h-3 w-28 rounded" delay={220} />
                  </div>
                  <div className="space-y-2 pt-1">
                    <Skeleton className="h-3 w-full" delay={240} />
                    <Skeleton className="h-3 w-[94%]" delay={270} />
                    <Skeleton className="h-3 w-[82%]" delay={300} />
                    <Skeleton className="h-3 w-[88%]" delay={330} />
                  </div>
                </div>
              </div>

              <div className="space-y-3.5">
                <div className="rounded-card border border-zinc-200/80 bg-white p-4 shadow-2xs space-y-3.5">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                    <Skeleton className="h-3 w-32 rounded" delay={150} />
                    <Skeleton className="size-3.5 rounded" delay={170} />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full rounded" delay={190} />
                    <Skeleton className="h-4 w-[88%] rounded" delay={220} />
                    <Skeleton className="h-4 w-[92%] rounded" delay={250} />
                  </div>
                </div>

                <div className="rounded-card border border-zinc-200/80 bg-white p-4 shadow-2xs space-y-3">
                  <div className="border-b border-zinc-100 pb-2">
                    <Skeleton className="h-3 w-28 rounded" delay={260} />
                  </div>
                  <div className="space-y-2.5">
                    <Skeleton className="h-7 w-full rounded-lg" delay={300} />
                    <Skeleton className="h-7 w-full rounded-lg" delay={340} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Esqueleto para la pestaña de tareas de un ticket.
 */
export function TicketTasksSkeleton() {
  return (
    <div role="status" aria-label="Cargando tareas" className="space-y-2.5 animate-plf-apple-tab">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-card border border-zinc-200/80 bg-white p-3.5 shadow-2xs"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Skeleton className="size-4 shrink-0 rounded" delay={i * 40} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-[50%] rounded" delay={i * 40 + 40} />
              <div className="flex items-center gap-2">
                <Skeleton className="h-2.5 w-24 rounded" delay={i * 40 + 80} />
                <Skeleton className="h-2.5 w-16 rounded" delay={i * 40 + 100} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-5 w-20 rounded-full" delay={i * 40 + 60} />
            <Skeleton className="size-6 rounded-md" delay={i * 40 + 80} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Esqueleto para la pestaña de formularios asociados a un ticket.
 */
export function TicketFormsSkeleton() {
  return (
    <div role="status" aria-label="Cargando formularios" className="space-y-4 animate-plf-apple-tab">
      {/* Tira de sub-pestañas de formularios */}
      <div className="flex items-center gap-2 border-b border-zinc-200/80 pb-2">
        <Skeleton className="h-8 w-44 rounded-lg" delay={40} />
        <Skeleton className="h-8 w-36 rounded-lg" delay={80} />
        <Skeleton className="h-8 w-40 rounded-lg" delay={120} />
      </div>

      {/* Cabecera del formulario activo con código, título y botones de acción */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20 rounded" delay={100} />
            <Skeleton className="h-5 w-44 rounded" delay={140} />
            <Skeleton className="h-5 w-16 rounded-full" delay={180} />
          </div>
          <Skeleton className="h-2.5 w-64 rounded" delay={200} />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-36 rounded-lg" delay={160} />
          <Skeleton className="h-8 w-28 rounded-lg" delay={200} />
          <Skeleton className="h-8 w-24 rounded-lg" delay={240} />
        </div>
      </div>

      {/* 4 Métricas rápidas del formulario */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 space-y-2">
            <Skeleton className="h-2.5 w-20 rounded" delay={i * 40 + 100} />
            <Skeleton className="h-4 w-28 rounded" delay={i * 40 + 140} />
            <Skeleton className="h-2 w-32 rounded" delay={i * 40 + 180} />
          </div>
        ))}
      </div>

      {/* Tarjeta de detalles del formulario */}
      <div className="rounded-card border border-zinc-200/80 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <Skeleton className="h-3.5 w-40 rounded" delay={220} />
          <Skeleton className="h-3 w-24 rounded" delay={250} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2 w-20 rounded" delay={i * 40 + 260} />
              <Skeleton className="h-3.5 w-32 rounded" delay={i * 40 + 300} />
            </div>
          ))}
        </div>
        <div className="pt-2 space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" delay={340} />
          <Skeleton className="h-12 w-full rounded-lg" delay={380} />
        </div>
      </div>
    </div>
  );
}

/**
 * Esqueleto para la tabla del plan de acción de calidad (HCA).
 */
export function ActionPlanTableSkeleton() {
  return (
    <div role="status" aria-label="Cargando plan de acción" className="divide-y divide-zinc-100 animate-plf-apple-tab">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 gap-4">
          <div className="w-[44%] space-y-1.5">
            <Skeleton className="h-3.5 w-[85%] rounded" delay={i * 50} />
            <Skeleton className="h-2.5 w-[60%] rounded" delay={i * 50 + 40} />
          </div>
          <Skeleton className="h-3 w-28 rounded flex-1" delay={i * 50 + 60} />
          <Skeleton className="h-3 w-24 rounded flex-1" delay={i * 50 + 80} />
          <Skeleton className="h-5 w-20 rounded-full" delay={i * 50 + 100} />
        </div>
      ))}
    </div>
  );
}
