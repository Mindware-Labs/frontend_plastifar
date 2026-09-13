// Permiso efectivo en el cliente. El token ya viaja con los accesos por
// departamento y sus permisos (claim `dept_access`), asi que no hace falta
// consultar nada para decidir que se muestra.
//
// Esto NO es una barrera de seguridad: solo evita ofrecer acciones que el
// servidor va a rechazar. La autorizacion real la valida el backend en cada
// endpoint, y esta capa existe para que la persona no descubra que no puede
// hacer algo despues de haber llenado un formulario.

import { ancestorsOf, descendantsOf } from "./departments";

/** Convencion del catalogo: modulo.accion. */
export type PermissionKey = string;

/** Una entrada del claim `dept_access` que emite TokenService. */
export interface DepartmentAccessClaim {
  deptId: number;
  roleId: number;
  permissions: PermissionKey[];
}

/**
 * Supervision: amplia la lectura a todos los departamentos sin conceder
 * escritura. Es la unica excepcion al alcance departamental.
 */
const READ_ALL = "tickets.read_all";
const WIDENED_BY_READ_ALL = "tickets.read";

/** El claim viaja como texto JSON; un token viejo o roto no debe tumbar la app. */
export function parseDepartmentAccess(raw: string | undefined): DepartmentAccessClaim[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry): entry is DepartmentAccessClaim =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as DepartmentAccessClaim).deptId === "number" &&
        Array.isArray((entry as DepartmentAccessClaim).permissions),
    );
  } catch {
    return [];
  }
}

export interface PermissionHolder {
  isAdmin: boolean;
  departmentAccess: DepartmentAccessClaim[];
}

/**
 * Decide si esta persona puede hacer algo, opcionalmente dentro de un
 * departamento concreto.
 *
 * Un permiso concede la accion solo sobre los recursos de los departamentos
 * donde tiene el rol que lo otorga: sin `departmentId` la respuesta es «puede
 * en algun lado», que es lo que sirve para decidir si se pinta un boton de
 * listado; con `departmentId` es «puede aqui», que es lo que hay que preguntar
 * antes de ofrecer una accion sobre una fila concreta.
 */
export function can(
  holder: PermissionHolder | null,
  permission: PermissionKey,
  departmentId?: number,
): boolean {
  if (!holder) return false;
  if (holder.isAdmin) return true;

  /*
   * El alcance baja por el arbol: quien tiene rol en «VENTAS INTERNACIONALES»
   * lo ejerce tambien sobre «VENTAS INTERNACIONALES / Florida». Por eso no se
   * compara contra un solo id sino contra la cadena del departamento y todos
   * los que lo contienen.
   *
   * Sin jerarquia registrada la cadena es un solo elemento, y esto se comporta
   * exactamente como la comparacion por igualdad de antes.
   */
  const alcance = departmentId === undefined ? null : ancestorsOf(departmentId);

  return holder.departmentAccess.some((access) => {
    if (alcance !== null && !alcance.includes(access.deptId)) {
      // La lectura ampliada de tickets alcanza departamentos donde no hay rol.
      return permission === WIDENED_BY_READ_ALL && grants(access, READ_ALL);
    }
    return grants(access, permission);
  });
}

function grants(access: DepartmentAccessClaim, permission: PermissionKey) {
  if (access.permissions.includes(permission)) return true;
  return permission === WIDENED_BY_READ_ALL && access.permissions.includes(READ_ALL);
}

/** Departamentos donde ejerce este permiso. Vacio si no lo tiene en ninguno. */
export function departmentsWith(
  holder: PermissionHolder | null,
  permission: PermissionKey,
): number[] {
  if (!holder) return [];

  /* Cada acceso arrastra su descendencia: quien tiene el rol en «VENTAS
     INTERNACIONALES» lo ejerce tambien en Florida y en Cuba, asi que el filtro
     que se arme con esta lista tiene que incluirlas. Sin jerarquia registrada,
     `descendantsOf` devuelve un solo id y esto no cambia nada. */
  const alcance = new Set<number>();
  for (const access of holder.departmentAccess) {
    if (!grants(access, permission)) continue;
    for (const id of descendantsOf(access.deptId)) alcance.add(id);
  }

  return [...alcance];
}

/**
 * Union de todo lo que puede hacer, sin alcance. Para un administrador devuelve
 * vacio: no tiene una lista, tiene todo el catalogo, y una lista incompleta se
 * leeria como si le faltara algo.
 */
export function effectivePermissions(holder: PermissionHolder | null): PermissionKey[] {
  if (!holder || holder.isAdmin) return [];
  return [...new Set(holder.departmentAccess.flatMap((access) => access.permissions))];
}
