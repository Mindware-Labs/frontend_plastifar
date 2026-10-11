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
      className={`flex h-7 w-7 items-center justify-center rounded-edge text-subtle transition-colors
        disabled:cursor-not-allowed disabled:opacity-40 ${
          danger ? "hover:bg-red-50 hover:text-brand-red" : "hover:bg-fill hover:text-ink"
        }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
