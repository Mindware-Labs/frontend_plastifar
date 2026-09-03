// Contrato anticipado del modulo de Permisos efectivos. Todavia no existe en el
// backend: cuando GET /api/permissions y GET /api/staff/{id}/department-access
// esten escritos, esto pasa a types/api.ts como espejo de los DTOs reales.

/** Clave estable del catalogo, con la convencion modulo.accion. */
export type PermissionKey = string;

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
  /** Rol de administrador: concede todo el catalogo y no se edita. */
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
}

/** Un permiso y los departamentos donde esa persona lo ejerce. */
export interface EffectivePermission {
  permission: Permission;
  module: string;
  /** Vacio cuando alcanza a todos los departamentos (administrador). */
  departments: string[];
  scope: "todos" | "departamentos";
}
