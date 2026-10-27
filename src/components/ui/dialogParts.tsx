import { X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Piezas compartidas por `Modal` y `Drawer`. Antes cada uno dibujaba su propia
 * cabecera (titulo de 16 px en negrita contra 18 px seminegrita, fondo gris en
 * uno y blanco en el otro) y su propio velo; el usuario veia dos familias de
 * dialogo distintas. Ahora la cabecera, el pie y el velo salen de aqui.
 */

/** Velo comun detras de cualquier dialogo. */
export const DIALOG_SCRIM = "bg-ink/40 backdrop-blur-[2px]";

/** Pie por defecto: acciones a la derecha sobre un gris muy leve, separado por un filete. */
export const DIALOG_FOOTER = "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-fill/50 px-6 py-3.5";

interface DialogHeaderProps {
  title: string;
  titleId: string;
  description?: ReactNode;
  descriptionId: string;
  onClose: () => void;
}

export function DialogHeader({ title, titleId, description, descriptionId, onClose }: DialogHeaderProps) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
      <div className="min-w-0 flex-1">
        <h2
          key={title}
          id={titleId}
          className="animate-plf-header-fade font-heading text-[16px] font-semibold leading-snug tracking-tight text-ink"
        >
          {title}
        </h2>
        {description && (
          <div
            key={typeof description === "string" ? description : undefined}
            id={descriptionId}
            className="animate-plf-header-fade mt-1 max-w-prose text-[12.5px] leading-relaxed text-subtle"
          >
            {description}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        title="Cerrar (Esc)"
        className="-mr-1.5 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-subtle outline-none transition-colors hover:bg-fill hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-red/25 active:scale-95"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
