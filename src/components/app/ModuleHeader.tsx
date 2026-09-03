import type { ReactNode } from "react";

interface ModuleHeaderProps {
  /** Titulo de la pagina (Bandeja, Personal…). La navegacion vive en el sidebar. */
  title: string;
  /** Resumen en linea con el titulo, no debajo: gana altura para el contenido. */
  summary?: ReactNode;
  /** Accion principal de la pagina. */
  action?: ReactNode;
}

export function ModuleHeader({ title, summary, action }: ModuleHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-heading text-[20px] font-bold tracking-[-0.02em] text-ink">{title}</h1>
        {summary && (
          <>
            <span aria-hidden className="h-3.5 w-px self-center bg-line" />
            <p className="text-[12.5px] text-subtle">{summary}</p>
          </>
        )}
      </div>

      {action}
    </div>
  );
}
