import type { ComponentProps } from "react";
import { resolveProductLabel, searchProducts } from "../../lib/lookups";
import { LookupField } from "../ui/Field";

type ProductLookupFieldProps = Omit<
  ComponentProps<typeof LookupField>,
  "search" | "resolveSelectedLabel" | "searchPlaceholder"
> & {
  searchPlaceholder?: string;
};

/**
 * Selector de producto (docs/plan/00, RF-B4).
 *
 * Es `LookupField` con la búsqueda de productos ya enchufada: consulta al
 * servidor por código parcial o por parte de la descripción, ofrece solo los
 * activos y muestra el código como segunda línea de cada opción. Un producto
 * que se desactivó después de elegirlo deja de salir en la búsqueda, pero el
 * campo sigue nombrándolo: la etiqueta de lo ya seleccionado se resuelve por id.
 *
 * Todavía no lo usa ninguna pantalla. Sus consumidores son las líneas de
 * producto de los formularios: reclamación de clientes (docs/plan/03), retiro
 * de mercancía (docs/plan/04), HCA ampliada (docs/plan/05) y discrepancia de
 * carga (docs/plan/06). El valor es el id del producto como texto, igual que en
 * los demás `LookupField`; cada formulario guarda además su propia copia del
 * código y la descripción (regla 3 del plan).
 */
export function ProductLookupField({
  placeholder = "Elige un producto",
  searchPlaceholder = "Buscar por código o descripción…",
  ...props
}: ProductLookupFieldProps) {
  return (
    <LookupField
      {...props}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      search={searchProducts}
      resolveSelectedLabel={resolveProductLabel}
    />
  );
}
