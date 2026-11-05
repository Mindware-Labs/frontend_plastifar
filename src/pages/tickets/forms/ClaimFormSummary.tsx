import { formatDay } from "../../../lib/dates";
import { formatAmount } from "../../../lib/numbers";
import type { CustomerClaim } from "../../../types/claims";
import { SummaryField } from "./SummaryField";
import { SummaryLinesTable } from "./SummaryLinesTable";
import { SummaryNote } from "./SummaryNote";

/** Resumen de la reclamacion (PF-FOR-034) dentro de la pestana de formularios del ticket. */
export function ClaimFormSummary({ claim: c }: { claim: CustomerClaim }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg bg-zinc-50 p-3.5 text-xs">
        <SummaryField label="Fecha Reclamo">{formatDay(c.claimDate)}</SummaryField>
        <SummaryField label="Factura">{c.invoiceRef || "—"}</SummaryField>
        <SummaryField label="Motivo">{c.reason} {c.reasonOther ? `(${c.reasonOther})` : ""}</SummaryField>
        <SummaryField label="Monto Total" valueClassName="font-semibold text-zinc-900">
          {c.currency ? formatAmount(c.totalAmount, c.currency) : c.totalAmount}
        </SummaryField>
      </dl>

      {c.description && <SummaryNote label="Descripción:">{c.description}</SummaryNote>}

      {/* Lines preview */}
      <SummaryLinesTable
        title={<>Líneas de producto ({c.lines.length})</>}
        head={
          <>
            <th className="p-2.5">Código</th>
            <th className="p-2.5">Producto</th>
            <th className="p-2.5 text-right">Facturado</th>
            <th className="p-2.5 text-right">Recibido</th>
            <th className="p-2.5 text-right">Defectuoso</th>
            <th className="p-2.5 text-right">P. Unitario</th>
          </>
        }
      >
        {c.lines.map((l) => (
          <tr key={l.id} className="hover:bg-zinc-50/50">
            <td className="p-2.5 font-mono text-[11px] text-zinc-500">{l.productCode}</td>
            <td className="p-2.5 font-medium text-zinc-800">{l.productName}</td>
            <td className="p-2.5 text-right">{l.invoicedQuantity ?? "—"}</td>
            <td className="p-2.5 text-right">{l.receivedQuantity ?? "—"}</td>
            <td className="p-2.5 text-right font-semibold text-brand-red">{l.defectiveQuantity ?? "—"}</td>
            <td className="p-2.5 text-right">{l.unitPrice !== null ? formatAmount(l.unitPrice, c.currency ?? "DOP") : "—"}</td>
          </tr>
        ))}
      </SummaryLinesTable>
    </div>
  );
}
