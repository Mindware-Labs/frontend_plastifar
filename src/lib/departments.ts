/**
 * Lo MÍNIMO que hace falta para ordenar un árbol: un identificador, un nombre y
 * un padre. No se pide `DepartmentResponse` entero porque media aplicación pasa
 * versiones recortadas del departamento —el modal de buzones, por ejemplo,
 * recibe sólo `{ id, name }`— y exigir campos que estas funciones no leen las
 * volvería inservibles justo donde hacen falta.
 */
export interface DepartmentLike {
  id: number;
  name: string;
  parentId?: number | null;
}

/**
 * El árbol de departamentos, y cómo se lee en una lista.
 *
 * ==================================================================
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ==================================================================
 * El panel modelaba cuatro departamentos planos. La operación real tiene más de
 * veinticinco, en dos niveles: «VENTAS INTERNACIONALES / Florida»,
 * «PLASTIFAR CENTROAMERICA / Compras», «VENTAS LOCALES / Zona Metropolitana».
 * Un selector que los suelta en orden alfabético pone «Almacen» entre
 * «PLASTIFAR CENTROAMERICA / Producción» y «Produccion», y quien busca su zona
 * no la encuentra porque el nombre del padre está a diez renglones de distancia.
 *
 * ==================================================================
 * TOLERANTE POR DISEÑO
 * ==================================================================
 * Si el servidor todavía no envía `parentId`, todo esto devuelve exactamente la
 * lista que recibió, ordenada por nombre: el panel se comporta como hoy. No hay
 * una versión «vieja» y otra «nueva» que mantener en paralelo, y el frontend
 * deja de ser lo que bloquea el cambio del modelo.
 *
 * ==================================================================
 * LO QUE ESTE ARCHIVO NO DECIDE
 * ==================================================================
 * Aquí se resuelve cómo se ORDENA y cómo se MUESTRA la jerarquía. Qué significa
 * para los permisos —si quien tiene acceso a «VENTAS INTERNACIONALES» ve también
 * lo de «Florida»— es una regla de negocio, no de presentación, y vive donde
 * viven las reglas.
 */

/** Un departamento con su sitio en el árbol ya resuelto. */
export interface DepartmentNode extends DepartmentLike {
  /** 0 para los de primer nivel, 1 para sus hijos, y así. */
  depth: number;
  /** «VENTAS INTERNACIONALES / Florida». El nombre completo, para buscar y rotular. */
  path: string;
}

/** Tope de profundidad: corta un ciclo si los datos vinieran mal formados. */
const MAX_DEPTH = 6;

/**
 * Ordena la lista como se lee un índice: cada padre seguido de sus hijos, y los
 * hermanos alfabéticamente entre sí.
 *
 * Un departamento cuyo padre no esté en la lista —porque está inactivo, o porque
 * el filtro lo dejó fuera— se trata como de primer nivel en vez de desaparecer.
 * Perder una opción del selector es peor que mostrarla sin su sangría.
 */
export function buildDepartmentTree<T extends DepartmentLike>(departments: T[]): (T & DepartmentNode)[] {
  const porId = new Map(departments.map((d) => [d.id, d]));
  const hijos = new Map<number | null, T[]>();

  for (const d of departments) {
    const padre = d.parentId != null && porId.has(d.parentId) ? d.parentId : null;
    const grupo = hijos.get(padre);
    if (grupo) grupo.push(d);
    else hijos.set(padre, [d]);
  }

  for (const grupo of hijos.values()) {
    grupo.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  const salida: (T & DepartmentNode)[] = [];
  const visitados = new Set<number>();

  function recorrer(padre: number | null, depth: number, prefijo: string) {
    if (depth > MAX_DEPTH) return;
    for (const d of hijos.get(padre) ?? []) {
      // Un ciclo en los datos no puede colgar la pantalla.
      if (visitados.has(d.id)) continue;
      visitados.add(d.id);

      const path = prefijo ? `${prefijo} / ${d.name}` : d.name;
      salida.push({ ...d, depth, path });
      recorrer(d.id, depth + 1, path);
    }
  }

  recorrer(null, 0, "");

  /* Si algo quedó fuera por un ciclo, entra igual al final: una opción sin
     sangría sigue siendo una opción; una opción que no está es un bloqueo. */
  for (const d of departments) {
    if (!visitados.has(d.id)) salida.push({ ...d, depth: 0, path: d.name });
  }

  return salida;
}

/**
 * Las opciones de un `Select`, con la jerarquía visible.
 *
 * La sangría se hace con espacios finos (U+2009) y no con guiones ni puntos: un
 * `<option>` nativo colapsa los espacios normales, así que la alternativa
 * habitual es rellenar con «—» y eso mete un carácter que nadie escribió en un
 * nombre propio. El espacio fino sobrevive al colapso y no dice nada.
 */
export function departmentOptions(
  departments: DepartmentLike[],
): { value: string; label: string }[] {
  return buildDepartmentTree(departments).map((d) => ({
    value: String(d.id),
    label: "    ".repeat(d.depth) + d.name,
  }));
}

/**
 * El nombre completo de un departamento, con sus padres.
 *
 * En una tabla, «Florida» a secas no dice nada: hay zonas con nombre repetible
 * entre países. El camino entero lo desambigua.
 */
export function departmentPath(
  departments: DepartmentLike[],
  id: number | null | undefined,
): string | null {
  if (id == null) return null;
  return buildDepartmentTree(departments).find((d) => d.id === id)?.path ?? null;
}

/**
 * Un departamento y toda su descendencia.
 *
 * Es la pieza que necesita un filtro para que «VENTAS INTERNACIONALES» traiga
 * también lo de Florida y lo de Cuba. Se deja resuelta aquí, pero quién la usa
 * —y si los permisos se heredan igual— lo decide la regla de negocio.
 */
export function departmentWithDescendants(
  departments: DepartmentLike[],
  id: number,
): number[] {
  const hijosDe = new Map<number, number[]>();
  for (const d of departments) {
    if (d.parentId == null) continue;
    const grupo = hijosDe.get(d.parentId);
    if (grupo) grupo.push(d.id);
    else hijosDe.set(d.parentId, [d.id]);
  }

  const salida: number[] = [];
  const pendientes = [id];
  const vistos = new Set<number>();

  while (pendientes.length > 0) {
    const actual = pendientes.pop() as number;
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    salida.push(actual);
    pendientes.push(...(hijosDe.get(actual) ?? []));
  }

  return salida;
}
