import { ArrowLeft } from "lucide-react";
import { Skeleton } from "../ui/Skeleton";

interface PrintSheetSkeletonProps {
  orientation?: "portrait" | "landscape";
  backLabel?: string;
}

/**
 * Skeleton oficial de la vista de impresión con la animación shimmer de iluminación
 * característica de la aplicación Plastifar (.plf-skeleton).
 */
export function PrintSheetSkeleton({
  orientation = "portrait",
  backLabel = "Volver",
}: PrintSheetSkeletonProps) {
  const isLandscape = orientation === "landscape";
  const sheetWidthClass = isLandscape ? "max-w-[1056px]" : "max-w-[820px]";

  return (
    <div
      data-print-sheet-root="true"
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden font-sans text-zinc-900 bg-zinc-100/70 animate-plf-fade"
    >
      {/* Topbar ejecutiva en estado Skeleton */}
      <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-zinc-200/90 bg-white/95 px-4 sm:px-6 backdrop-blur-md shadow-2xs">
        {/* Lado izquierdo: Botón volver + Título skeleton */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="inline-flex h-8.5 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-faint shadow-2xs">
            <ArrowLeft className="size-3.5 text-zinc-300" />
            <span>{backLabel}</span>
          </div>

          <div aria-hidden className="hidden sm:block h-4 w-px bg-zinc-200 shrink-0" />

          <div className="flex items-center gap-2.5 min-w-0">
            <Skeleton className="h-5 w-44 rounded-md" delay={0} />
            <Skeleton className="hidden sm:inline-block h-5 w-24 rounded-full" delay={40} />
          </div>
        </div>

        {/* Lado derecho: Botones de acciones con efecto de iluminación */}
        <div className="flex shrink-0 items-center gap-2 pl-3">
          <Skeleton className="h-8.5 w-24 rounded-lg" delay={60} />
          <Skeleton className="h-8.5 w-28 rounded-lg" delay={100} />
          <Skeleton className="h-8.5 w-22 rounded-lg" delay={140} />
        </div>
      </header>

      {/* Espacio del lienzo de papel con la hoja física skeleton */}
      <main className="flex-1 min-h-0 overflow-auto py-8 sm:py-10 px-4 sm:px-6 bg-zinc-100/70">
        <div
          className={`mx-auto bg-white rounded-lg p-6 sm:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_4px_rgba(0,0,0,0.04)] ring-1 ring-zinc-900/[0.05] ${sheetWidthClass}`}
        >
          {/* Cabecera del formulario oficial */}
          <div className="border-b-2 border-brand-red/30 pb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-8 rounded-md" delay={80} />
              <Skeleton className="h-4.5 w-24 rounded" delay={100} />
            </div>

            <div className="flex flex-col items-center gap-1.5 flex-1 max-w-xs">
              <Skeleton className="h-2 w-36 rounded" delay={110} />
              <Skeleton className="h-4.5 w-56 rounded" delay={130} />
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <Skeleton className="h-2.5 w-36 rounded" delay={120} />
              <Skeleton className="h-2.5 w-28 rounded" delay={140} />
            </div>
          </div>

          {/* Bloque I: Información General */}
          <div className="mt-4">
            <div className="bg-brand-red/10 border border-brand-red/20 px-2 py-1 rounded-t flex items-center">
              <Skeleton className="h-3 w-36 rounded bg-brand-red/20" delay={150} />
            </div>
            <div className="grid grid-cols-3 border-x border-b border-zinc-200">
              <div className="p-2.5 border-r border-b border-zinc-200">
                <Skeleton className="h-2 w-14 rounded mb-1.5" delay={160} />
                <Skeleton className="h-3.5 w-28 rounded" delay={180} />
              </div>
              <div className="p-2.5 border-r border-b border-zinc-200">
                <Skeleton className="h-2 w-14 rounded mb-1.5" delay={190} />
                <Skeleton className="h-3.5 w-24 rounded" delay={210} />
              </div>
              <div className="p-2.5 border-b border-zinc-200">
                <Skeleton className="h-2 w-12 rounded mb-1.5" delay={220} />
                <Skeleton className="h-3.5 w-20 rounded" delay={240} />
              </div>
              <div className="p-2.5 col-span-3">
                <Skeleton className="h-2 w-16 rounded mb-1.5" delay={250} />
                <Skeleton className="h-3.5 w-56 rounded" delay={270} />
              </div>
            </div>
          </div>

          {/* Bloque II: Información de la reclamación / caso */}
          <div className="mt-4">
            <div className="bg-brand-red/10 border border-brand-red/20 px-2 py-1 rounded-t flex items-center">
              <Skeleton className="h-3 w-56 rounded bg-brand-red/20" delay={280} />
            </div>
            <div className="grid grid-cols-2 border-x border-b border-zinc-200">
              <div className="p-3 border-r border-zinc-200">
                <Skeleton className="h-2.5 w-28 rounded mb-2" delay={290} />
                <div className="flex gap-2">
                  <Skeleton className="size-3.5 rounded" delay={310} />
                  <Skeleton className="h-3 w-28 rounded" delay={320} />
                </div>
              </div>
              <div className="p-3">
                <Skeleton className="h-2.5 w-32 rounded mb-2" delay={300} />
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="size-3.5 rounded" delay={320} />
                    <Skeleton className="h-3 w-20 rounded" delay={330} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="size-3.5 rounded" delay={340} />
                    <Skeleton className="h-3 w-24 rounded" delay={350} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de ítems con shimmer diagonal */}
          <div className="mt-4 border border-zinc-200 rounded overflow-hidden">
            <div className="bg-zinc-100/90 p-2.5 border-b border-zinc-200 flex justify-between gap-4">
              <Skeleton className="h-2.5 w-24 rounded" delay={360} />
              <Skeleton className="h-2.5 w-20 rounded" delay={380} />
              <Skeleton className="h-2.5 w-16 rounded" delay={400} />
              <Skeleton className="h-2.5 w-16 rounded" delay={420} />
              <Skeleton className="h-2.5 w-16 rounded" delay={440} />
            </div>
            {[1, 2, 3].map((row) => (
              <div key={row} className="p-2.5 border-b border-zinc-100 flex justify-between gap-4">
                <Skeleton className="h-3 w-36 rounded" delay={row * 50 + 400} />
                <Skeleton className="h-3 w-16 rounded" delay={row * 50 + 430} />
                <Skeleton className="h-3 w-12 rounded" delay={row * 50 + 460} />
                <Skeleton className="h-3 w-16 rounded" delay={row * 50 + 490} />
                <Skeleton className="h-3 w-16 rounded" delay={row * 50 + 520} />
              </div>
            ))}
          </div>

          {/* Bloque III: Descripción / Detalle */}
          <div className="mt-4">
            <div className="bg-brand-red/10 border border-brand-red/20 px-2 py-1 rounded-t flex items-center">
              <Skeleton className="h-3 w-44 rounded bg-brand-red/20" delay={530} />
            </div>
            <div className="p-3 border-x border-b border-zinc-200 space-y-2">
              <Skeleton className="h-3 w-full rounded" delay={550} />
              <Skeleton className="h-3 w-[88%] rounded" delay={570} />
              <Skeleton className="h-3 w-[65%] rounded" delay={590} />
            </div>
          </div>

          {/* Footer de firmas */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="border border-zinc-200 rounded p-2.5">
                <Skeleton className="h-2 w-24 rounded mb-2" delay={600 + idx * 40} />
                <Skeleton className="h-3.5 w-32 rounded" delay={620 + idx * 40} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
