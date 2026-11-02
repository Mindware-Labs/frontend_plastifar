import { CANNED_VARIABLES } from "../../lib/cannedVariables";

export function CannedVariableChips({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {CANNED_VARIABLES.map((variable) => (
        <button
          key={variable.token}
          type="button"
          title={variable.hint}
          onClick={() => onInsert(variable.token)}
          className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[10.5px] font-medium text-zinc-700 transition-colors hover:border-brand-red/30 hover:bg-brand-red/5 hover:text-brand-red cursor-pointer"
        >
          {variable.token}
        </button>
      ))}
    </div>
  );
}
