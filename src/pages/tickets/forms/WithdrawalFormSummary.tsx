import { formatDay } from "../../../lib/dates";
import { formatAmount } from "../../../lib/numbers";
import type { MerchandiseWithdrawal } from "../../../types/withdrawals";
import { SummaryField } from "./SummaryField";
import { SummaryLinesTable } from "./SummaryLinesTable";

/** Resumen del retiro (PF-FOR-068) dentro de la pestana de formularios del ticket. */
export function WithdrawalFormSummary({ withdrawal: w }: { withdrawal: MerchandiseWithdrawal }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg bg-zinc-50 p-3.5 text-xs">
        <SummaryField label="Número" valueClassName="font-mono font-medium text-zinc-800">
          {w.number}
        </SummaryField>
        <SummaryField label="Fecha Solicitud">{formatDay(w.requestDate)}</SummaryField>
        <SummaryField label="Motivo">{w.reason}</SummaryField>
        <SummaryField label="Valor Total" valueClassName="font-semibold text-zinc-900">
          {w.currency ? formatAmount(w.totalValue, w.currency) : w.totalValue}
        </SummaryField>
      </dl>

      <SummaryLinesTable
        title={<>Productos a retirar ({w.lines.length})</>}
        head={
          <>
            <th className="p-2.5">Código</th>
            <th className="p-2.5">Producto</th>
            <th className="p-2.5 text-right">Cant. Solicitada</th>
            <th className="p-2.5 text-right">Cant. Retirada</th>
            <th className="p-2.5 text-right">P. Unitario</th>
            <th className="p-2.5 text-right">Valor</th>
          </>
        }
      >
        {w.lines.map((l) => (
          <tr key={l.id} className="hover:bg-zinc-50/50">
            <td className="p-2.5 font-mono text-[11px] text-zinc-500">{l.productCode}</td>
            <td className="p-2.5 font-medium text-zinc-800">{l.productName}</td>
            <td className="p-2.5 text-right font-medium">{l.quantity} {l.quantityUnit}</td>
            <td className="p-2.5 text-right">{l.withdrawnQuantity !== null ? `${l.withdrawnQuantity} ${l.quantityUnit}` : "—"}</td>
            <td className="p-2.5 text-right">{l.unitPrice !== null ? formatAmount(l.unitPrice, w.currency ?? "DOP") : "—"}</td>
            <td className="p-2.5 text-right font-semibold">{l.lineValue !== null ? formatAmount(l.lineValue, w.currency ?? "DOP") : "—"}</td>
          </tr>
        ))}
      </SummaryLinesTable>
    </div>
  );
}
