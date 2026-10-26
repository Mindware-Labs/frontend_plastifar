import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { RowAction } from "../ui/RowAction";

interface LineItemCardProps {
  index: number;
  /** Campo del producto, arriba y a todo el ancho. */
  product: ReactNode;
  canRemove: boolean;
  onRemove: () => void;
  /** Resto de campos de la linea, bajo el producto. */
  children: ReactNode;
}

/** Ficha de una linea de producto en un formulario: producto, quitar y el resto de campos. */
export function LineItemCard({ index, product, canRemove, onRemove, children }: LineItemCardProps) {
  return (
    <div className="rounded-edge border border-line bg-canvas/60 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">{product}</div>
        {canRemove && (
          <div className="pt-6">
            <RowAction label={`Quitar la línea ${index + 1}`} icon={Trash2} danger onClick={onRemove} />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
