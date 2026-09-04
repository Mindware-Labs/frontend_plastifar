import { forwardRef, type InputHTMLAttributes } from "react";

interface ControlInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** sm = 32 px, para la fila de criterios; md = 40 px, para un formulario. */
  size?: "sm" | "md";
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
 */
export const ControlInput = forwardRef<HTMLInputElement, ControlInputProps>(function ControlInput(
  { size = "sm", className = "", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`rounded-edge border border-line-strong bg-white text-ink outline-none
        transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-brand-red
        focus:ring-3 focus:ring-brand-red/10
        ${size === "sm" ? "h-8 px-2.5 text-[12.5px]" : "h-10 px-3 text-[13px]"} ${className}`}
      {...props}
    />
  );
});
