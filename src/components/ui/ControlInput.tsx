import { forwardRef, type InputHTMLAttributes } from "react";
import {
  controlBaseUnsized,
  controlSizes,
  stateClasses,
  type ControlSize,
  type FieldState,
} from "./fieldStyles";

interface ControlInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** sm = 32 px, para la fila de criterios; md = 40 px, para un formulario. */
  size?: ControlSize;
  /** Mismo estado explicito que los campos de Field.tsx: reposo, error, correcto. */
  state?: FieldState;
}

/**
 * Input desnudo con la gramatica de control del panel: filete gris, radio de
 * 2 px, foco en rojo 185 C. Sin etiqueta propia — la pone quien lo usa, con
 * CriteriaField en una fila de criterios o con los campos de Field.tsx en un
 * formulario.
 *
 * Existe porque la fila de criterios de Calidad y la barra de rango de Reportes
 * pedian el mismo control y estaban a punto de ser dos copias de la misma
 * cadena de clases.
 *
 * Se apoya en fieldStyles, no en una copia a mano: la version anterior repetia
 * la gramatica y en el camino perdia los estados de error, correcto y
 * deshabilitado, justo los que necesitan un monto o una fecha fuera de rango.
 */
export const ControlInput = forwardRef<HTMLInputElement, ControlInputProps>(function ControlInput(
  { size = "sm", state = "idle", className = "", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={state === "error" || undefined}
      // El ancho lo decide quien lo coloca: la fila de criterios usa medidas
      // fijas por columna, de ahi la base sin w-full.
      className={`${controlBaseUnsized} ${stateClasses[state]} ${controlSizes[size]}
        ${size === "sm" ? "px-2.5" : "px-3"} placeholder:text-faint ${className}`}
      {...props}
    />
  );
});
