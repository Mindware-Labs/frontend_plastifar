// Vocabulario grafico compartido por los tres charts. Existe para que los ejes
// y la rejilla no se re-tipeen en cada archivo: DESIGN.md fija ticks en `faint`
// a 10.5px y rejilla en `line`, y tres copias a mano ya se habian desviado.

/** Ticks de eje: `faint` es el piso de contraste, nada mas claro lleva texto. */
export const AXIS_TICK = { fontSize: 10.5, fill: "var(--color-faint)" } as const;

/** Rejilla estructural: el mismo filete que el resto del panel. */
export const GRID_STROKE = "var(--color-line)";

/**
 * Blanco de separacion entre segmentos del donut: es el mismo blanco del
 * `bg-white` de la tarjeta, escrito aqui porque un atributo SVG `stroke` no
 * acepta una clase de Tailwind.
 */
export const CARD_WHITE = "#ffffff";
