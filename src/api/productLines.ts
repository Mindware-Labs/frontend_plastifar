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
   * Acepta pagina porque el endpoint la acepta; los 100 son el valor por
   * omision de quien pide el catalogo entero para llenar un desplegable, no un
   * tope impuesto al que quiera recorrerlo.
   */
  list: (query: ProductLineQuery = {}) =>
    apiRequest<ProductLineListResponse>(
      `/api/settings/product-lines${toQuery({ pageSize: 100, ...query })}`,
    ),
};
