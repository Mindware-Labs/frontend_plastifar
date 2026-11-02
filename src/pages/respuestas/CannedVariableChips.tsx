import { CANNED_VARIABLES } from "../../lib/cannedVariables";
import { CANNED_VAR_CHIP_PICKER } from "./cannedVariableChipStyles";

export function CannedVariableChips({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {CANNED_VARIABLES.map((variable) => (
        <button
          key={variable.token}
          type="button"
          title={variable.hint}
          onClick={() => onInsert(variable.token)}
          className={CANNED_VAR_CHIP_PICKER}
        >
          {variable.label}
        </button>
      ))}
    </div>
  );
}
