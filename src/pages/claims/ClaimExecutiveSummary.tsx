import {
  AlertTriangle,
  Building2,
  Check,
  ClipboardList,
  FileText,
  Info,
  Package,
  Stethoscope,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { formatDay, formatInstant } from "../../lib/dates";
import { formatAmount, formatPrice, formatQuantity } from "../../lib/numbers";
import { topicRequiresOther, type ClaimClosureCondition, type CustomerClaim } from "../../types/claims";
import { ClaimStatusBadge } from "./ClaimStatusBadge";

interface ClaimExecutiveSummaryProps {
  claim: CustomerClaim;
  closureConditions?: ClaimClosureCondition[];
  canOpenHca?: boolean;
  onStartHca?: () => void;
  isOpeningHca?: boolean;
}

export function ClaimExecutiveSummary({
  claim,
  closureConditions,
  canOpenHca,
  onStartHca,
  isOpeningHca,
}: ClaimExecutiveSummaryProps) {
  const kpiLabelClass = "font-heading text-[10px] font-semibold text-zinc-500";
  const sectionTitleClass = "font-heading text-[11px] font-semibold text-zinc-700";
  const fieldLabelClass = "text-[10.5px] font-medium text-zinc-500";

  const reasonLabel = topicRequiresOther(claim.reason) && claim.reasonOther
    ? `${claim.reason} (${claim.reasonOther})`
    : claim.reason;

  const isClosed = claim.status === "Cerrada";

  return (
    <div className="space-y-4 text-xs">
      {/** 1. Header Card / Seal */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-4.5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center justify-start gap-2">
              <h3 className="text-base font-bold text-zinc-900">Reclamación de clientes</h3>
              <ClaimStatusBadge status={claim.status} />
              {claim.hcaNumber && (
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-700">
                  <ClipboardList className="h-3 w-3 text-zinc-400" />
                  {claim.hcaNumber}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11.5px] text-zinc-500">
              Formulario oficial de reclamación vinculado al ticket{" "}
              <Link
                to={`/tickets/${claim.ticketId}`}
                className="font-mono font-medium text-ink hover:text-brand-red transition-colors"
              >
                #{claim.ticketNumber}
              </Link>
              {claim.ticketSubject ? ` · ${claim.ticketSubject}` : ""} · Plastifar S.A.
            </p>
          </div>

          {claim.closedAt && (
            <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/50 px-3 py-1.5 text-right">
              <span className="block font-heading text-[10px] font-semibold text-emerald-800">
                Caso cerrado
              </span>
              <span className="text-[11px] text-emerald-700">
                {formatInstant(claim.closedAt)} {claim.closedByName ? `por ${claim.closedByName}` : ""}
                {claim.responseDays !== null ? ` · ${claim.responseDays}d de respuesta` : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {/** 2. Four KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Código de reclamación</span>
          <p className="mt-1 font-mono text-sm font-bold text-zinc-900">{claim.ticketNumber}</p>
        </div>

        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Fecha del caso</span>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{formatDay(claim.claimDate)}</p>
          <span className="block truncate text-[10.5px] text-zinc-500" title={reasonLabel}>
            Motivo: {reasonLabel}
          </span>
        </div>

        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Recepción</span>
          <p className="mt-1 truncate text-sm font-semibold text-zinc-900" title={claim.receivedByName}>
            {claim.receivedByName}
          </p>
          <span className="text-[10.5px] text-zinc-500">Recibida {formatDay(claim.receivedAt)}</span>
        </div>

        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-3xs">
          <span className={kpiLabelClass}>Monto total</span>
          <p className="mt-1 text-sm font-bold tabular-nums text-brand-red">
            {claim.currency ? formatAmount(claim.totalAmount, claim.currency) : formatQuantity(claim.totalAmount)}
          </p>
          <span className="text-[10.5px] text-zinc-500">
            {claim.invoiceRef ? `Factura ${claim.invoiceRef}` : "Sin factura asociada"}
          </span>
        </div>
      </div>

      {/** 3. General Information Card */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
          <Building2 className="h-4 w-4 text-zinc-500" />
          <h4 className={sectionTitleClass}>
            I. Información general del cliente y la reclamación
          </h4>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <div>
            <span className={fieldLabelClass}>Cliente / empresa</span>
            <p className="mt-0.5 font-semibold text-zinc-900">
              {claim.clientName}
              {claim.clientCode && <span className="ml-1.5 font-mono text-[11px] font-normal text-zinc-400">({claim.clientCode})</span>}
            </p>
          </div>

          <div>
            <span className={fieldLabelClass}>Contacto</span>
            <p className="mt-0.5 text-zinc-800">{claim.contactName || "—"}</p>
          </div>

          <div>
            <span className={fieldLabelClass}>Teléfonos</span>
            <p className="mt-0.5 text-zinc-800 tabular-nums">
              {[claim.contactPhone, claim.clientPhone].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>

          <div>
            <span className={fieldLabelClass}>Plantas involucradas</span>
            <p className="mt-0.5 font-medium text-zinc-800">
              {claim.plants.map((p) => p.name).join(", ") || "—"}
            </p>
          </div>

          <div>
            <span className={fieldLabelClass}>Áreas afectadas</span>
            <p className="mt-0.5 text-zinc-800">{claim.affectedAreas.join(", ") || "—"}</p>
          </div>

          <div>
            <span className={fieldLabelClass}>Lote de producción</span>
            <p className="mt-0.5 font-mono font-medium text-zinc-800">{claim.productionLot || "—"}</p>
          </div>

          <div>
            <span className={fieldLabelClass}>Factura de referencia</span>
            <p className="mt-0.5 text-zinc-800">{claim.invoiceRef || "—"}</p>
          </div>

          <div>
            <span className={fieldLabelClass}>Orden de compra (PO)</span>
            <p className="mt-0.5 text-zinc-800">{claim.poNumber || "—"}</p>
          </div>

          <div>
            <span className={fieldLabelClass}>Unidades a retornar</span>
            <p className="mt-0.5 font-medium tabular-nums text-zinc-900">{formatQuantity(claim.unitsToReturn)}</p>
          </div>

          {claim.defectFoundDuring && (
            <div className="col-span-2 sm:col-span-3">
              <span className={fieldLabelClass}>Defecto identificado durante</span>
              <p className="mt-0.5 text-zinc-800">{claim.defectFoundDuring}</p>
            </div>
          )}
        </div>
      </div>

      {/** 4. Description and Comments */}
      {claim.description?.trim() && (
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
            <FileText className="h-4 w-4 text-zinc-500" />
            <h4 className={sectionTitleClass}>II. Descripción de la reclamación</h4>
          </div>
          <p className="mt-2.5 whitespace-pre-wrap leading-relaxed text-zinc-800">
            {claim.description}
          </p>
        </div>
      )}

      {claim.comments?.trim() && (
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
            <Info className="h-4 w-4 text-zinc-500" />
            <h4 className={sectionTitleClass}>III. Comentarios adicionales</h4>
          </div>
          <p className="mt-2.5 whitespace-pre-wrap leading-relaxed text-zinc-800">
            {claim.comments.trim()}
          </p>
        </div>
      )}

      {/** 5. Claimed Products Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs">
        <div className="flex items-center justify-between border-b border-zinc-200/80 bg-zinc-50/70 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-zinc-500" />
            <h4 className={sectionTitleClass}>Productos reclamados ({claim.lines.length})</h4>
          </div>
          <span className="text-[11px] text-zinc-500">Cantidades, defectos y montos por línea</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200/80 bg-zinc-50/80 text-[10.5px] font-semibold text-zinc-600">
              <tr>
                <th className="p-3 font-semibold">Producto</th>
                <th className="p-3 text-right font-semibold">Compradas</th>
                <th className="p-3 text-right font-semibold">Defectuosas</th>
                <th className="p-3 text-right font-semibold">Facturado</th>
                <th className="p-3 text-right font-semibold">Recibido</th>
                <th className="p-3 text-right font-semibold">Dif.</th>
                <th className="p-3 text-right font-semibold">Precio</th>
                <th className="p-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {claim.lines.map((line) => (
                <tr key={line.id} className="transition-colors hover:bg-zinc-50/60">
                  <td className="p-3">
                    <p className="font-semibold text-zinc-900">{line.productName}</p>
                    {line.productCode && (
                      <span className="font-mono text-[10.5px] text-zinc-400">{line.productCode}</span>
                    )}
                  </td>
                  <td className="p-3 text-right tabular-nums">{formatQuantity(line.unitsPurchased)}</td>
                  <td className="p-3 text-right font-medium text-brand-red tabular-nums">{formatQuantity(line.defectiveQuantity)}</td>
                  <td className="p-3 text-right tabular-nums">{formatQuantity(line.invoicedQuantity)}</td>
                  <td className="p-3 text-right tabular-nums">{formatQuantity(line.receivedQuantity)}</td>
                  <td className={`p-3 text-right tabular-nums ${line.difference < 0 ? "font-semibold text-amber-700" : ""}`}>
                    {formatQuantity(line.difference)}
                  </td>
                  <td className="p-3 text-right tabular-nums text-zinc-600">{formatPrice(line.unitPrice)}</td>
                  <td className="p-3 text-right font-semibold tabular-nums text-zinc-900">
                    {claim.currency ? formatAmount(line.lineTotal, claim.currency) : formatQuantity(line.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-zinc-200 bg-zinc-50/60 font-semibold text-zinc-900">
              <tr>
                <td className="p-3">Total Reclamación</td>
                <td colSpan={6} />
                <td className="p-3 text-right font-bold text-brand-red tabular-nums text-[13px]">
                  {claim.currency ? formatAmount(claim.totalAmount, claim.currency) : formatQuantity(claim.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/** 6. Section IV: Quality Treatment */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-brand-red" />
            <h4 className={sectionTitleClass}>
              IV. Tratamiento de la reclamación (Depto. Calidad)
            </h4>
          </div>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10.5px] font-semibold text-zinc-600">
            Exclusivo Calidad
          </span>
        </div>

        <div className="mt-3.5 space-y-3.5">
          <div>
            <span className={fieldLabelClass}>
              Primera respuesta como corrección
            </span>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-zinc-50/70 p-3 leading-relaxed text-zinc-800 border border-zinc-100">
              {claim.firstResponseCorrection || (
                <span className="italic text-zinc-400">Sin respuesta registrada todavía.</span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
              <span className={fieldLabelClass}>
                ¿Se requiere acción correctiva?
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className={`font-semibold ${claim.requiresCorrectiveAction ? "text-brand-red" : "text-zinc-700"}`}>
                  {claim.requiresCorrectiveAction === true ? "Sí" : claim.requiresCorrectiveAction === false ? "No" : "Sin definir"}
                </span>

                {claim.hcaNumber ? (
                  <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-700 border border-zinc-200">
                    <ClipboardList className="h-3 w-3 text-zinc-400" />
                    HCA {claim.hcaNumber}
                  </span>
                ) : claim.requiresCorrectiveAction === true && canOpenHca && !isClosed && onStartHca ? (
                  <Button size="sm" variant="secondary" onClick={onStartHca} isLoading={isOpeningHca}>
                    <ClipboardList className="h-3 w-3 mr-1" />
                    Abrir HCA
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
              <span className={fieldLabelClass}>
                ¿Cliente satisfecho con la respuesta?
              </span>
              <p className="mt-1 font-semibold text-zinc-800">
                {claim.customerSatisfied === true ? "Sí" : claim.customerSatisfied === false ? "No" : "Sin responder"}
              </p>
            </div>
          </div>

          {claim.rootCauseAnalysis && (
            <div>
              <span className={fieldLabelClass}>
                Análisis de causa raíz
              </span>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-zinc-50/70 p-3 leading-relaxed text-zinc-800 border border-zinc-100">
                {claim.rootCauseAnalysis}
              </p>
            </div>
          )}

          {claim.correctiveActions && (
            <div>
              <span className={fieldLabelClass}>
                Acciones correctivas y/o preventivas
              </span>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-zinc-50/70 p-3 leading-relaxed text-zinc-800 border border-zinc-100">
                {claim.correctiveActions}
              </p>
            </div>
          )}

          {claim.observations && (
            <div>
              <span className={fieldLabelClass}>
                Observaciones finales
              </span>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-zinc-50/70 p-3 leading-relaxed text-zinc-800 border border-zinc-100">
                {claim.observations}
              </p>
            </div>
          )}

          {!isClosed && closureConditions && closureConditions.length > 0 && (
            <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3.5">
              <span className={`${fieldLabelClass} font-heading`}>
                Condiciones pendientes para cerrar la reclamación
              </span>
              <ul className="mt-2 space-y-1.5">
                {closureConditions.map((cond) => (
                  <li
                    key={cond.id}
                    className={`flex items-start gap-2 text-[12px] ${cond.met ? "text-zinc-600" : "text-amber-800"}`}
                  >
                    {cond.met ? (
                      <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-medium">{cond.label}</span>
                      {!cond.met && <p className="text-[11px] text-amber-700">{cond.missing}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
