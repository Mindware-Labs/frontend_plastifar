import { Building2, Package, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDay, formatInstant } from "../../lib/dates";
import { formatAmount, formatPrice, formatQuantity } from "../../lib/numbers";
import type { MerchandiseWithdrawal } from "../../types/withdrawals";
import { WithdrawalStatusBadge } from "./WithdrawalStatusBadge";

interface WithdrawalExecutiveSummaryProps {
  withdrawal: MerchandiseWithdrawal;
}

export function WithdrawalExecutiveSummary({ withdrawal }: WithdrawalExecutiveSummaryProps) {
  const kpiLabelClass = "font-heading text-[10px] font-semibold text-zinc-500";
  const sectionTitleClass = "font-heading text-[11px] font-semibold text-zinc-700";
  const fieldLabelClass = "text-[10.5px] font-medium text-zinc-500";

  return (
    <div className="space-y-4 text-xs">
      <div className="rounded-xl border border-zinc-200/90 bg-white p-4.5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center justify-start gap-2">
              <h3 className="text-base font-bold text-zinc-900">Solicitud de retiro de mercancía</h3>
              <WithdrawalStatusBadge status={withdrawal.status} />
            </div>
            <p className="mt-1 text-[11.5px] text-zinc-500">
              Vinculada al ticket{" "}
              <Link
                to={`/tickets/${withdrawal.ticketId}`}
                className="font-mono font-medium text-ink hover:text-brand-red transition-colors"
              >
                #{withdrawal.ticketNumber}
              </Link>
              {withdrawal.ticketSubject ? ` · ${withdrawal.ticketSubject}` : ""}
            </p>
          </div>
          {withdrawal.withdrawnAt && (
            <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/50 px-3 py-1.5 text-right">
              <span className="block font-heading text-[10px] font-semibold text-emerald-800">Mercancía retirada</span>
              <span className="text-[11px] text-emerald-700">{formatInstant(withdrawal.withdrawnAt)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Número de solicitud</span>
          <p className="mt-1 font-mono text-sm font-bold text-zinc-900">{withdrawal.number}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Fecha solicitada</span>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{formatDay(withdrawal.requestDate)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Motivo</span>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{withdrawal.reason}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Valor total</span>
          <p className="mt-1 text-sm font-bold tabular-nums text-brand-red">
            {withdrawal.currency ? formatAmount(withdrawal.totalValue, withdrawal.currency) : formatQuantity(withdrawal.totalValue)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
          <Building2 className="h-4 w-4 text-zinc-500" />
          <h4 className={sectionTitleClass}>Datos generales</h4>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <div>
            <span className={fieldLabelClass}>Cliente</span>
            <p className="mt-0.5 font-semibold text-zinc-900">{withdrawal.clientName}</p>
          </div>
          <div>
            <span className={fieldLabelClass}>Registrado por</span>
            <p className="mt-0.5 text-zinc-800">{withdrawal.requestedByName}</p>
          </div>
          <div>
            <span className={fieldLabelClass}>Origen del error</span>
            <p className="mt-0.5 text-zinc-800">{withdrawal.errorOrigin ?? "—"}</p>
          </div>
          {withdrawal.decidedByName && (
            <div>
              <span className={fieldLabelClass}>Decisión</span>
              <p className="mt-0.5 text-zinc-800">
                {withdrawal.decidedByName}
                {withdrawal.decidedAt ? ` · ${formatInstant(withdrawal.decidedAt)}` : ""}
              </p>
            </div>
          )}
        </div>
      </div>

      {withdrawal.lines.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs">
          <div className="flex items-center gap-2 border-b border-zinc-200/80 bg-zinc-50/70 px-4 py-2.5">
            <Package className="h-4 w-4 text-zinc-500" />
            <h4 className={sectionTitleClass}>Productos ({withdrawal.lines.length})</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200/80 bg-zinc-50/80 text-[10.5px] font-semibold text-zinc-600">
                <tr>
                  <th className="p-3">Producto</th>
                  <th className="p-3 text-right">Cantidad</th>
                  <th className="p-3 text-right">Retirada</th>
                  <th className="p-3 text-right">Precio</th>
                  <th className="p-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {withdrawal.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="p-3">
                      <p className="font-semibold text-zinc-900">{line.productName}</p>
                      {line.productCode && (
                        <span className="font-mono text-[10.5px] text-zinc-400">{line.productCode}</span>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatQuantity(line.quantity)} {line.quantityUnit}
                    </td>
                    <td className="p-3 text-right tabular-nums">{formatQuantity(line.withdrawnQuantity)}</td>
                    <td className="p-3 text-right tabular-nums">{formatPrice(line.unitPrice)}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">
                      {withdrawal.currency && line.lineValue !== null
                        ? formatAmount(line.lineValue, withdrawal.currency)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {withdrawal.decisionNote?.trim() && (
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
            <UserCheck className="h-4 w-4 text-zinc-500" />
            <h4 className={sectionTitleClass}>Nota de decisión</h4>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-zinc-800">{withdrawal.decisionNote.trim()}</p>
        </div>
      )}
    </div>
  );
}
