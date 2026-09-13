import type { ReactNode } from "react";

/**
 * Un bloque de campos con nombre dentro de un formulario largo.
 *
 * ==================================================================
 * POR QUÉ EXISTE
 * ==================================================================
 * La ficha de un cliente se LEE en cuatro bloques —identificación,
 * clasificación comercial, contacto y uso interno— porque diez pares
 * seguidos con el mismo peso obligan a recorrerlos todos para encontrar
 * uno. Ese mismo argumento vale mientras se ESCRIBEN.
 *
 * Y sin embargo el modal que crea esa ficha soltaba los diez campos
 * planos. Crear y ver hablaban idiomas distintos sobre el mismo objeto:
 * la persona agrupaba mentalmente al leer y volvía a empezar al editar.
 * Aquí la agrupación es la misma, con los mismos nombres, para que el
 * formulario se parezca a lo que va a producir.
 *
 * ==================================================================
 * UN FILETE, NO UNA CAJA
 * ==================================================================
 * El grupo se separa con un filete y su rótulo, nunca con un recuadro
 * ni un fondo tintado: dentro de un diálogo que ya es una superficie
 * flotante, meter cuatro cajas más convierte la jerarquía en ruido.
 * El primero no lleva filete —no separa de nada— y por eso el
 * modificador vive en `first:`.
 */
export function FormSection({
  title,
  hint,
  children,
}: {
  /** De qué trata el bloque. Mismo nombre que en la ficha que produce. */
  title: string;
  /** Una línea cuando el título no basta. */
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-line-soft pt-4 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <h3 className="font-heading text-[10px] font-semibold uppercase tracking-[0.07em] text-faint">
          {title}
        </h3>
        {hint && <span className="text-[11.5px] text-faint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
