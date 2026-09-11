import { Check } from "lucide-react";
import { evaluatePassword, type StrengthLevel } from "../../lib/password";

// Débil se pinta en tinta, no en rojo: el rojo queda reservado para acción y foco.
const tierFill: Record<StrengthLevel, string> = {
  weak: "bg-ink",
  average: "bg-warn",
  strong: "bg-brand-green",
};

/** Medidor de fuerza y lista de requisitos: cada regla se marca en verde en cuanto se cumple. */
export function PasswordStrength({ value, className = "" }: { value: string; className?: string }) {
  const { rules, score, tier } = evaluatePassword(value);
  const empty = value.length === 0;
  const remaining = rules.length - score;

  let summary = `${rules.length} requisitos`;
  let summaryClass = "text-faint";
  if (!empty && remaining === 0) {
    summary = tier.label;
    summaryClass = "text-brand-green";
  } else if (!empty) {
    summary = `${tier.label} · ${remaining === 1 ? "falta 1" : `faltan ${remaining}`}`;
    summaryClass = "text-ink";
  }

  return (
    <section aria-live="polite" className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
          {/* Crece con scaleX, nunca con width: la animación no reordena el layout en cada tecla. */}
          <div
            className={`h-full origin-left rounded-full transition-[transform,background-color]
              duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${empty ? "bg-line" : tierFill[tier.level]}`}
            style={{ transform: `scaleX(${empty ? 0 : tier.scale})` }}
          />
        </div>

        <span
          className={`shrink-0 font-heading text-[11px] font-semibold tabular-nums tracking-[0.02em] transition-colors ${summaryClass}`}
        >
          {summary}
        </span>
      </div>

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-center gap-2">
            <span
              className={`flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border
                transition-colors ${
                  rule.met
                    ? "border-brand-green bg-brand-green text-white"
                    : "border-line-strong text-transparent"
                }`}
            >
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
            </span>
            <span
              className={`text-[11.5px] leading-tight transition-colors ${
                rule.met ? "text-brand-gray" : "text-faint"
              }`}
            >
              {rule.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
