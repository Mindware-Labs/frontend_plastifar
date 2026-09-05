import type { ComponentType } from "react";

interface RowActionProps {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

/**
 * Accion de fila visible: icono con etiqueta accesible.
 * El rojo 185 C se reserva para lo destructivo; el resto vive en gris.
 *
 * Sin `title`: repetia palabra por palabra el `aria-label` y el lector de
 * pantalla anunciaba la accion dos veces.
 */
export function RowAction({ label, icon: Icon, onClick, disabled, danger }: RowActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex h-7 w-7 items-center justify-center rounded-edge text-muted transition-colors
        outline-none focus-visible:ring-3 focus-visible:ring-brand-red/25
        disabled:cursor-not-allowed disabled:opacity-40 ${
          danger ? "hover:bg-brand-red/[0.04] hover:text-brand-red" : "hover:bg-fill hover:text-ink"
        }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
