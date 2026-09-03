/**
 * Datos de prueba del modulo de Permisos efectivos.
 *
 * Este archivo existe solo mientras el backend no expone el modulo. Cada funcion
 * imita la forma y la latencia del endpoint que la va a sustituir, para que las
 * pantallas se escriban una sola vez: al llegar el API se cambia el import de
 * `permissionsMock` por el cliente real y nada mas.
 */
import type {
  DepartmentAccess,
  EffectivePermission,
  Permission,
  PermissionGroup,
  PermissionKey,
  PermissionMatrixResponse,
  RoleSummary,
  StaffDetail,
} from "../types/permissions";

/** Catalogo inicial de la seccion 6.2 del plan de construccion. */
const groups: PermissionGroup[] = [
  {
    module: "Personal",
    permissions: [
      { key: "staff.read", label: "Ver el personal", hint: "Consultar el listado de colaboradores y sus fichas" },
      {
        key: "staff.write",
        label: "Crear y editar personal",
        hint: "Dar de alta, editar y desactivar colaboradores",
        requires: "staff.read",
      },
      { key: "roles.read", label: "Ver los roles", hint: "Consultar los roles y sus permisos" },
      {
        key: "roles.write",
        label: "Crear y editar roles",
        hint: "Definir roles y cambiar los permisos que conceden",
        requires: "roles.read",
      },
    ],
  },
  {
    module: "Clientes",
    permissions: [
      { key: "clients.read", label: "Ver clientes y contactos", hint: "Consultar el listado de clientes y sus fichas" },
      {
        key: "clients.write",
        label: "Crear y editar clientes",
        hint: "Alta, edición y desactivación de clientes y contactos",
        requires: "clients.read",
      },
    ],
  },
  {
    module: "Tickets",
    permissions: [
      { key: "tickets.read", label: "Ver los tickets de sus departamentos", hint: "Entrar a la bandeja de sus colas" },
      {
        key: "tickets.write",
        label: "Crear tickets y responder",
        hint: "Abrir tickets, responder al cliente y dejar notas internas",
        requires: "tickets.read",
      },
      {
        key: "tickets.assign",
        label: "Asignar o reasignar",
        hint: "Cambiar la persona responsable de un ticket",
        requires: "tickets.read",
      },
      {
        key: "tickets.close",
        label: "Cerrar, cancelar o reabrir",
        hint: "Mover el ticket a un estado final y volver a abrirlo",
        requires: "tickets.read",
      },
      {
        key: "tickets.read_all",
        label: "Ver los tickets de todos los departamentos",
        hint: "Supervisión: amplía la lectura sin conceder escritura",
        requires: "tickets.read",
      },
    ],
  },
  {
    module: "Calidad",
    permissions: [
      { key: "quality.read", label: "Ver HCA y solicitudes de crédito", hint: "Consultar hojas de corrección y créditos" },
      {
        key: "quality.write",
        label: "Crear y editar HCA y créditos",
        hint: "Abrir hojas, cargar el plan de acción y solicitar créditos",
        requires: "quality.read",
      },
      {
        key: "quality.approve",
        label: "Aprobar o rechazar créditos",
        hint: "Autorizar una nota de crédito; nunca sobre lo que uno mismo solicitó",
        requires: "quality.read",
      },
    ],
  },
  {
    module: "Reportes",
    permissions: [{ key: "reports.read", label: "Ver los reportes", hint: "Acceder al módulo de reportes y exportar" }],
  },
  {
    module: "Configuración",
    permissions: [
      {
        key: "settings.write",
        label: "Editar catálogos y configuración",
        hint: "Motivos, políticas de SLA, plantillas, líneas de producto y buzones",
      },
    ],
  },
];

const roles: RoleSummary[] = [
  { id: 1, name: "Administrador", isSystem: true, isActive: true, grantsAll: true, assignedStaff: 2 },
  { id: 2, name: "Supervisor de Calidad", isSystem: false, isActive: true, grantsAll: false, assignedStaff: 3 },
  { id: 3, name: "Agente de Soporte", isSystem: false, isActive: true, grantsAll: false, assignedStaff: 11 },
  { id: 4, name: "Almacén", isSystem: false, isActive: true, grantsAll: false, assignedStaff: 6 },
  { id: 5, name: "Coordinador Comercial", isSystem: false, isActive: true, grantsAll: false, assignedStaff: 2 },
  { id: 6, name: "Consulta", isSystem: false, isActive: false, grantsAll: false, assignedStaff: 0 },
];

/**
 * Concesiones de partida. `settings.write` queda sin asignar a proposito: la
 * pastilla «Sin asignar» tiene que tener algo que mostrar el primer dia.
 */
const grants: Record<number, PermissionKey[]> = {
  1: [],
  2: [
    "staff.read",
    "clients.read",
    "tickets.read",
    "tickets.write",
    "tickets.assign",
    "tickets.close",
    "tickets.read_all",
    "quality.read",
    "quality.write",
    "quality.approve",
    "reports.read",
  ],
  3: ["clients.read", "tickets.read", "tickets.write"],
  4: ["tickets.read", "tickets.write", "tickets.close"],
  5: ["clients.read", "clients.write", "tickets.read", "reports.read"],
  6: ["clients.read", "tickets.read"],
};

const accesses: DepartmentAccess[] = [
  {
    departmentId: 1,
    departmentName: "Calidad",
    roleId: 2,
    roleName: "Supervisor de Calidad",
    isPrimary: true,
    grantedAt: "2026-03-14T13:20:00Z",
    grantedByName: "Richard De León",
  },
  {
    departmentId: 2,
    departmentName: "Almacén",
    roleId: 4,
    roleName: "Almacén",
    isPrimary: false,
    grantedAt: "2026-05-02T16:45:00Z",
    grantedByName: "Richard De León",
  },
  {
    departmentId: 3,
    departmentName: "Soporte",
    roleId: 3,
    roleName: "Agente de Soporte",
    isPrimary: false,
    grantedAt: "2026-07-21T11:05:00Z",
    grantedByName: null,
  },
];

const staff: StaffDetail = {
  id: 4,
  firstName: "Yordy",
  lastName: "Acosta",
  email: "yordy.acosta@plastifar.com",
  phoneExt: "214",
  isAdmin: false,
  isActive: true,
  lastLoginAt: "2026-09-02T14:12:00Z",
  accesses,
  isLastAdmin: false,
};

/** Catalogo completo de departamentos, para el desplegable de alta de acceso. */
const departments = [
  { id: 1, name: "Calidad" },
  { id: 2, name: "Almacén" },
  { id: 3, name: "Soporte" },
  { id: 4, name: "Administración" },
];

/** Latencia simulada: sin ella los estados de carga nunca se ven al desarrollar. */
function delay<T>(value: T, ms = 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Aplana el catalogo agrupado a una lista de permisos con su modulo. */
export function flattenPermissions(source: PermissionGroup[]): { module: string; permission: Permission }[] {
  return source.flatMap((group) => group.permissions.map((permission) => ({ module: group.module, permission })));
}

/**
 * Permiso efectivo de una persona: si es administrador, todo el catalogo; si no,
 * la union de los permisos de los roles que tiene por departamento, con los
 * departamentos donde ejerce cada uno.
 */
export function resolveEffectivePermissions(
  source: PermissionGroup[],
  roleGrants: Record<number, PermissionKey[]>,
  staffDetail: StaffDetail,
): EffectivePermission[] {
  const flat = flattenPermissions(source);

  if (staffDetail.isAdmin) {
    return flat.map(({ module, permission }) => ({ permission, module, departments: [], scope: "todos" as const }));
  }

  const reach = new Map<PermissionKey, Set<string>>();
  for (const access of staffDetail.accesses) {
    for (const key of roleGrants[access.roleId] ?? []) {
      const departmentsForKey = reach.get(key) ?? new Set<string>();
      departmentsForKey.add(access.departmentName);
      reach.set(key, departmentsForKey);
    }
  }

  return flat
    .filter(({ permission }) => reach.has(permission.key))
    .map(({ module, permission }) => ({
      permission,
      module,
      // tickets.read_all es la excepcion de supervision: alcanza a todo el
      // sistema aunque se conceda desde un solo departamento.
      departments: permission.key === "tickets.read_all" ? [] : [...(reach.get(permission.key) ?? [])],
      scope: permission.key === "tickets.read_all" ? ("todos" as const) : ("departamentos" as const),
    }));
}

export const permissionsMock = {
  matrix: (): Promise<PermissionMatrixResponse> =>
    delay(clone({ groups, roles, grants })),

  staffDetail: (): Promise<StaffDetail> => delay(clone(staff)),

  departments: () => clone(departments),

  roles: () => clone(roles),

  /** Guardado simulado: solo devuelve el eco tras una espera. */
  saveGrants: (next: Record<number, PermissionKey[]>): Promise<Record<number, PermissionKey[]>> =>
    delay(clone(next), 480),
};
