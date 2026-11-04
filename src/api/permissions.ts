import { apiRequest } from "./client";
import type {
  PermissionGroup,
  PermissionMatrixResponse,
  SavePermissionMatrixRequest,
} from "../types/permissions";

export const permissionsApi = {
  /** Catálogo agrupado por módulo para pintar la matriz y las fichas. */
  catalog: () => apiRequest<PermissionGroup[]>("/api/permissions"),

  /** Catalogo, roles y lo que concede cada uno, en una sola peticion (seccion 6.5). */
  matrix: () => apiRequest<PermissionMatrixResponse>("/api/permissions/matrix"),

  /**
   * Guarda la matriz entera de una vez. Es atomico en el servidor: un rol que
   * falla anula el guardado completo, asi que no existe el estado intermedio
   * «unos roles si y otros no». Devuelve 204.
   */
  save: (data: SavePermissionMatrixRequest) =>
    apiRequest<void>("/api/permissions/matrix", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
