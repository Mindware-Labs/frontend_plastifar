/**
 * Tokens del tablero de operación.
 *
 * Única fuente de color, tipografía y espaciado del feature. Ningún componente
 * escribe un hex ni un tamaño suelto — tampoco los SVG.
 *
 * ==================================================================
 * REFERENCIA: CENTER QUEST (`public/image.png`)
 * ==================================================================
 * Esta pantalla ejecuta ese sistema, sin ironía y sin agregarle un giro propio.
 * Lo que lo hace verse como se ve son cuatro decisiones, y ninguna es un truco:
 *
 * 1. LIENZO TINTADO, SUPERFICIE BLANCA. El fondo de página es un gris muy
 *    claro y las tarjetas son blanco puro. Esa diferencia mínima —tres pasos de
 *    valor— es lo que hace que la tarjeta flote sin necesitar una sombra
 *    pesada. Sobre blanco no había nada que separar; sobre este gris, sí.
 *
 * 2. PANEL HUNDIDO. Dentro de una tarjeta, el contenido medible vive en una
 *    segunda superficie MÁS CALLADA que la tarjeta: apenas tintada, con su
 *    propio filete y su propio radio. Que sea más callada es lo que la hace
 *    leer como un hueco y no como una caja apilada encima. Blanco sobre blanco
 *    sería ruido; tintado sobre blanco es profundidad.
 *
 * 3. RADIO GENEROSO Y CONSISTENTE. Tres pasos, nada cuadrado.
 *
 * 4. FILETE DE BAJÍSIMO CONTRASTE. La separación la hace una línea muy tenue
 *    más una sombra suave, nunca un borde fuerte.
 *
 * ==================================================================
 * EL COLOR SIGUE VIVIENDO EN EL DATO
 * ==================================================================
 * Barras, líneas, segmentos, filetes de acento y puntos de leyenda llevan
 * color. La superficie sobre la que se lee, no. Un panel no se tinta «para
 * destacarlo»: para eso están la jerarquía tipográfica y el espacio.
 *
 * Los valores de rol están medidos contra blanco y los tres que no llegaban se
 * corrigieron en su momento — se conservan tal cual:
 *
 *   porVencer #B87514 → #996111   3,75 → 5,16 sobre blanco
 *   espera    #0E7C8A → #0E7886   4,39 → 4,63 sobre su tinte
 *   soft      #767E8D → #6E7583   4,09 → 4,63 sobre blanco
 */

/* -------------------------------------------------------------------------- */
/*  Roles                                                                      */
/* -------------------------------------------------------------------------- */

export type Role = "vencido" | "porVencer" | "abierto" | "espera" | "hca" | "cumplido";

export interface Hue {
  /** Un solo valor: sirve para relleno y para texto. */
  color: string;
  /** Lavado del tono. Fondo del círculo de icono y de la ficha de alarma. */
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
  /** El lienzo. Sobre esto flotan las tarjetas. */
  page: "#F3F5F7",
  /** La superficie de trabajo. */
  card: "#FFFFFF",
  /**
   * El panel hundido: la segunda superficie dentro de una tarjeta. Más callada
   * que la tarjeta, nunca más brillante — es un hueco, no una caja encima.
   */
  inset: "#F8FAFB",

  /** Títulos y cifras. Grafito, no negro puro. 15,8:1 sobre blanco. */
  ink: "#23232B",
  /** Etiquetas y texto de tabla. 7,49:1 */
  body: "#4E5563",
  /**
   * Subtítulos, pies y metadatos.
   *
   * 4,95:1 sobre blanco y **4,73:1 sobre el panel hundido**, que es el número
   * que manda. El valor anterior (#6E7583) se había medido solo contra blanco
   * —4,63— y ahí pasaba; pero este gris vive también dentro de `inset`, que es
   * un paso más oscuro, y ahí caía a 4,42. Un token se valida contra la
   * superficie MÁS oscura sobre la que se lo usa, no contra la más clara.
   */
  soft: "#6A7080",

  /** Borde de tarjeta contra el lienzo. */
  hair: "#E9ECF1",
  /** Filete interno: entre filas, borde del panel hundido, rejilla de gráficas. */
  hair2: "#F1F4F8",
  /** Borde de tarjeta al pasar el mouse. */
  hairHover: "#D6DCE5",

  rail: "#E7EAF0",
  chip: "#F0F2F5",
  hover: "#F7F9FB",

  /** NO ES TEXTO. Marcas de eje sin peso. */
  faintMark: "#B6BDC9",

  /** Barra en reposo de una serie temporal. El azul de serie, lavado. */
  barRest: "#AEC0E8",
} as const;

/* -------------------------------------------------------------------------- */
/*  Tipografía                                                                 */
/*                                                                             */
/*  Una sola familia, de trabajo. Geist tiene cifras tabulares sólidas y        */
/*  versalitas que aguantan tracking abierto, que es exactamente lo que pide    */
/*  un tablero: la referencia apoya toda su jerarquía en una versalita          */
/*  diminuta y muy trackeada sobre una cifra grande.                            */
/* -------------------------------------------------------------------------- */

export const FONT =
  "'Geist Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/**
 * La cara de los titulos.
 *
 * Onest: humanista, de formas abiertas y terminales suaves. Contrasta con la
 * cara de cuerpo por temperatura —mas redonda, mayor altura de x— y no por
 * rareza, que es la diferencia entre suave y rustico. Va en lo que se lee UNA
 * vez por pantalla, nunca en la celda que se lee mil veces.
 */
export const FONT_HEADING =
  "'Onest Variable', 'Geist Variable', ui-sans-serif, system-ui, sans-serif";

export const T = {
  pageTitle: {
    fontSize: 19,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    fontFamily: FONT_HEADING,
  },
  cardTitle: {
    fontSize: 15.5,
    fontWeight: 550,
    letterSpacing: "-0.012em",
    lineHeight: 1.3,
    fontFamily: FONT_HEADING,
  },
  /** Subtítulo: qué se está viendo y qué se puede hacer con ello. */
  cardHint: { fontSize: 11.5, fontWeight: 400, lineHeight: 1.5 },
  figure: { fontSize: 19, fontWeight: 550, letterSpacing: "-0.02em", lineHeight: 1 },
  figureXl: { fontSize: 24, fontWeight: 550, letterSpacing: "-0.025em", lineHeight: 1 },
  label: { fontSize: 12, fontWeight: 500, lineHeight: 1.3 },
  caption: { fontSize: 11, fontWeight: 400, lineHeight: 1.4 },
  /**
   * La versalita micro.
   *
   * El rótulo de un KPI y el título de un panel hundido. Diminuta, en
   * mayúsculas y muy trackeada: es el gesto tipográfico que sostiene la
   * jerarquía de la referencia entera, y funciona porque contrasta con una
   * cifra grande justo debajo. Fuera de ese par no se usa.
   */
  micro: {
    /* 10 px es el piso legible que declara el sistema (`DESIGN.md`, regla de la
       versalita) y aqui estaba en 9.5. Medio pixel no compra jerarquia —la
       compran la caja alta, el tracking y la cifra de 24 px justo debajo— y en
       cambio metia el rotulo de los cinco KPI por debajo del minimo. */
    fontSize: 10,
    fontWeight: 550,
    letterSpacing: "0.06em",
    lineHeight: 1.2,
    textTransform: "uppercase" as const,
  },
} as const;

/** Tamaños para SVG, donde `fontSize` es atributo y no hereda de `T`. */
export const SVG_TEXT = { axis: 10, legend: 10.5, figure: 22 } as const;

/** Las cifras que se comparan entre sí tienen que alinearse. */
export const NUM = { fontVariantNumeric: "tabular-nums" } as const;

/* -------------------------------------------------------------------------- */
/*  Formato                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Formato numérico dominicano.
 *
 * `es-DO` produce `17,363` y `4.2`: coma para miles y punto para decimales,
 * que es la convención de República Dominicana. NO es la de España, donde se
 * escribe al revés.
 *
 * Se aclara porque el comentario anterior decía justamente lo contrario —
 * «miles con punto y decimales con coma»— y describía una salida que esta
 * función nunca produjo. Cualquier cifra escrita a mano en el feature tiene que
 * seguir a esta función, no al comentario viejo.
 */
export function n(value: number, decimals = 0): string {
  return value.toLocaleString("es-DO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/* -------------------------------------------------------------------------- */
/*  Espaciado y forma — múltiplos de 4                                         */
/* -------------------------------------------------------------------------- */

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const CARD_PAD = "16px 18px";

/** Tres pasos de radio. Nada cuadrado, nada exagerado. */
export const R = { card: 16, inset: 12, control: 10 } as const;

/** Compatibilidad con los componentes que ya leían un radio único. */
export const CARD_RADIUS = R.card;

/**
 * Alto de las graficas.
 *
 * Subio porque el aire lo tenian las cabeceras, no los datos: la banda de
 * cifras de «Tickets entrados» ocupaba cuarenta pixeles para decir dos numeros
 * y dejaba las barras en una franja donde no se distinguia una de otra. Lo que
 * hay que poder comparar es la forma de la serie, no leer el total dos veces.
 */
export const CHART_H = { main: 304, side: 248 } as const;
