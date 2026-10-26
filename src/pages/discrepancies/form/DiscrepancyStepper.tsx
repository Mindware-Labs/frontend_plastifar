import { Check } from "lucide-react";

interface DiscrepancyStepperProps {
  step: 1 | 2 | 3;
  setStep: (step: 1 | 2 | 3) => void;
  ticketIdValue: string;
  linesCount: number;
}

/** Cabecera de pasos del PF-FOR-291: origen, lineas y puntos de seguridad. */
export function DiscrepancyStepper({ step, setStep, ticketIdValue, linesCount }: DiscrepancyStepperProps) {
  return (
    <div className="flex w-full items-center justify-between max-w-lg mx-auto select-none">
      {/* Paso 1 */}
      <button
        type="button"
        onClick={() => setStep(1)}
        className="flex items-center gap-2 cursor-pointer focus:outline-hidden group"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
            step === 1
              ? "bg-brand-red text-white shadow-2xs ring-2 ring-brand-red/20"
              : step > 1
              ? "bg-emerald-600 text-white"
              : "bg-zinc-200 text-zinc-600 group-hover:bg-zinc-300"
          }`}
        >
          {step > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}
        </span>
        <div className="flex flex-col text-left">
          <span
            className={`text-[12px] font-heading font-semibold transition-colors ${
              step === 1 ? "text-zinc-900" : step > 1 ? "text-zinc-700" : "text-zinc-400"
            }`}
          >
            Origen y Despacho
          </span>
          <span className="text-[10px] text-zinc-400 hidden sm:inline">Ticket y fecha</span>
        </div>
      </button>

      <div
        className={`h-0.5 flex-1 mx-3 rounded-full transition-colors ${
          step > 1 ? "bg-emerald-600/40" : "bg-zinc-200"
        }`}
      />

      {/* Paso 2 */}
      <button
        type="button"
        onClick={() => {
          if (ticketIdValue) setStep(2);
        }}
        disabled={!ticketIdValue}
        className="flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed focus:outline-hidden group"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
            step === 2
              ? "bg-brand-red text-white shadow-2xs ring-2 ring-brand-red/20"
              : step > 2
              ? "bg-emerald-600 text-white"
              : "bg-zinc-200 text-zinc-600 group-hover:bg-zinc-300"
          }`}
        >
          {step > 2 ? <Check className="h-3.5 w-3.5" /> : "2"}
        </span>
        <div className="flex flex-col text-left">
          <span
            className={`text-[12px] font-heading font-semibold transition-colors ${
              step === 2 ? "text-zinc-900" : step > 2 ? "text-zinc-700" : "text-zinc-400"
            }`}
          >
            Líneas y Detalle
          </span>
          <span className="text-[10px] text-zinc-400 hidden sm:inline">Productos y nota</span>
        </div>
      </button>

      <div
        className={`h-0.5 flex-1 mx-3 rounded-full transition-colors ${
          step > 2 ? "bg-emerald-600/40" : "bg-zinc-200"
        }`}
      />

      {/* Paso 3 */}
      <button
        type="button"
        onClick={() => {
          if (ticketIdValue && linesCount > 0) setStep(3);
        }}
        disabled={!ticketIdValue || linesCount === 0}
        className="flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed focus:outline-hidden group"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
            step === 3
              ? "bg-brand-red text-white shadow-2xs ring-2 ring-brand-red/20"
              : "bg-zinc-200 text-zinc-600 group-hover:bg-zinc-300"
          }`}
        >
          3
        </span>
        <div className="flex flex-col text-left">
          <span
            className={`text-[12px] font-heading font-semibold transition-colors ${
              step === 3 ? "text-zinc-900" : "text-zinc-400"
            }`}
          >
            Puntos de Seguridad
          </span>
          <span className="text-[10px] text-zinc-400 hidden sm:inline">9 puntos de control</span>
        </div>
      </button>
    </div>
  );
}
