/**
 * Tokens del tablero de operación.
 *
 * Única fuente de color, tipografía y espaciado del feature. Ningún componente
 * escribe un hex ni un tamaño suelto — tampoco los SVG.
 *
 * ------------------------------------------------------------------
 * EL COLOR VIVE DENTRO DE LAS GRÁFICAS, NUNCA EN EL CROMO
 * ------------------------------------------------------------------
 * Barras, líneas, segmentos y puntos de leyenda llevan color. El borde y el
 * fondo de una tarjeta se quedan neutros siempre.
 *
 * La versión anterior ponía un filete de 4 px de color arriba de cada tarjeta,
 * y eso era decoración disfrazada de dato: «Cumplimiento de plazo» pintaba su
 * filete de rojo con un 92 % de cumplimiento, o sea alarmaba sobre una cifra
 * buena. Si el color no codifica nada, no es información.
 *
 * Única excepción: la celda de «Fuera de plazo» lleva fondo tintado y su cifra
 * en rojo, porque ahí el color sí dice algo.
 *
 * ------------------------------------------------------------------
 * UN SOLO VALOR POR ROL
 * ------------------------------------------------------------------
 * La paleta anterior era de primarios puros y necesitaba dos columnas —una
 * para relleno y otra para texto— porque el naranja y el verde puros no se
 * leían sobre blanco. Desaturada, cada rol vive con un valor solo.
 *
 * TRES valores de la tabla propuesta no llegaban y se corrigieron:
 *
 *   porVencer #B87514 → #996111   3,75 → 5,16 sobre blanco
 *   espera    #0E7C8A → #0E7886   4,39 → 4,63 sobre su tinte
 *   soft      #767E8D → #6E7583   4,09 → 4,63 sobre blanco
 *
 * El ámbar era el peor: 3,75:1 no llega ni al piso de 3:1 de texto grande. Y
 * `soft` es el gris de los subtítulos de tarjeta y los pies, o sea el que más
 * texto lleva en la pantalla.
 */

/* -------------------------------------------------------------------------- */
/*  Roles                                                                      */
/* -------------------------------------------------------------------------- */

export type Role = "vencido" | "porVencer" | "abierto" | "espera" | "hca" | "cumplido";

export interface Hue {
  /** Un solo valor: sirve para relleno y para texto. */
  color: string;
  /** Fondo tintado. Sólo lo usa «Fuera de plazo». */
  tint: string;
}

const HUES: Record<Role, Hue> = {
  vencido: { color: "#D4002A", tint: "#FDEEF1" },
  porVencer: { color: "#996111", tint: "#FAF2E5" },
  abierto: { color: "#2F5FD0", tint: "#ECF1FC" },
  espera: { color: "#0E7886", tint: "#E9F4F6" },
  hca: { color: "#6247B5", tint: "#F0EDF9" },
  cumplido: { color: "#0F7A56", tint: "#EAF4F0" },
};

/**
 * El mapeo rol → tono, en un solo sitio. Función y no constante repetida: si
 * mañana cambia el violeta de HCA se edita una línea, no once componentes.
 */
export function hueFor(role: Role): Hue {
  return HUES[role];
}

/**
 * Paleta de serie para distribuciones.
 *
 * Canal y tema son CATEGORÍAS, no estados: sólo hace falta distinguir. Deja el
 * rojo afuera, que sigue siendo exclusivo de vencido e incumplimiento.
 */
export const SERIES = [
  HUES.abierto.color,
  HUES.cumplido.color,
  HUES.porVencer.color,
  HUES.espera.color,
  HUES.hca.color,
] as const;

/** Tonos de avatar. Rampa propia: una persona no es un estado. */
export const AVATAR = ["#3D4557", "#2F5FD0", "#0E7886", "#6247B5", "#6E7583"] as const;

/* -------------------------------------------------------------------------- */
/*  Neutros                                                                    */
/* -------------------------------------------------------------------------- */

export const C = {
  page: "#FFFFFF",
  card: "#FFFFFF",

  /** Títulos y cifras. 18,08:1 */
  ink: "#14161C",
  /** Etiquetas y texto de tabla. 7,49:1 */
  body: "#4E5563",
  /** Subtítulos, pies y metadatos. 4,63:1 — el piso. */
  soft: "#6E7583",

  /** Borde de tarjeta y división entre celdas. */
  hair: "#E6E9EE",
  /** Filete interno: entre filas y en la rejilla de las gráficas. */
  hair2: "#F0F2F5",
  /** Borde de tarjeta al pasar el mouse. */
  hairHover: "#D8DCE4",

  rail: "#E6E9EE",
  chip: "#F0F2F5",
  hover: "#F8F9FB",

  /** NO ES TEXTO. Trazo de sparkline y marcas de eje sin peso. */
  faintMark: "#B6BDC9",

  /** Barra en reposo de una serie temporal. */
  barRest: "#D7DEEC",
} as const;

/* -------------------------------------------------------------------------- */
/*  Tipografía                                                                 */
/*                                                                             */
/*  Los pesos bajaron: casi todo vivía en 800 y eso solo se lee infantil.      */
/*  El tracking negativo se queda — es lo que sostiene una cifra grande.       */
/* -------------------------------------------------------------------------- */

export const FONT =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const T = {
  pageTitle: { fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 },
  cardTitle: { fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.3 },
  /** Subtítulo: qué se está viendo y qué se puede hacer con ello. */
  cardHint: { fontSize: 11.5, fontWeight: 400, lineHeight: 1.5 },
  figure: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1 },
  figureXl: { fontSize: 30, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1 },
  /** Etiqueta de KPI y de fila. Formato oración, nunca versalita. */
  label: { fontSize: 12, fontWeight: 500, lineHeight: 1.3 },
  caption: { fontSize: 11, fontWeight: 400, lineHeight: 1.4 },
} as const;

/** Tamaños para SVG, donde `fontSize` es atributo y no hereda de `T`. */
export const SVG_TEXT = { axis: 10, legend: 10.5, figure: 22 } as const;

/** Las cifras que se comparan entre sí tienen que alinearse. */
export const NUM = { fontVariantNumeric: "tabular-nums" } as const;

/* -------------------------------------------------------------------------- */
/*  Formato                                                                    */
/* -------------------------------------------------------------------------- */

/** Miles con punto y decimales con coma, que es como se escribe en español. */
export function n(value: number, decimals = 0): string {
  return value.toLocaleString("es-DO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/* -------------------------------------------------------------------------- */
/*  Espaciado — múltiplos de 4                                                 */
/* -------------------------------------------------------------------------- */

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const CARD_PAD = "14px 16px";
export const CARD_RADIUS = 10;
export const CHART_H = { main: 220, side: 170 } as const;
