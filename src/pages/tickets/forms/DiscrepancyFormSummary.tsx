import { AlertTriangle, Check, FileText, MinusCircle, PlusCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatDay } from "../../../lib/dates";
import type { DiscrepancyDetail } from "../../../types/discrepancies";

/** Resumen de la discrepancia (PF-FOR-291) dentro de la pestana de formularios del ticket. */
export function DiscrepancyFormSummary({ detail }: { detail: DiscrepancyDetail }) {
  const d = detail.discrepancy;
  const checks = d.checks || [];
  const positiveChecks = checks.filter((c) => c.result === "Positivo");

  return (
    <div className="space-y-4">
      {/* Security Finding Alert Banner */}
      {d.hasSecurityFinding ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-2xs flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <ShieldAlert className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide font-heading">
                Hallazgo de Seguridad Operativa Detectado
              </h4>
              <span className="inline-flex items-center rounded-md bg-amber-200/70 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                {positiveChecks.length} {positiveChecks.length === 1 ? "punto positivo" : "puntos positivos"}
              </span>
            </div>
            <p className="mt-1 text-xs text-amber-800 leading-relaxed">
              Se detectaron novedades en el chequeo de 9 puntos de la carga. Notificación oficial emitida al área de Seguridad y Logística.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/60 p-3.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
              <ShieldCheck className="size-4" />
            </div>
            <span className="font-medium text-emerald-900">
              Chequeo de seguridad conforme sin hallazgos negativos (9/9 puntos verificados).
            </span>
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-emerald-700">
            Protocolo seguro
          </span>
        </div>
      )}

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5">
          <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            No. Investigación
          </span>
          <p className="mt-1 font-mono text-sm font-bold text-zinc-900">
            {d.number}
          </p>
          <span className="text-[10.5px] text-zinc-500">
            Formato oficial PF-FOR-291
          </span>
        </div>

        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5">
          <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Fecha de Registro
          </span>
          <p className="mt-1 text-sm font-semibold text-zinc-900">
            {formatDay(d.createdAt)}
          </p>
          <span className="text-[10.5px] text-zinc-500">
            Registrado por {d.createdByName || "Sistema"}
          </span>
        </div>

        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5">
          <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Investigador / Despacho
          </span>
          <p className="mt-1 text-sm font-semibold text-zinc-900 truncate">
            {d.performedByName || "En investigación"}
          </p>
          <span className="text-[10.5px] text-zinc-500">
            {d.performedAt ? `Completada ${formatDay(d.performedAt)}` : "En curso"}
          </span>
        </div>

        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5">
          <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Dictamen & Aprobación
          </span>
          <p className="mt-1 text-sm font-semibold text-zinc-900 truncate">
            {d.approvedByName || "Pendiente"}
          </p>
          <span className="text-[10.5px] text-zinc-500">
            {d.approvedAt ? `Aprobada ${formatDay(d.approvedAt)}` : "Sin aprobación"}
          </span>
        </div>
      </div>

      {/* Operational Note / Root Cause */}
      {d.note && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500 font-heading">
            <FileText className="size-3.5 text-zinc-400" />
            <span>Nota Operativa / Causa Investigada</span>
          </div>
          <p className="mt-2.5 text-xs text-zinc-800 leading-relaxed whitespace-pre-wrap">
            {d.note}
          </p>
        </div>
      )}

      {/* Discrepancy Lines Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-2xs">
        <div className="border-b border-zinc-200/80 bg-zinc-50/60 px-4 py-2.5 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 font-heading">
            Líneas en Discrepancia ({d.lines.length})
          </h4>
          <span className="text-[11px] text-zinc-500">
            Detalle de producto y balance de despacho
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/80 text-[10.5px] uppercase font-bold text-zinc-500 border-b border-zinc-200/80">
              <tr>
                <th className="p-3">Factura</th>
                <th className="p-3">Producto</th>
                <th className="p-3">Problemática</th>
                <th className="p-3">Despachador</th>
                <th className="p-3">Apta N/C</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {d.lines.map((line) => {
                const isShortage = line.shortageQuantity > 0;
                const isSurplus = line.surplusQuantity > 0;
                return (
                  <tr key={line.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="p-3 font-mono font-medium text-zinc-800">
                      {line.invoiceRef}
                    </td>
                    <td className="p-3">
                      <p className="font-semibold text-zinc-900">{line.productName}</p>
                      {line.productCode && (
                        <span className="font-mono text-[10.5px] text-zinc-400">
                          {line.productCode}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {isShortage ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200/80 px-2.5 py-0.5 text-xs font-semibold text-brand-red">
                          <MinusCircle className="size-3" />
                          Faltante: {line.shortageQuantity} und
                        </span>
                      ) : isSurplus ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          <PlusCircle className="size-3" />
                          Sobrante: {line.surplusQuantity} und
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-xs">Sin diferencia</span>
                      )}
                    </td>
                    <td className="p-3 text-zinc-700">
                      <p className="font-medium text-zinc-800">{line.dispatcherName}</p>
                      {line.supervisorName && (
                        <span className="text-[10.5px] text-zinc-400">
                          Sup: {line.supervisorName}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {line.qualifiesForCreditNote === true ? (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10.5px] font-bold uppercase text-emerald-700">
                          Apta N/C
                        </span>
                      ) : line.qualifiesForCreditNote === false ? (
                        <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-[10.5px] text-zinc-600">
                          No apta
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 9-Point Security Checklist Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-2xs">
        <div className="border-b border-zinc-200/80 bg-zinc-50/60 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 font-heading">
              Protocolo de Chequeo de Seguridad (9 Puntos)
            </h4>
            <span className="font-mono text-[10px] text-zinc-400 font-bold">
              PF-FOR-291
            </span>
          </div>
          <span className="text-[11px] text-zinc-500">
            {positiveChecks.length > 0 ? (
              <span className="font-semibold text-amber-700">
                {positiveChecks.length} hallazgos reportados
              </span>
            ) : (
              "Todos los puntos conformes"
            )}
          </span>
        </div>
        <div className="divide-y divide-zinc-100">
          {checks.map((chk) => {
            const isPositive = chk.result === "Positivo";
            const isEvaluated = chk.result !== null && chk.result !== undefined;
            return (
              <div
                key={chk.itemNumber}
                className={`px-4 py-3 flex items-start justify-between gap-3 text-xs transition-colors ${
                  isPositive ? "bg-amber-50/50" : "hover:bg-zinc-50/50"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className={`flex size-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold ${
                    isPositive ? "bg-amber-200 text-amber-900" : "bg-zinc-100 text-zinc-600"
                  }`}>
                    {String(chk.itemNumber).padStart(2, "0")}
                  </span>
                  <p className="text-xs text-zinc-700 leading-relaxed">
                    {chk.text}
                  </p>
                </div>
                <div className="shrink-0">
                  {isPositive ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                      <AlertTriangle className="size-3 text-amber-600" />
                      Positivo
                    </span>
                  ) : isEvaluated ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                      <Check className="size-3 text-emerald-600" strokeWidth={2.5} />
                      Negativo
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-400">Sin evaluar</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
