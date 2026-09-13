import { apiRequest, toQuery } from "./client";
import { setDepartmentHierarchy } from "../lib/departments";
import type { DepartmentResponse, SaveDepartmentRequest } from "../types/api";

export const departmentsApi = {
  /**
   * Trae los departamentos y, de paso, registra la forma del arbol.
   *
   * El registro va AQUI y no en cada pantalla a proposito. `can()` necesita
   * saber que departamento cuelga de cual para resolver un permiso heredado, y
   * si eso dependiera de que cada vista se acuerde de avisar, los permisos
   * serian correctos en unas pantallas y no en otras — que es peor que no
   * heredar en ninguna, porque el fallo no se ve.
   *
   * `includeInactive` lo usa solo la pantalla de administracion, que necesita
   * ver lo apagado para poder reactivarlo. Los desplegables llaman sin
   * argumentos y siguen recibiendo lo activo, como siempre.
   *
   * NO LLEVA SOBRE PAGINADO, y es deliberado: esto devuelve un arbol. Cortarlo
   * en paginas dejaria hijos sin su padre en la pagina siguiente, y una sangria
   * cuyo padre no esta a la vista no es jerarquia, es una mentira con formato.
   * Son unidades de la empresa, del orden de la decena; no hay volumen que
   * paginar. El servidor documenta la misma exencion.
   */
  list: async (options: { includeInactive?: boolean } = {}) => {
    const departments = await apiRequest<DepartmentResponse[]>(
      `/api/departments${toQuery({ includeInactive: options.includeInactive || undefined })}`,
    );

    /* Se registra SIEMPRE, y la lectura completa deja un arbol mejor que la
       recortada: un padre desactivado sigue conteniendo a sus hijos, asi que
       leer solo lo activo corta la cadena de ancestros justo ahi.

       Cuando eso pasa, `can()` concede de menos: esconde un boton que la
       persona si podia pulsar, y el servidor —que lee el arbol entero— la deja
       pasar igual. Es el lado correcto donde equivocarse, y es coherente con
       que esta capa sea una cortesia y no la barrera. */
    setDepartmentHierarchy(departments);
    return departments;
  },

  /** Relectura previa a una escritura: nunca se reenvia la copia pintada. */
  get: (id: number) => apiRequest<DepartmentResponse>(`/api/departments/${id}`),

  create: (data: SaveDepartmentRequest) =>
    apiRequest<DepartmentResponse>("/api/departments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: SaveDepartmentRequest) =>
    apiRequest<DepartmentResponse>(`/api/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: number) => apiRequest<void>(`/api/departments/${id}`, { method: "DELETE" }),
};
