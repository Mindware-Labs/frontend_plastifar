import { X } from "lucide-react";
import { cannedVariableLabel, lookupCannedVariable } from "../../lib/cannedVariables";
import {
  CANNED_VAR_CHIP_INLINE,
  CANNED_VAR_CHIP_REMOVE,
} from "./cannedVariableChipStyles";

const SIZE_CLASS = {
  sm: "text-[10.5px]",
  md: "text-[11px]",
} as const;

/** Variable inteligente como chip inline (edición o solo lectura). */
export function CannedVariableToken({
  variableKey,
  onRemove,
  size = "md",
  readOnly = false,
}: {
  variableKey: string;
  onRemove?: () => void;
  size?: keyof typeof SIZE_CLASS;
  readOnly?: boolean;
}) {
  const def = lookupCannedVariable(variableKey);
  const label = cannedVariableLabel(variableKey);

  return (
    <span
      contentEditable={false}
      title={def?.hint ?? label}
      className={`${CANNED_VAR_CHIP_INLINE} ${SIZE_CLASS[size]}`}
    >
      <span className="truncate">{label}</span>
      {!readOnly && onRemove && (
        <button
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove();
          }}
          aria-label={`Quitar ${label}`}
          className={CANNED_VAR_CHIP_REMOVE}
        >
          <X className="size-2.5" strokeWidth={2.25} />
        </button>
      )}
    </span>
  );
}
