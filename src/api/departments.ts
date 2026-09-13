import { apiRequest } from "./client";
import { setDepartmentHierarchy } from "../lib/departments";
import type { DepartmentResponse } from "../types/api";

export const departmentsApi = {
  /**
   * Trae los departamentos y, de paso, registra la forma del arbol.
   *
   * El registro va AQUI y no en cada pantalla a proposito. `can()` necesita
   * saber que departamento cuelga de cual para resolver un permiso heredado, y
   * si eso dependiera de que cada vista se acuerde de avisar, los permisos
   * serian correctos en unas pantallas y no en otras — que es peor que no
   * heredar en ninguna, porque el fallo no se ve.
   */
  list: async () => {
    const departments = await apiRequest<DepartmentResponse[]>("/api/departments");
    setDepartmentHierarchy(departments);
    return departments;
  },
};
