import type { ReactNode } from "react";

/** Bloque editorial con etiqueta vertical, inspirado en el PF-FOR-109 en papel. */
export function HcaFormBlock({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-[112px_1fr] overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-2xs ${className}`}
    >
      <div className="flex sm:min-h-[88px] items-center justify-center border-b sm:border-b-0 sm:border-r border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5">
        <span className="font-heading text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-600 sm:[writing-mode:vertical-rl] sm:rotate-180">
          {label}
        </span>
      </div>
      <div className="min-w-0 p-3 sm:p-4">{children}</div>
    </div>
  );
}
