import { Pencil, Power, Trash2 } from "lucide-react";
import { RowAction } from "../../components/ui/RowAction";

interface CatalogRowActionsProps {
  /** Como se nombra la fila en las etiquetas: «Editar …», «Desactivar …». */
  name: string;
  isActive: boolean;
  /** La fila tiene una accion en vuelo: sus botones se apagan. */
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  /** Sin el no se ofrece eliminar. */
  onDelete?: () => void;
}

/** Acciones de una fila de catalogo: editar, activar/desactivar y, si cabe, eliminar. */
export function CatalogRowActions({ name, isActive, busy, onEdit, onToggle, onDelete }: CatalogRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      <RowAction label={`Editar ${name}`} icon={Pencil} onClick={onEdit} disabled={busy} />
      <RowAction
        label={isActive ? `Desactivar ${name}` : `Reactivar ${name}`}
        icon={Power}
        onClick={onToggle}
        disabled={busy}
      />
      {onDelete && (
        <RowAction label={`Eliminar ${name}`} icon={Trash2} danger onClick={onDelete} disabled={busy} />
      )}
    </div>
  );
}
