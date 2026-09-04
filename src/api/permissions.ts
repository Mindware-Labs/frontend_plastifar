import { apiRequest } from "./client";
import type { PermissionMatrixResponse } from "../types/permissions";

export const permissionsApi = {
  /** Catalogo, roles y lo que concede cada uno, en una sola peticion (seccion 6.5). */
  matrix: () => apiRequest<PermissionMatrixResponse>("/api/permissions/matrix"),
};
