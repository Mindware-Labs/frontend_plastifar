import type { ReactNode } from "react";

interface SummaryNoteProps {
  label: ReactNode;
  children: ReactNode;
}

/** Texto libre del formulario (descripcion, hecho) bajo su etiqueta. */
export function SummaryNote({ label, children }: SummaryNoteProps) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 text-xs">
      <span className="font-heading text-[10px] font-bold uppercase text-zinc-400">{label}</span>
      <p className="mt-1 text-zinc-700 whitespace-pre-wrap">{children}</p>
    </div>
  );
}
