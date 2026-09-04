import { apiRequest, toQuery } from "./client";
import type { ProductLine } from "../types/settings";

export interface ProductLineListResponse {
  items: ProductLine[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const productLinesApi = {
  /** Solo lectura aqui: el alta y edicion viven en Catalogos y configuracion. */
  list: () =>
    apiRequest<ProductLineListResponse>(`/api/settings/product-lines${toQuery({ pageSize: 100 })}`),
};
