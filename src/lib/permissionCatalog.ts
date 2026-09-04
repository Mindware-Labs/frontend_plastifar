import type { Permission, PermissionGroup } from "../types/permissions";

/** Aplana el catalogo agrupado a una lista de permisos con su modulo. */
export function flattenPermissions(source: PermissionGroup[]): { module: string; permission: Permission }[] {
  return source.flatMap((group) => group.permissions.map((permission) => ({ module: group.module, permission })));
}
