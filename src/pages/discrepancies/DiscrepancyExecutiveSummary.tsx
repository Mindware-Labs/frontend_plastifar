import { Building2, FileText, Package, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDay, formatInstant } from "../../lib/dates";
import { NOTIFICATION_ITEM } from "../../lib/discrepancies";
import { formatQuantity } from "../../lib/numbers";
import type { DiscrepancyCompletionCondition, LoadDiscrepancy } from "../../types/discrepancies";
import { DiscrepancyStatusBadge, SecurityFindingBadge } from "./DiscrepancyStatusBadge";

interface DiscrepancyExecutiveSummaryProps {
  discrepancy: LoadDiscrepancy;
  completionConditions?: DiscrepancyCompletionCondition[];
}

export function DiscrepancyExecutiveSummary({
  discrepancy,
  completionConditions,
}: DiscrepancyExecutiveSummaryProps) {
  const kpiLabelClass = "font-heading text-[10px] font-semibold text-zinc-500";
  const sectionTitleClass = "font-heading text-[11px] font-semibold text-zinc-700";
  const fieldLabelClass = "text-[10.5px] font-medium text-zinc-500";

  const securityAnswered = discrepancy.checks.filter(
    (c) => c.itemNumber !== NOTIFICATION_ITEM && c.result !== null,
  ).length;

  return (
    <div className="space-y-4 text-xs">
      <div className="rounded-xl border border-zinc-200/90 bg-white p-4.5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center justify-start gap-2">
              <h3 className="text-base font-bold text-zinc-900">Investigación de discrepancia de carga</h3>
              <DiscrepancyStatusBadge status={discrepancy.status} />
              {discrepancy.hasSecurityFinding && <SecurityFindingBadge />}
            </div>
            <p className="mt-1 text-[11.5px] text-zinc-500">
              Vinculada al ticket{" "}
              <Link
                to={`/tickets/${discrepancy.ticketId}`}
                className="font-mono font-medium text-ink hover:text-brand-red transition-colors"
              >
                #{discrepancy.ticketNumber}
              </Link>
              {discrepancy.ticketSubject ? ` · ${discrepancy.ticketSubject}` : ""}
            </p>
          </div>
          {discrepancy.approvedAt && (
            <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/50 px-3 py-1.5 text-right">
              <span className="block font-heading text-[10px] font-semibold text-emerald-800">Aprobada</span>
              <span className="text-[11px] text-emerald-700">
                {formatInstant(discrepancy.approvedAt)}
                {discrepancy.approvedByName ? ` · ${discrepancy.approvedByName}` : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Número de investigación</span>
          <p className="mt-1 font-mono text-sm font-bold text-zinc-900">{discrepancy.number}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Fecha de registro</span>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{formatDay(discrepancy.createdAt.slice(0, 10))}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Líneas registradas</span>
          <p className="mt-1 text-sm font-bold text-zinc-900">{discrepancy.lines.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Puntos de seguridad</span>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{securityAnswered} / 8</p>
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
            <p className="mt-0.5 font-semibold text-zinc-900">{discrepancy.clientName ?? "—"}</p>
          </div>
          <div>
            <span className={fieldLabelClass}>Realizada por</span>
            <p className="mt-0.5 text-zinc-800">{discrepancy.performedByName ?? "—"}</p>
          </div>
          <div>
            <span className={fieldLabelClass}>Fecha de realización</span>
            <p className="mt-0.5 text-zinc-800">
              {discrepancy.performedAt ? formatInstant(discrepancy.performedAt) : "—"}
            </p>
          </div>
        </div>
        {discrepancy.note?.trim() && (
          <div className="mt-3">
            <span className={fieldLabelClass}>Nota de la investigación</span>
            <p className="mt-1 whitespace-pre-wrap rounded-lg border border-zinc-100 bg-zinc-50/70 p-3 text-zinc-800">
              {discrepancy.note.trim()}
            </p>
          </div>
        )}
      </div>

      {discrepancy.lines.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs">
          <div className="flex items-center gap-2 border-b border-zinc-200/80 bg-zinc-50/70 px-4 py-2.5">
            <Package className="h-4 w-4 text-zinc-500" />
            <h4 className={sectionTitleClass}>Líneas de discrepancia ({discrepancy.lines.length})</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200/80 bg-zinc-50/80 text-[10.5px] font-semibold text-zinc-600">
                <tr>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Factura</th>
                  <th className="p-3 text-right">Sobrante</th>
                  <th className="p-3 text-right">Faltante</th>
                  <th className="p-3">Despachador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {discrepancy.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="p-3">
                      <p className="font-semibold text-zinc-900">{line.productName}</p>
                      {line.productCode && (
                        <span className="font-mono text-[10.5px] text-zinc-400">{line.productCode}</span>
                      )}
                    </td>
                    <td className="p-3">{line.invoiceRef || "—"}</td>
                    <td className="p-3 text-right tabular-nums">{formatQuantity(line.surplusQuantity)}</td>
                    <td className="p-3 text-right tabular-nums">{formatQuantity(line.shortageQuantity)}</td>
                    <td className="p-3">{line.dispatcherName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {completionConditions && completionConditions.length > 0 && discrepancy.status === "En investigación" && (
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
            <FileText className="h-4 w-4 text-zinc-500" />
            <h4 className={sectionTitleClass}>Pendientes para completar</h4>
          </div>
          <ul className="mt-2 space-y-1.5">
            {completionConditions
              .filter((c) => !c.met)
              .map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-[12px] text-amber-800">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{c.missing}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
