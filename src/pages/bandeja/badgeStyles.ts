/**
 * El badge de shadcn viene en gris neutro; el codigo de ticket es la marca del
 * modulo y se pinta con el rojo 185 C al 8 %, igual que el modulo activo del
 * sidebar. Vive aparte para que la lista y el panel de lectura no se importen
 * entre si solo por una clase.
 */
export const ticketBadgeClass =
  "border-brand-red/15 bg-brand-red/8 font-heading text-[10px] font-semibold " +
  "uppercase tracking-[0.06em] text-brand-red-dark";
