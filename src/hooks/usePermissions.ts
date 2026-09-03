import { useMemo } from "react";
import { useAuth } from "../context/useAuth";
import {
  can as canWith,
  departmentsWith as departmentsWithFor,
  effectivePermissions,
  type PermissionKey,
} from "../lib/permissions";

/**
 * Puerta de permisos de la interfaz. Toda pantalla que ofrezca una accion
 * pregunta aqui antes de pintarla, en vez de mirar `isAdmin`: el administrador
 * es un caso del permiso efectivo, no el criterio.
 *
 * Ocultar el boton no protege nada por si solo; el endpoint tiene que rechazar
 * igual. Lo que evita es que alguien llene un formulario para encontrarse un 403.
 */
export function usePermissions() {
  const { user } = useAuth();

  return useMemo(
    () => ({
      isAdmin: Boolean(user?.isAdmin),

      /** «Puede en algun departamento», o «puede en este» si se pasa el id. */
      can: (permission: PermissionKey, departmentId?: number) =>
        canWith(user, permission, departmentId),

      /** Departamentos donde ejerce el permiso; para acotar listados y selectores. */
      departmentsWith: (permission: PermissionKey) => departmentsWithFor(user, permission),

      /** Union de sus permisos. Vacia en un administrador: tiene el catalogo entero. */
      permissions: effectivePermissions(user),
    }),
    [user],
  );
}
