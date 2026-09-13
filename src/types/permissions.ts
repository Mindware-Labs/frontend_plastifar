// Espejo de api/Dtos/PermissionDtos.cs en el backend. GET /api/permissions/matrix
// y GET /api/staff/{id}/department-access devuelven exactamente estas formas.

/**
 * Clave estable del catalogo, con la convencion modulo.accion.
 *
 * ==================================================================
 * ES UNA UNION, NO `string`
 * ==================================================================
 * Era `string`, y eso convertia cada permiso en una cadena que nadie revisaba:
 * `can("setting.write")` —sin la ese— compila, no avisa y simplemente no
 * concede nunca. El sintoma es un boton que no aparece, que es exactamente lo
 * que se espera ver cuando alguien no tiene el permiso. Un fallo asi no se
 * distingue del funcionamiento correcto ni mirandolo.
 *
 * REGLA ESPEJO (seccion 4.2): esta lista es la misma que
 * `api/Security/PermissionCatalog.cs`. Si agregas un permiso alli, agregalo
 * aqui; si no, el frontend no podra nombrarlo y el compilador lo dira.
 *
 * Que el servidor mande la matriz como texto no lo debilita: esa respuesta se
 * castea sin validar de todos modos, asi que la union no promete nada sobre el
 * dato recibido. Lo que si hace es revisar cada literal que escribimos nosotros,
 * que es donde de verdad se cuelan las erratas.
 */
export type PermissionKey =
  | "staff.read"
  | "staff.write"
  | "roles.read"
  | "roles.write"
  | "clients.read"
  | "clients.write"
  | "tickets.read"
  | "tickets.write"
  | "tickets.assign"
  | "tickets.close"
  | "tickets.read_all"
  | "quality.read"
  | "quality.write"
  | "quality.approve"
  | "reports.read"
  | "settings.write";

export interface Permission {
  key: PermissionKey;
  /** Nombre legible en espanol; lo redacta el servidor, no el frontend. */
  label: string;
  /** Una linea sobre que habilita, para la fila de la matriz. */
  hint: string;
  /**
   * Permiso de lectura del que este depende. Conceder escritura sin lectura deja
   * un rol que puede crear cosas y no puede verlas.
   */
  requires?: PermissionKey;
}

export interface PermissionGroup {
  /** Modulo al que pertenecen: Personal, Clientes, Tickets… */
  module: string;
  permissions: Permission[];
}

export interface RoleSummary {
  id: number;
  name: string;
  isSystem: boolean;
  isActive: boolean;
  /**
   * El rol concede el catalogo completo de verdad (lo calcula el servidor a
   * partir de su lista de permisos). No confundir con `isSystem`: eso dice que
   * el rol no se edita, no que lo conceda todo.
   */
  grantsAll: boolean;
  /** Cuanta gente lo tiene asignado hoy; se muestra bajo la cabecera. */
  assignedStaff: number;
}

/** Estado completo de la matriz: que roles conceden que permisos. */
export interface PermissionMatrixResponse {
  groups: PermissionGroup[];
  roles: RoleSummary[];
  /** Por id de rol, las claves que concede. */
  grants: Record<number, PermissionKey[]>;
}

/** Concesiones de un rol tal como viajan en el guardado de la matriz. */
export interface RolePermissionsInput {
  roleId: number;
  permissions: PermissionKey[];
}

/**
 * Cuerpo de POST /api/permissions/matrix. El servidor aplica los roles en una
 * sola transaccion: o entran todos o no entra ninguno.
 */
export interface SavePermissionMatrixRequest {
  roles: RolePermissionsInput[];
}

export interface DepartmentAccess {
  departmentId: number;
  departmentName: string;
  roleId: number;
  roleName: string;
  /** Departamento principal del colaborador. Solo uno puede serlo. */
  isPrimary: boolean;
  grantedAt: string;
  grantedByName: string | null;
}

export interface StaffDetail {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneExt: string | null;
  isAdmin: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  accesses: DepartmentAccess[];
  /**
   * Verdadero cuando es el ultimo administrador activo: el sistema no puede
   * quedarse sin ninguno, asi que degradarlo o desactivarlo se bloquea.
   */
  isLastAdmin: boolean;
  /** Lo que esta persona puede hacer hoy, resuelto por el servidor (RF-P4). */
  effectivePermissions: EffectivePermission[];
}

/** Un permiso y los departamentos donde esa persona lo ejerce. */
export interface EffectivePermission {
  permission: Permission;
  module: string;
  /** Vacio cuando alcanza a todos los departamentos (administrador). */
  departments: string[];
  scope: "todos" | "departamentos";
}
