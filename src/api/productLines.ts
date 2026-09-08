import { apiRequest, toQuery } from "./client";
import type { ProductLine } from "../types/settings";

export interface ProductLineListResponse {
  items: ProductLine[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ProductLineQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  /** todas | activas | inactivas */
  status?: string;
  dir?: "asc" | "desc";
}

export const productLinesApi = {
  /**
   * Solo lectura aqui: el alta y edicion viven en Catalogos y configuracion.
   *
   * Sin `pageSize` por omision: los 100 de oficio no eran un valor por defecto
   * sino un tope invisible --pasada esa cifra la linea dejaba de aparecer en el
   * desplegable sin aviso ninguno--. Quien quiere el catalogo entero lo recorre
   * con `fetchAllPages`.
   */
  list: (query: ProductLineQuery = {}) =>
    apiRequest<ProductLineListResponse>(`/api/settings/product-lines${toQuery({ ...query })}`),
};
