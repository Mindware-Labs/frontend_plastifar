import type { TicketProductResponse } from "../types/api";

/** Texto compacto para listados y propiedades del ticket. */
export function formatTicketProductsSummary(products: TicketProductResponse[] | undefined): string | null {
  if (!products?.length) return null;
  return products.map((p) => (p.productCode ? `${p.productCode} · ${p.productName}` : p.productName)).join(", ");
}
