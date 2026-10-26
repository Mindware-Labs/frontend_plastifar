import { formatDay } from "../../../lib/dates";
import type { CorrectiveActionSheet } from "../../../types/quality";
import { SummaryField } from "./SummaryField";
import { SummaryNote } from "./SummaryNote";

/** Resumen de la HCA (PF-FOR-109) dentro de la pestana de formularios del ticket. */
export function HcaFormSummary({ sheet: s }: { sheet: CorrectiveActionSheet }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg bg-zinc-50 p-3.5 text-xs">
        <SummaryField label="Número HCA" valueClassName="font-mono font-medium text-zinc-800">
          {s.number}
        </SummaryField>
        <SummaryField label="Línea de Producto">{s.productLineName}</SummaryField>
        <SummaryField label="Fecha Detección">{formatDay(s.detectedAt)}</SummaryField>
        <SummaryField label="Responsable">{s.responsibleName}</SummaryField>
      </dl>

      <SummaryNote label="Hecho / No Conformidad:">{s.description}</SummaryNote>

      {s.causes && s.causes.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-zinc-800 mb-2">Causas identificadas (5 Porqués / Raíz)</h4>
          <ul className="space-y-1.5 text-xs text-zinc-700">
            {s.causes.map((c, idx) => (
              <li key={c.id} className="flex items-start gap-2 rounded border border-zinc-100 bg-zinc-50/40 p-2">
                <span className="font-mono font-bold text-zinc-400">#{idx + 1}</span>
                <span>{c.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
