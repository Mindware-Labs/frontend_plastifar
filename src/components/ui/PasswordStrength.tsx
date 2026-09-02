import { Check } from "lucide-react";
import { evaluatePassword, type StrengthLevel } from "../../lib/password";

/**
 * Medidor de fuerza + lista de requisitos.
 *
 * La barra crece con transform: scaleX, nunca con width — asi la animacion no
 * reordena el layout en cada tecla. Cada requisito se marca en verde 348 C en
 * cuanto se cumple, para que la persona vea que le falta sin tener que enviar.
 */
const tierClasses: Record<StrengthLevel, { fill: string; badge: string }> = {
  weak: { fill: "bg-brand-red", badge: "bg-brand-red" },
  average: { fill: "bg-warn", badge: "bg-warn" },
  strong: { fill: "bg-brand-green", badge: "bg-brand-green" },
};

export function PasswordStrength({ value, className = "" }: { value: string; className?: string }) {
  const { rules, tier } = evaluatePassword(value);
  const empty = value.length === 0;
  const styles = tierClasses[tier.level];

  return (
    <section aria-live="polite" className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full origin-left rounded-full transition-[transform,background-color]
              duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${empty ? "bg-line" : styles.fill}`}
            style={{ transform: `scaleX(${empty ? 0 : tier.scale})` }}
          />
        </div>

        <span
          className={`inline-flex h-[20px] min-w-[52px] items-center justify-center rounded-full px-2
            font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-white
            transition-colors ${empty ? "bg-zinc-300" : styles.badge}`}
        >
          {empty ? "—" : tier.label}
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
