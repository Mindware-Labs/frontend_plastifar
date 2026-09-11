import type { ReactNode } from "react";

interface ModuleHeaderProps {
  /** Titulo de la pagina (Bandeja, Personal…). La navegacion vive en el sidebar. */
  title: string;
  /** Badge opcional junto al titulo (p. ej. contador o tag). */
  badge?: ReactNode;
  /** Resumen en linea con el titulo, no debajo: gana altura para el contenido. */
  summary?: ReactNode;
  /** Accion principal o grupo de acciones de la pagina. */
  action?: ReactNode;
  className?: string;
}

export function ModuleHeader({ title, badge, summary, action, className = "" }: ModuleHeaderProps) {
  return (
    <div className={`mb-3.5 flex min-h-9 flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 py-3.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-[20px] font-bold leading-none tracking-[-0.02em] text-zinc-900">
            {title}
          </h1>
          {badge}
        </div>
        {summary && (
          <>
            <span aria-hidden className="hidden h-4 w-px bg-zinc-200/90 sm:inline-block" />
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-zinc-500">{summary}</div>
          </>
        )}
      </div>

      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
