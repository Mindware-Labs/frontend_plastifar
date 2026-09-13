import type { ReactNode } from "react";
import { Button } from "./Button";

/**
 * Lo que ve alguien cuando su recorte no devuelve nada.
 *
 * ==================================================================
 * UN VACÍO DIAGNOSTICADO NO ES UN VACÍO RESUELTO
 * ==================================================================
 * Los listados ya decían la frase correcta —«Ningún cliente coincide con este
 * filtro o búsqueda»—, y ahí se quedaban. La frase nombra el problema y deja
 * a la persona con el trabajo: volver arriba, encontrar cuál de los cinco
 * controles lo causó y deshacerlo a mano.
 *
 * La salida es parte del estado vacío, no un extra. Si hay un recorte puesto,
 * aquí está el botón que lo quita.
 *
 * ==================================================================
 * DOS VACÍOS DISTINTOS
 * ==================================================================
 * «Todavía no hay clientes» y «ninguno coincide» se parecen en pantalla y no
 * se parecen en nada: el primero es un catálogo recién montado —no hay nada
 * que deshacer y la salida es crear el primero—, el segundo es un recorte
 * demasiado estrecho. Por eso `onClear` sólo llega cuando hay algo que limpiar,
 * y quien no lo pasa no recibe un botón que no lleva a ninguna parte.
 */
export function EmptyResult({
  message,
  onClear,
  clearLabel = "Limpiar filtros",
  children,
}: {
  /** Qué pasó, en una frase. */
  message: ReactNode;
  /** Quita el recorte. Ausente cuando el vacío no viene de un filtro. */
  onClear?: () => void;
  clearLabel?: string;
  /** Una salida propia del módulo, cuando la hay. */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3.5 px-6 py-14 text-center">
      <p className="max-w-[46ch] text-[13.5px] leading-relaxed text-faint">{message}</p>

      {(onClear || children) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onClear && (
            <Button size="sm" variant="secondary" onClick={onClear}>
              {clearLabel}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
