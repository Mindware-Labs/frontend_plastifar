/**
 * Formato de numero del tablero, en un solo sitio.
 *
 * Estaba escrito como `toLocaleString("es-DO")` en cada componente y un
 * `Math.round(x * 100) + "%"` a mano en cada leyenda. Dos problemas: el
 * porcentaje casero no usa la coma decimal dominicana, y cada `Intl` creado
 * dentro de un render se reconstruye en cada pintada. Aca se crean una vez.
 */

const integer = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 0 });

const percent = new Intl.NumberFormat("es-DO", {
  style: "percent",
  maximumFractionDigits: 0,
});

const percentDecimal = new Intl.NumberFormat("es-DO", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const decimal = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 1 });

export function formatInteger(value: number) {
  return integer.format(value);
}

/** Recibe la FRACCION (0,32), no el porcentaje ya multiplicado. */
export function formatPercent(fraction: number) {
  return percent.format(fraction);
}

/** Un decimal, para la variacion mes contra mes. */
export function formatPercentDecimal(fraction: number) {
  return percentDecimal.format(fraction);
}

export function formatDecimal(value: number) {
  return decimal.format(value);
}
