import type { ReactNode } from "react";

interface SummaryFieldProps {
  label: ReactNode;
  /** Clases del valor despues de `mt-0.5`. */
  valueClassName?: string;
  children: ReactNode;
}

/** Un dato de la rejilla de resumen de un formulario del ticket. */
export function SummaryField({ label, valueClassName = "font-medium text-zinc-800", children }: SummaryFieldProps) {
  return (
    <div>
      <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">{label}</dt>
      <dd className={`mt-0.5 ${valueClassName}`}>{children}</dd>
    </div>
  );
}
