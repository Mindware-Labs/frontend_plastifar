import type { ComponentType } from "react";

interface RowActionProps {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

/** Botón de acción por fila con tooltip nativo y soporte accesible. */
export function RowAction({ label, icon: Icon, onClick, disabled, danger }: RowActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      /* `scale-90` al pulsar y no un hundimiento: estos iconos miden 28 px y
         viven pegados en fila, asi que un desplazamiento de 1 px se pierde
         entre los vecinos mientras que el encogimiento se ve en el que tocaste.
         Es el mismo acuse que la pulsacion de un boton, a la escala de un icono. */
      className={`flex h-7 w-7 items-center justify-center rounded-edge text-subtle
        transition-[background-color,color,transform] duration-150 active:scale-90
        disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${
          danger ? "hover:bg-brand-red/[0.06] hover:text-brand-red" : "hover:bg-fill hover:text-ink"
        }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
