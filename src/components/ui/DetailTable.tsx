import type { ReactNode } from "react";

/**
 * Tabla de ficha: los datos de un solo registro, en pares etiqueta/valor.
 *
 * Es una tabla de verdad —no una rejilla de `div`— porque eso es lo que es: el
 * lector de pantalla anuncia la etiqueta como cabecera de su fila y el usuario
 * puede saltar de dato en dato en vez de oir catorce lineas seguidas sin saber
 * cual es cual.
 *
 * Las fichas venian como una tirada plana de once o catorce filas iguales: la
 * identidad del cliente, su clasificacion comercial, sus datos de contacto y
 * sus notas internas se leian todos con el mismo peso y el mismo espaciado, asi
 * que encontrar uno obligaba a recorrerlos todos. `DetailGroup` recupera esa
 * jerarquia: cada bloque dice de que trata antes de soltar sus datos.
 */
export function DetailTable({ children }: { children: ReactNode }) {
  return (
    /*
     * La ficha vive en un panel: superficie blanca con radio y sombra sobre el
     * lienzo tintado, igual que un listado.
     *
     * Los grupos NO se parten en una tarjeta cada uno, aunque la referencia
     * tenga esa forma. Esto es una <table> de verdad a proposito —el lector de
     * pantalla anuncia la etiqueta como cabecera de su fila y se puede saltar
     * de dato en dato— y trocearla en <div> para que cada bloque tenga su caja
     * cambiaria accesibilidad real por estetica. Los grupos se separan con
     * filete dentro del mismo panel, que es la misma jerarquia sin pagar ese
     * precio.
     */
    <div className="overflow-x-auto rounded-card border border-line bg-white px-5 shadow-card">
      {/* El aire va antes de cada titulo de grupo, salvo el primero: es lo que
          separa un bloque del anterior. El modificador no puede vivir en el
          propio `th` —ahi `first:` siempre acierta, porque el `th` es el unico
          hijo de su fila— asi que se ancla al primer `tbody` de la tabla. */}
      <table
        className="w-full border-collapse text-left
          [&>tbody:first-child>tr:first-child>th]:pt-6"
      >
        {children}
      </table>
    </div>
  );
}

interface DetailGroupProps {
  /** De que trata el bloque. Se anuncia como cabecera del grupo de filas. */
  title: string;
  /** Una linea que aclare el bloque cuando el titulo no basta. */
  hint?: ReactNode;
  children: ReactNode;
}

/**
 * Un bloque de la ficha. Cada uno es su propio `tbody`: agrupa las filas para
 * la tecnologia asistiva igual que las agrupa a la vista.
 */
export function DetailGroup({ title, hint, children }: DetailGroupProps) {
  return (
    <tbody className="border-b border-line last:border-0 last:[&>tr:last-child>*]:pb-6">
      <tr>
        <th
          scope="colgroup"
          colSpan={2}
          className="pt-7 pb-2.5 text-left align-bottom"
        >
          <span className="font-heading text-[11px] font-semibold uppercase tracking-[0.06em] text-ink">
            {title}
          </span>
          {hint && <span className="ml-2.5 text-[12px] font-normal text-faint">{hint}</span>}
        </th>
      </tr>
      {children}
    </tbody>
  );
}

interface DetailRowProps {
  label: string;
  /**
   * Campos de prosa —que ocurrio, causa raiz, notas—. En dos columnas el texto
   * arrancaba a 220px del margen y se partia en una franja estrecha; asi ocupa
   * el ancho de la ficha con su etiqueta encima.
   */
  wide?: boolean;
  children: ReactNode;
}

export function DetailRow({ label, wide = false, children }: DetailRowProps) {
  if (wide) {
    return (
      <tr className="border-t border-line-soft">
        <td colSpan={2} className="py-3">
          <p className="font-heading text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint">
            {label}
          </p>
          <div className="mt-1.5 max-w-[86ch] text-[13px] leading-relaxed text-brand-gray">
            {children}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-line-soft transition-colors hover:bg-fill">
      <th
        scope="row"
        className="w-[220px] py-3 pr-3.5 text-left align-top font-heading text-[10.5px]
          font-medium uppercase tracking-[0.06em] text-faint"
      >
        {label}
      </th>
      <td className="py-3 align-top text-[13px] text-brand-gray">{children}</td>
    </tr>
  );
}
