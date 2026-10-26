import { useMemo, type ComponentProps } from "react";
import { resolveProductLabel, searchProducts } from "../../lib/lookups";
import {
  ticketProductLabelMap,
  ticketProductsToLookupOptions,
} from "../../lib/ticketProducts";
import type { TicketProductResponse } from "../../types/api";
import { LookupField } from "../ui/Field";

type ProductLookupFieldProps = Omit<
  ComponentProps<typeof LookupField>,
  "search" | "resolveSelectedLabel" | "searchPlaceholder" | "recommendedOptions"
> & {
  searchPlaceholder?: string;
  /** Productos ligados al ticket: activa «Producto(s) del ticket» / «Todos los productos» (PF-FOR-291). */
  ticketProducts?: TicketProductResponse[];
  recommendedOptions?: ComponentProps<typeof LookupField>["recommendedOptions"];
};

/**
 * Selector de producto (docs/plan/00, RF-B4).
 *
 * Misma búsqueda que discrepancia de cargas: `searchProducts`, etiquetas por id
 * y, si hay `ticketProducts`, pestañas de recomendados del caso.
 */
export function ProductLookupField({
  placeholder,
  searchPlaceholder = "Código o descripción…",
  ticketProducts,
  recommendedOptions,
  selectedLabel,
  value = "",
  ...props
}: ProductLookupFieldProps) {
  const ticketRecommended = useMemo(
    () => ticketProductsToLookupOptions(ticketProducts),
    [ticketProducts],
  );
  const ticketLabels = useMemo(() => ticketProductLabelMap(ticketProducts), [ticketProducts]);

  const resolvedRecommended =
    recommendedOptions ?? (ticketRecommended.length > 0 ? ticketRecommended : undefined);

  const resolvedSelectedLabel =
    selectedLabel ?? (value !== "" ? ticketLabels.get(value) : undefined);

  const resolvedPlaceholder =
    placeholder ??
    (resolvedRecommended && resolvedRecommended.length > 0
      ? "Buscar producto…"
      : "Elige un producto");

  return (
    <LookupField
      {...props}
      value={value}
      placeholder={resolvedPlaceholder}
      searchPlaceholder={searchPlaceholder}
      search={searchProducts}
      resolveSelectedLabel={resolveProductLabel}
      recommendedOptions={resolvedRecommended}
      selectedLabel={resolvedSelectedLabel}
    />
  );
}
