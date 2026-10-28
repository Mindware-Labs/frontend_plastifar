import { AlertCircle, Clock, Loader2 } from "lucide-react";
import type { FieldState } from "../ui/Field";
import type { Priority, SlaPolicy } from "../../types/settings";
import { findSlaPolicyById, slaPolicyPlazoLabel } from "../../lib/slaPolicyUi";

const PRIORITY_DOT: Record<Priority, string> = {
  Emergencia: "bg-brand-red",
  Alta: "bg-amber-500",
  Normal: "bg-zinc-500",
  Baja: "bg-zinc-300",
};

export interface SlaPolicyFieldProps {
  label?: string;
  required?: boolean;
  policies: SlaPolicy[] | null;
  loading?: boolean;
  value: string;
  onChange: (policyId: string) => void;
  error?: string;
  state?: FieldState;
  emptyHint?: string;
}

export function SlaPolicyField({
  label = "Política de SLA",
  required = true,
  policies,
  loading = false,
  value,
  onChange,
  error,
  state = "idle",
  emptyHint = "Configura políticas activas en Ajustes → SLA.",
}: SlaPolicyFieldProps) {
  const selected = policies ? findSlaPolicyById(policies, value) : undefined;
  const ring =
    state === "error" || error
      ? "ring-1 ring-brand-red/25 border-brand-red"
      : "border-zinc-200";

  if (loading) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="font-heading text-[11.5px] font-semibold text-faint">
          {label} {required && <span className="text-brand-red">*</span>}
        </span>
        <div className="flex h-20 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50/80">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-hidden />
          <span className="sr-only">Cargando políticas SLA</span>
        </div>
      </div>
    );
  }

  if (!policies || policies.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="font-heading text-[11.5px] font-semibold text-faint">
          {label} {required && <span className="text-brand-red">*</span>}
        </span>
        <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-3 py-2.5 text-[12px] leading-relaxed text-zinc-500">
          {emptyHint}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-heading text-[11.5px] font-semibold text-faint">
          {label} {required && <span className="text-brand-red">*</span>}
        </span>
        {selected && (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-zinc-400">
            <Clock className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate max-w-[180px]">{slaPolicyPlazoLabel(selected)}</span>
          </span>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label={label}
        className={`grid gap-1 rounded-lg border bg-zinc-50/70 p-1 ${ring}`}
      >
        {policies.map((policy) => {
          const isSelected = value === String(policy.id);
          return (
            <button
              key={policy.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(String(policy.id))}
              className={`group flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/35 ${
                isSelected
                  ? "border-zinc-300 bg-white font-semibold text-zinc-900 shadow-2xs ring-1 ring-zinc-900/[0.07] hover:border-zinc-400 hover:bg-white hover:shadow-md hover:ring-2 hover:ring-zinc-900/12 active:scale-[0.998]"
                  : "border-transparent font-medium text-zinc-600 hover:border-zinc-200/90 hover:bg-white hover:text-zinc-900 hover:shadow-2xs active:bg-zinc-50/80"
              }`}
            >
              <span className="flex w-full items-center gap-2 min-w-0">
                <span
                  className={`size-2 shrink-0 rounded-full ${PRIORITY_DOT[policy.priority]}`}
                  aria-hidden
                />
                <span className="font-heading text-[12px] leading-snug truncate">{policy.name}</span>
                {policy.isDefault && (
                  <span className="ml-auto shrink-0 rounded border border-zinc-200/90 bg-zinc-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                    Predeterminada
                  </span>
                )}
              </span>
              <span
                className={`pl-4 text-[10.5px] leading-snug transition-colors ${
                  isSelected
                    ? "text-zinc-500 group-hover:text-zinc-600"
                    : "text-zinc-400 group-hover:text-zinc-500"
                }`}
              >
                Prioridad {policy.priority.toLowerCase()} · {slaPolicyPlazoLabel(policy)}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="flex items-center gap-1 text-[11px] font-medium text-brand-red-dark animate-plf-shake">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
