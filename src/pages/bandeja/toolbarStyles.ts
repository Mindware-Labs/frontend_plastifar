/** Boton de icono de la barra del visor: gris de texto en reposo, tinta sobre relleno al pasar. */
export const iconButtonClass =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-edge text-brand-gray outline-none " +
  "transition-colors hover:bg-fill hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/20 " +
  "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

/** Etiquetas de los editores: mismo ancho para que los valores queden en una sola columna. */
export const fieldLabelClass =
  "w-12 shrink-0 font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-faint";

/** Filete que separa los grupos de la barra: mismo trazo y mismo aire en todos. */
export const dividerClass = "mx-0.5 h-4 w-px shrink-0 bg-line";
