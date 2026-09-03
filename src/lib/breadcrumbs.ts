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
      for (const child of module.children) {
        patterns.push({
          path: child.to,
          build: () => [{ label: module.label, to: module.to }, { label: child.label }],
        });
      }
    } else {
      patterns.push({ path: module.to, build: () => [{ label: module.label }] });
    }
  }

  return patterns;
}

/** Fichas de un registro concreto: no tienen entrada en el Sidebar porque la
 *  ruta lleva un id, asi que se registran a mano, una vez, aqui. */
const detailPatterns: BreadcrumbPattern[] = [
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
    path: "/clientes/:id/historial",
    build: (name, { id }) => [
      { label: "Clientes", to: "/clientes" },
      { label: name ?? "Cliente", to: `/clientes/${id}` },
      { label: "Historial" },
    ],
  },
];

// Las de ficha primero: son mas especificas (mas segmentos) y esa
// especificidad es lo unico que importa, matchPath ya exige coincidencia
// exacta de segmentos por patron.
const ALL_PATTERNS: BreadcrumbPattern[] = [...detailPatterns, ...patternsFromSidebar()];

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
