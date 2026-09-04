import { useId, type ReactNode } from "react";
import { Select, type SelectOption } from "./Select";

interface CriteriaFieldProps {
  label: string;
  /**
   * Id del control que hay dentro, para asociar la etiqueta. Cuando el control
   * ya trae su propio nombre accesible (SearchInput y Select llevan aria-label),
   * se omite y la etiqueta queda como rotulo visual.
   */
  htmlFor?: string;
  children: ReactNode;
}

/**
 * Rotulo de un control de la fila de criterios. Una fila que mezcla busqueda,
 * desplegables y fechas necesita que cada control diga que acota: «2026-08-01»
 * sin etiqueta encima no significa nada.
 */
export function CriteriaField({ label, htmlFor, children }: CriteriaFieldProps) {
  const generated = useId();
  const labelId = `${generated}-label`;

  const text = "font-heading text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint";

  return (
    <div className="flex flex-col gap-1.5">
      {htmlFor ? (
        <label id={labelId} htmlFor={htmlFor} className={text}>
          {label}
        </label>
      ) : (
        <span aria-hidden className={text}>
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

interface CriteriaSelectProps {
  label: string;
  /** Nombre accesible del control; la etiqueta visible se queda como rotulo. */
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Ancho fijo: los selectores de una fila de criterios no se estiran. */
  width?: string;
}

/** Desplegable de la fila de criterios, ya rotulado. */
export function CriteriaSelect({
  label,
  ariaLabel,
  value,
  onChange,
  options,
  width = "w-[180px]",
}: CriteriaSelectProps) {
  return (
    <CriteriaField label={label}>
      <Select
        size="sm"
        className={width}
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        options={options}
      />
    </CriteriaField>
  );
}
