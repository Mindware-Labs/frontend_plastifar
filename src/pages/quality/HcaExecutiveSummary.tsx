import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Layers,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatDay } from "../../lib/dates";
import { describeDue, isPlanItemOverdue, isSheetOverdue } from "../../lib/quality";
import type { ActionPlanItem, CorrectiveActionSheet } from "../../types/quality";
import type { ClosureCondition } from "../../api/quality";
import { HcaStatusBadge, PlanItemStatusBadge } from "./StatusBadges";

interface HcaExecutiveSummaryProps {
  sheet: CorrectiveActionSheet;
  planItems?: ActionPlanItem[];
  closureConditions?: ClosureCondition[];
}

export function HcaExecutiveSummary({
  sheet,
  planItems = [],
  closureConditions = [],
}: HcaExecutiveSummaryProps) {
  const kpiLabelClass = "font-heading text-[10px] font-semibold text-zinc-500 uppercase tracking-wider";
  const sectionTitleClass = "font-heading text-[11px] font-semibold text-zinc-700 uppercase tracking-wider";
  const fieldLabelClass = "text-[10.5px] font-medium text-zinc-500";

  const isClosed = sheet.status === "Cerrada";
  const overdue = isSheetOverdue(sheet);

  return (
    <div className="space-y-4 text-xs">
      {/* 1. Header Card / Seal */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-4.5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center justify-start gap-2">
              <h3 className="text-base font-bold text-zinc-900">Acción Correctiva (HCA)</h3>
              <span className="font-mono text-sm font-semibold text-brand-red bg-brand-red/5 px-2 py-0.5 rounded border border-brand-red/20">
                {sheet.number}
              </span>
              <HcaStatusBadge status={sheet.status} overdue={overdue} />
            </div>
            <p className="mt-1.5 text-[11.5px] text-zinc-500">
              Formulario oficial de no conformidad y acción correctiva (PF-FOR-109)
              {sheet.ticketId && (
                <>
                  {" "}· Vinculado al ticket{" "}
                  <Link
                    to="/tickets"
                    className="font-mono font-medium text-ink hover:text-brand-red transition-colors"
                  >
                    #{sheet.ticketId}
                  </Link>
                </>
              )}
            </p>
          </div>

          {isClosed && (
            <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/50 px-3 py-1.5 text-right">
              <span className="block font-heading text-[10px] font-semibold text-emerald-800 uppercase">Cerrada</span>
              <span className="text-[11px] text-emerald-700">
                {sheet.closedAt ? formatDay(sheet.closedAt.slice(0, 10)) : ""}
                {sheet.closedByName ? ` · ${sheet.closedByName}` : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Overdue banner if applicable */}
      {overdue && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[12px] text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Fecha de compromiso vencida desde el <strong>{formatDay(sheet.dueDate)}</strong> ({describeDue(sheet.dueDate)}).
          </span>
        </div>
      )}

      {/* 3. KPI Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Código HCA</span>
          <p className="mt-1 font-mono text-sm font-bold text-zinc-900">{sheet.number}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Fecha Detección</span>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{formatDay(sheet.detectedAt.slice(0, 10))}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Compromiso</span>
          <p className={`mt-1 text-sm font-semibold ${overdue ? "text-red-600" : "text-zinc-900"}`}>
            {formatDay(sheet.dueDate)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Acciones Plan</span>
          <p className="mt-1 text-sm font-bold text-zinc-900">{planItems.length}</p>
        </div>
      </div>

      {/* 4. Contexto Operativo */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
          <Building2 className="h-4 w-4 text-zinc-500" />
          <h4 className={sectionTitleClass}>Contexto Operativo</h4>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className={fieldLabelClass}>Cliente</span>
            <p className="mt-0.5 font-semibold text-zinc-900">{sheet.clientName}</p>
          </div>
          <div>
            <span className={fieldLabelClass}>Línea de Producto</span>
            <p className="mt-0.5 font-medium text-zinc-900">{sheet.productLineName}</p>
          </div>
          <div>
            <span className={fieldLabelClass}>Producto Concreto</span>
            <p className="mt-0.5 font-medium text-zinc-900">
              {sheet.productName
                ? `${sheet.productName}${sheet.productCode ? ` (${sheet.productCode})` : ""}`
                : "No especificado"}
            </p>
          </div>
          <div>
            <span className={fieldLabelClass}>Planta</span>
            <p className="mt-0.5 font-medium text-zinc-900">{sheet.plantName || "No especificada"}</p>
          </div>
          <div>
            <span className={fieldLabelClass}>Responsable de la HCA</span>
            <p className="mt-0.5 font-medium text-zinc-900">{sheet.responsibleName}</p>
          </div>
          <div>
            <span className={fieldLabelClass}>Elaborado por</span>
            <p className="mt-0.5 font-medium text-zinc-900">{sheet.createdByName || "—"}</p>
          </div>
        </div>
      </div>

      {/* 5. Hecho & Acción Inmediata */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs space-y-3">
        <div>
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
            <ClipboardList className="h-4 w-4 text-zinc-500" />
            <h4 className={sectionTitleClass}>Hecho (No Conformidad)</h4>
          </div>
          <p className="mt-2 text-zinc-800 leading-relaxed whitespace-pre-line bg-zinc-50 border border-zinc-200/70 rounded-lg p-3">
            {sheet.description}
          </p>
        </div>

        {sheet.immediateAction && (
          <div>
            <span className={fieldLabelClass}>Acción Inmediata de Contención</span>
            <p className="mt-1 text-zinc-700 leading-relaxed bg-zinc-50 border border-zinc-200/70 rounded-lg p-2.5">
              {sheet.immediateAction}
            </p>
          </div>
        )}
      </div>

      {/* 6. Causas Raíz */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5 mb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-zinc-500" />
            <h4 className={sectionTitleClass}>Causas Raíz Identificadas ({sheet.causes.length})</h4>
          </div>
        </div>
        {sheet.causes.length === 0 ? (
          <p className="text-zinc-400 italic py-1">No se han registrado causas aún.</p>
        ) : (
          <div className="space-y-1.5">
            {sheet.causes.map((c, i) => (
              <div key={c.id} className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-200 font-mono text-[10px] font-bold text-zinc-700">
                  {i + 1}
                </span>
                <span className="text-zinc-800 leading-tight">{c.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7. Plan de Acción */}
      {planItems.length > 0 && (
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5 mb-2.5">
            <ShieldCheck className="h-4 w-4 text-zinc-500" />
            <h4 className={sectionTitleClass}>Plan de Acción ({planItems.length})</h4>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full text-left text-[11.5px] border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-zinc-200 text-zinc-500 uppercase text-[10px] font-semibold">
                  <th className="py-2 px-2.5">Acción</th>
                  <th className="py-2 px-2.5">Responsable</th>
                  <th className="py-2 px-2.5">Vencimiento</th>
                  <th className="py-2 px-2.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {planItems.map((item) => {
                  const itemOverdue = isPlanItemOverdue(item);
                  return (
                    <tr key={item.id}>
                      <td className="py-2 px-2.5 font-medium text-zinc-900 max-w-[220px] truncate">
                        {item.description}
                      </td>
                      <td className="py-2 px-2.5 text-zinc-600 truncate max-w-[130px]">{item.responsibleName}</td>
                      <td className="py-2 px-2.5 whitespace-nowrap tabular-nums">
                        <span className={itemOverdue ? "text-red-600 font-medium" : "text-zinc-600"}>
                          {formatDay(item.dueDate)}
                        </span>
                      </td>
                      <td className="py-2 px-2.5">
                        <PlanItemStatusBadge status={item.status} overdue={itemOverdue} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. Verificación de Eficacia & Cierre */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
        <h4 className={`${sectionTitleClass} border-b border-zinc-100 pb-2 mb-2.5`}>
          Eficacia y Condiciones de Cierre
        </h4>

        {sheet.effectivenessCheckAt ? (
          <div className="mb-3 rounded-lg bg-emerald-50/60 border border-emerald-200 p-2.5 text-[12px]">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Verificada el {formatDay(sheet.effectivenessCheckAt.slice(0, 10))}</span>
            </div>
            {sheet.effectivenessNotes && (
              <p className="mt-1 text-emerald-800 text-[11.5px]">{sheet.effectivenessNotes}</p>
            )}
          </div>
        ) : (
          <div className="mb-3 rounded-lg bg-zinc-50 border border-zinc-200/80 p-2.5 text-[11.5px] text-zinc-500 italic">
            Pendiente de verificación de eficacia.
          </div>
        )}

        {closureConditions.length > 0 && (
          <div className="space-y-1.5">
            {closureConditions.map((cond) => (
              <div
                key={cond.id}
                className={`flex items-start gap-2 rounded-lg border p-2 text-[11.5px] ${
                  cond.met
                    ? "border-emerald-200 bg-emerald-50/40 text-emerald-900"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700"
                }`}
              >
                {cond.met ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-zinc-400 mt-0.5" />
                )}
                <div>
                  <span className="font-medium">{cond.label}</span>
                  {!cond.met && cond.missing && (
                    <p className="text-[10.5px] text-amber-700 mt-0.5">{cond.missing}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
