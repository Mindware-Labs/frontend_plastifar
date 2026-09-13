// Sistema unico de breadcrumb: vive en el App Shell (TopBar), nunca dentro de
// una vista. Las rutas estaticas salen de SIDEBAR_NAV (el mismo arbol que
// pinta el Sidebar, no una copia); las rutas de ficha (con :id) se registran
// aparte porque no tienen entrada propia en el menu.
import { matchPath } from "react-router-dom";
import { SIDEBAR_NAV } from "./navigation";

export interface Crumb {
  label: string;
  /** Ausente en el ultimo crumb: la ruta actual no es un enlace a si misma. */
  to?: string;
}

interface BreadcrumbPattern {
  path: string;
  /** `dynamicLabel` es lo que la pagina de ficha haya publicado con
   *  useDynamicBreadcrumb (el nombre ya cargado), o null antes de eso.
   *  `params` son los de la propia ruta (p.ej. `id`), para poder enlazar de
   *  vuelta a la ficha desde un segmento intermedio como "Accesos". */
  build: (dynamicLabel: string | null, params: Record<string, string | undefined>) => Crumb[];
}

/** Una entrada por cada hoja del Sidebar: modulo (enlace) + la hoja misma. */
function patternsFromSidebar(): BreadcrumbPattern[] {
  const patterns: BreadcrumbPattern[] = [];

  for (const module of SIDEBAR_NAV) {
    if (module.children && module.children.length > 0) {
      /* El modulo solo es enlace si tiene ruta propia o si su primer hijo la
         hereda: un crumb que no lleva a ningun lado es un enlace roto con
         aspecto de enlace. */
      const moduleTo = module.to ?? module.children[0].to;
      for (const child of module.children) {
        /* «Tickets › Bandeja» cuando ambos apuntan al mismo sitio no es una
           jerarquia, es la misma palabra dos veces: se deja solo el modulo. */
        const collapse = module.children.length === 1 && child.to === moduleTo;
        patterns.push({
          path: child.to,
          build: () =>
            collapse
              ? [{ label: module.label }]
              : [{ label: module.label, to: moduleTo }, { label: child.label }],
        });
      }
    } else if (module.to) {
      const to = module.to;
      patterns.push({ path: to, build: () => [{ label: module.label }] });
    }
  }

  return patterns;
}

/** Fichas de un registro concreto: no tienen entrada en el Sidebar porque la
 *  ruta lleva un id, asi que se registran a mano, una vez, aqui. */
const detailPatterns: BreadcrumbPattern[] = [
  {
    path: "/tickets/:id",
    build: (subject) => [
      { label: "Tickets", to: "/tickets" },
      { label: subject ?? "Ticket" },
    ],
  },
  {
    path: "/staff/:id",
    build: (name) => [
      { label: "Personal", to: "/staff" },
      { label: "Colaboradores", to: "/staff" },
      { label: name ?? "Colaborador" },
    ],
  },
  {
    path: "/staff/:id/accesos",
    build: (name, { id }) => [
      { label: "Personal", to: "/staff" },
      { label: "Colaboradores", to: "/staff" },
      { label: name ?? "Colaborador", to: `/staff/${id}` },
      { label: "Accesos" },
    ],
  },
  {
    path: "/clientes/:id",
    build: (name) => [{ label: "Clientes", to: "/clientes" }, { label: name ?? "Cliente" }],
  },
  {
    path: "/clientes/:id/contactos",
    build: (name, { id }) => [
      { label: "Clientes", to: "/clientes" },
      { label: name ?? "Cliente", to: `/clientes/${id}` },
      { label: "Contactos" },
    ],
  },
  {
    path: "/calidad/hca/:id",
    build: (number) => [
      { label: "Calidad", to: "/calidad/hca" },
      { label: "HCA", to: "/calidad/hca" },
      { label: number ?? "Hoja de corrección" },
    ],
  },
  {
    path: "/calidad/hca/:id/plan",
    build: (number, { id }) => [
      { label: "Calidad", to: "/calidad/hca" },
      { label: "HCA", to: "/calidad/hca" },
      { label: number ?? "Hoja de corrección", to: `/calidad/hca/${id}` },
      { label: "Plan de acción" },
    ],
  },
  {
    path: "/calidad/hca/:id/cierre",
    build: (number, { id }) => [
      { label: "Calidad", to: "/calidad/hca" },
      { label: "HCA", to: "/calidad/hca" },
      { label: number ?? "Hoja de corrección", to: `/calidad/hca/${id}` },
      { label: "Cierre" },
    ],
  },
  {
    path: "/clientes/:id/historial",
    build: (name, { id }) => [
      { label: "Clientes", to: "/clientes" },
      { label: name ?? "Cliente", to: `/clientes/${id}` },
      { label: "Historial" },
    ],
  },
];

/**
 * Ordenados por especificidad, no por el orden en que se escribieron.
 *
 * Antes las de ficha iban primero, con el argumento de que tienen mas
 * segmentos. Eso es cierto para «/clientes/:id/contactos» y falso para
 * «/clientes/:id», que tiene exactamente los mismos que «/clientes/territorios»
 * — y al ir antes, capturaba la palabra «territorios» como si fuera el
 * identificador de un cliente. El breadcrumb de Territorios decia «Clientes ›
 * Cliente», y el fallo solo aparecio cuando esa ruta existio.
 *
 * El criterio correcto es el que usa el propio enrutador: primero el que tiene
 * mas segmentos y, entre iguales, el que tiene menos parametros. Una ruta
 * escrita entera siempre gana a una que adivina.
 */
function segmentos(path: string): number {
  return path.split("/").filter(Boolean).length;
}

function parametros(path: string): number {
  return path.split("/").filter((s) => s.startsWith(":")).length;
}

const ALL_PATTERNS: BreadcrumbPattern[] = [...detailPatterns, ...patternsFromSidebar()].sort(
  (a, b) =>
    segmentos(b.path) - segmentos(a.path) || parametros(a.path) - parametros(b.path),
);

/**
 * Resuelve la ruta actual a su rastro de breadcrumb. `dynamicLabel` es el
 * nombre que la propia pagina de ficha publico (via useDynamicBreadcrumb)
 * para su ultimo segmento; null antes de que ese dato cargue.
 */
export function resolveBreadcrumb(pathname: string, dynamicLabel: string | null): Crumb[] {
  for (const pattern of ALL_PATTERNS) {
    const match = matchPath({ path: pattern.path, end: true }, pathname);
    if (match) return pattern.build(dynamicLabel, match.params);
  }
  return [];
}
