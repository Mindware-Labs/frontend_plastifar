import type { LookupOption } from "../components/ui/LookupSelect";
import type { TicketProductResponse } from "../types/api";

/** Texto compacto para listados y propiedades del ticket. */
export function formatTicketProductsSummary(products: TicketProductResponse[] | undefined): string | null {
  if (!products?.length) return null;
  return products.map((p) => (p.productCode ? `${p.productCode} · ${p.productName}` : p.productName)).join(", ");
}

export function ticketProductDisplayLabel(p: TicketProductResponse): string {
  return p.productCode ? `${p.productCode} · ${p.productName}` : p.productName;
}

/** Opciones fijas para buscadores (p. ej. discrepancia PF-FOR-291). */
export function ticketProductsToLookupOptions(
  products: TicketProductResponse[] | undefined,
): LookupOption[] {
  if (!products?.length) return [];
  return products.map((p) => ({
    value: String(p.productId),
    label: ticketProductDisplayLabel(p),
  }));
}

export function ticketProductLabelMap(
  products: TicketProductResponse[] | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of products ?? []) {
    map.set(String(p.productId), ticketProductDisplayLabel(p));
  }
  return map;
}
