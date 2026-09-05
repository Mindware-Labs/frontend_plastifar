/**
 * Los DOS unicos radios del Dashboard.
 *
 * El panel entero corre a 2px (`rounded-edge`); esta superficie es la excepcion
 * documentada de tarjetas. La excepcion es UN lenguaje, no barra libre: antes
 * convivian cinco radios (`rounded-2xl`, `rounded-[14px]`, `xl`, `lg`, `md`),
 * cuatro de ellos defaults de Tailwind sin nombre en el sistema.
 *
 * Quedan dos pasos: la tarjeta (16px) y lo que va dentro de ella (8px), ambos
 * declarados como `--radius-card` y `--radius-inset` en el bloque @theme.
 */
export const CARD_RADIUS = "rounded-card";
export const INSET_RADIUS = "rounded-inset";
