import type { ComponentType, ReactNode } from "react";

interface SectionHeadingProps {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  /** Nota o acción a la derecha: "Opcional", "Quitar cliente", "Restaurar". */
  aside?: ReactNode;
  htmlFor?: string;
}

/** Cabecera de sección: sello con el glifo y título en versalitas, como el chip de ticket. */
export function SectionHeading({ icon: Icon, title, aside, htmlFor }: SectionHeadingProps) {
  const content = (
    <>
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
      >
        <Icon className="size-3" strokeWidth={2.25} />
      </span>
      <span className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink">{title}</span>
    </>
  );

  return (
    <div className="flex h-5 items-center justify-between gap-3">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="flex cursor-pointer items-center gap-2">
          {content}
        </label>
      ) : (
        <div className="flex items-center gap-2">{content}</div>
      )}
      {aside && <span className="text-[11px] text-zinc-400">{aside}</span>}
    </div>
  );
}
