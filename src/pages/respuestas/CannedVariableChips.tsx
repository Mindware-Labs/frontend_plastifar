import { Plus, Sparkles } from "lucide-react";
import { CANNED_VARIABLES } from "../../lib/cannedVariables";
import { CANNED_VAR_CHIP_PICKER } from "./cannedVariableChipStyles";

export function CannedVariableChips({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-col gap-2 border-b border-zinc-100 bg-zinc-50/70 px-3.5 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-700">
          <Sparkles className="size-3 text-brand-red" strokeWidth={2.25} />
          <span>VARIABLES INTELIGENTES</span>
        </span>
        <span className="text-[11px] text-zinc-400">
          Haz clic para insertar en la posición del cursor
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {CANNED_VARIABLES.map((variable) => (
          <button
            key={variable.token}
            type="button"
            title={`${variable.hint} (Ej. ${variable.example})`}
            onMouseDown={(event) => {
              // Evita que el botón robe el foco y pierda la posición del cursor en el editor.
              event.preventDefault();
            }}
            onClick={() => onInsert(variable.token)}
            className={CANNED_VAR_CHIP_PICKER}
          >
            <Plus className="size-3 shrink-0 text-brand-red/80" strokeWidth={2.5} />
            <span>{variable.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
