import { X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "../../../components/ui/Button";
import { FormDivider } from "../../../components/ui/FormDivider";
import { SECURITY_ITEMS, type CheckChoice } from "./discrepancyForm";

interface DiscrepancyChecksStepProps {
  checks: Record<number, CheckChoice>;
  setChecks: Dispatch<SetStateAction<Record<number, CheckChoice>>>;
  anyPositive: boolean;
  toggleCheck: (itemNumber: number, choice: "Positivo" | "Negativo") => void;
}

/** Paso 3: Puntos de Seguridad a Evaluar */
export function DiscrepancyChecksStep({ checks, setChecks, anyPositive, toggleCheck }: DiscrepancyChecksStepProps) {
  return (
    <div className="flex flex-col gap-3.5 animate-plf-fade">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormDivider title="Puntos de seguridad a evaluar (PF-FOR-291)" />
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setChecks({
                1: "Negativo",
                2: "Negativo",
                3: "Negativo",
                4: "Negativo",
                5: "Negativo",
                6: "Negativo",
                7: "Negativo",
                8: "Negativo",
                9: "",
              });
            }}
          >
            Marcar todos como Negativo
          </Button>
        </div>
      </div>

      {/* TABLA DE PUNTOS DE SEGURIDAD */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/90 text-[11px] font-heading font-bold uppercase tracking-wider text-zinc-500 select-none">
              <th className="py-2.5 pl-3 pr-2 w-10 text-center whitespace-nowrap">#</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Puntos de Seguridad a Evaluar</th>
              <th className="py-2.5 px-2 w-24 text-center whitespace-nowrap">
                <span className="block text-[9px] text-zinc-400 font-normal lowercase tracking-normal">marcar X</span>
                <span className="text-brand-red">Positivo</span>
              </th>
              <th className="py-2.5 px-2 w-24 text-center whitespace-nowrap">
                <span className="block text-[9px] text-zinc-400 font-normal lowercase tracking-normal">marcar X</span>
                <span>Negativo</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-[12.5px]">
            {SECURITY_ITEMS.map((item) => {
              const isNinth = item.itemNumber === 9;
              const disabled = isNinth && !anyPositive;
              const currentVal = checks[item.itemNumber] || "";

              return (
                <tr
                  key={item.itemNumber}
                  className={`transition-colors ${
                    currentVal === "Positivo" && !isNinth
                      ? "bg-rose-50/50 hover:bg-rose-50/80"
                      : "hover:bg-zinc-50/70"
                  } ${disabled ? "opacity-45" : ""}`}
                >
                  <td className="py-2.5 pl-3 pr-2 text-center font-mono text-[11px] font-semibold text-zinc-400">
                    {item.itemNumber}
                  </td>
                  <td className="py-2.5 px-3 leading-relaxed text-zinc-800">
                    <p>{item.text}</p>
                    {isNinth && !anyPositive && (
                      <span className="mt-0.5 inline-block text-[11px] text-zinc-400 italic">
                        (Aplica únicamente cuando al menos un punto del 1 al 8 es Positivo)
                      </span>
                    )}
                  </td>
                  {/* Checkbox / Botón POSITIVO */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleCheck(item.itemNumber, "Positivo")}
                      className={`mx-auto flex size-7 items-center justify-center rounded-lg border-2 transition-all cursor-pointer select-none disabled:opacity-35 disabled:cursor-not-allowed ${
                        currentVal === "Positivo"
                          ? "border-brand-red bg-brand-red text-white"
                          : "border-zinc-300 bg-white text-transparent hover:border-brand-red/60 hover:text-brand-red/40"
                      }`}
                      title={`Marcar punto ${item.itemNumber} como Positivo`}
                    >
                      <X className="size-3.5 stroke-[3]" />
                    </button>
                  </td>
                  {/* Checkbox / Botón NEGATIVO */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleCheck(item.itemNumber, "Negativo")}
                      className={`mx-auto flex size-7 items-center justify-center rounded-lg border-2 transition-all cursor-pointer select-none disabled:opacity-35 disabled:cursor-not-allowed ${
                        currentVal === "Negativo"
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-transparent hover:border-zinc-500 hover:text-zinc-400"
                      }`}
                      title={`Marcar punto ${item.itemNumber} como Negativo`}
                    >
                      <X className="size-3.5 stroke-[3]" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
