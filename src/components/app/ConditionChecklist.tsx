import { AlertTriangle, Check } from "lucide-react";

/** Condicion que resuelve el servidor para completar o cerrar un registro. */
export interface ChecklistCondition {
  id: string;
  label: string;
  met: boolean;
  missing: string;
}

/** Lo que falta para completar o cerrar, tal como lo resuelve el servidor. */
export function ConditionChecklist({ conditions }: { conditions: ChecklistCondition[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {conditions.map((condition) => (
        <li
          key={condition.id}
          className={`flex items-start gap-2 text-[13px] leading-relaxed ${condition.met ? "text-brand-gray" : "text-warn"}`}
        >
          {condition.met ? (
            <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-green" />
          ) : (
            <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
          )}
          <span className="flex flex-col gap-0.5">
            <span>
              {condition.label}
              <span className="sr-only">{condition.met ? ": cumplida" : ": falta"}</span>
            </span>
            {!condition.met && <span className="text-[12.5px]">{condition.missing}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
