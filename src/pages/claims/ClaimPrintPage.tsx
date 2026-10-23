import { useParams } from "react-router-dom";
import { claimsApi } from "../../api/claims";
import { PrintCell, PrintPending, PrintSheet } from "../../components/print/PrintSheet";
import { padRows } from "../../components/print/rows";
import { usePrintRecord } from "../../components/print/usePrintRecord";
import { CLAIM_FORM_CONTROL, yesNo } from "../../lib/claims";
import { formatDay } from "../../lib/dates";
import { formatAmount, formatPrice, formatQuantity } from "../../lib/numbers";
import {
  CLAIM_AREAS,
  CLAIM_DEFECT_MOMENTS,
  CLAIM_REASONS,
} from "../../types/claims";

/** Casilla dibujada, como en la plantilla: ☒ marcada, ☐ vacía. */
function Box({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span
        aria-hidden
        className={`inline-block h-3 w-3 border border-black align-middle ${checked ? "bg-black" : "bg-white"}`}
      />
      <span className="sr-only">{checked ? "Marcado:" : "Sin marcar:"}</span>
      {label}
    </span>
  );
}

/**
 * RF-R9: la reclamación con la distribución y el control documental del
 * PF-FOR-034, en una página propia con hoja de estilos de impresión y sin
 * dependencias nuevas. Fuera del armazón de la aplicación a propósito: la
 * barra lateral no se imprime.
 */
export function ClaimPrintPage() {
  const { id } = useParams();
  const claimId = Number(id);
  const { data: claim, error } = usePrintRecord(claimId, async (key) => (await claimsApi.get(key)).claim, {
    documentTitle: (record) => `${CLAIM_FORM_CONTROL.code} · ${record.ticketNumber}`,
    failed: "No se pudo cargar la reclamación.",
  });
  if (claim === null) return <PrintPending error={error} />;

  // El papel trae tres renglones; una reclamación larga sigue en más páginas (sección 15).
  const lines = padRows(claim.lines, 3);
  const money = (value: number) => (claim.currency ? formatAmount(value, claim.currency) : formatQuantity(value));

  return (
    <PrintSheet orientation="portrait">
      {/* Cabecera: A1:I1 y F3:F4 */}
      <header className="avoid-break mb-2 grid grid-cols-[1fr_auto] items-end gap-4 border-b-2 border-black pb-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide">Plastifar · Sistema de gestión de calidad</p>
          <h1 className="text-[16px] font-bold uppercase">{CLAIM_FORM_CONTROL.title}</h1>
        </div>
        <div className="text-right">
          <p>
            <span className="font-semibold">Fecha de la Reclamación:</span> {formatDay(claim.claimDate)}
          </p>
          <p>
            <span className="font-semibold">Código:</span> <span className="font-mono">{claim.ticketNumber}</span>
          </p>
        </div>
      </header>

      {/* I. Información General: A5, A6:I7 */}
      <section className="avoid-break mb-2">
        <h2 className="bg-zinc-200 px-1.5 py-0.5 text-[11px] font-bold">I. Información General</h2>
        <div className="grid grid-cols-3">
          <PrintCell label="Empresa:">{claim.clientName}</PrintCell>
          <PrintCell label="Contacto:">{claim.contactName ?? ""}</PrintCell>
          <PrintCell label="País:">{claim.country ?? ""}</PrintCell>
          <PrintCell label="Teléfonos:" className="col-span-3">
            {[claim.contactPhone, claim.clientPhone].filter(Boolean).join(" · ")}
          </PrintCell>
        </div>
      </section>

      {/* II. Información General sobre la Reclamación: A9, A10:H38 */}
      <section className="avoid-break mb-2">
        <h2 className="bg-zinc-200 px-1.5 py-0.5 text-[11px] font-bold">II. Información General sobre la Reclamación:</h2>
        <div className="grid grid-cols-2 border border-black">
          <div className="border-r border-black p-1.5">
            <p className="font-semibold">Planta Involucrada:</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {claim.plants.map((plant) => (
                <Box key={plant.id} checked label={plant.name} />
              ))}
            </div>
          </div>
          <div className="p-1.5">
            <p className="font-semibold">Motivo del Reclamo:</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {CLAIM_REASONS.map((reason) => (
                <Box key={reason} checked={claim.reason === reason} label={reason} />
              ))}
            </div>
            {claim.reason === "Otros" && (
              <p className="mt-1">
                <span className="font-semibold">Otros (especifique):</span> {claim.reasonOther}
              </p>
            )}
          </div>
          <div className="col-span-2 border-t border-black p-1.5">
            <span className="font-semibold">Área Afectada: </span>
            <span className="ml-2 inline-flex gap-4">
              {CLAIM_AREAS.map((area) => (
                <Box key={area} checked={claim.affectedAreas.includes(area)} label={area} />
              ))}
            </span>
          </div>
        </div>

        <div className="mt-1 grid grid-cols-3">
          <PrintCell label="Fecha de Producción (# Lote):">{claim.productionLot ?? ""}</PrintCell>
          <PrintCell label="Factura:">{claim.invoiceRef ?? ""}</PrintCell>
          <PrintCell label="Número de PO:">{claim.poNumber ?? ""}</PrintCell>
        </div>

        <table className="mt-1 w-full border-collapse">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border border-black px-1 py-0.5 text-left">Producto/s</th>
              <th className="border border-black px-1 py-0.5 text-left">Código/s</th>
              <th className="border border-black px-1 py-0.5 text-right">Cantidad de Unidades Compradas</th>
              <th className="border border-black px-1 py-0.5 text-right">Cantidad defectuosa</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line?.id ?? `vacia-${index}`}>
                <td className="border border-black px-1 py-0.5">{line?.productName ?? " "}</td>
                <td className="border border-black px-1 py-0.5 font-mono">{line?.productCode ?? ""}</td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">
                  {line ? formatQuantity(line.unitsPurchased) : ""}
                </td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">
                  {line ? formatQuantity(line.defectiveQuantity) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-1 grid grid-cols-2">
          <PrintCell label="Cantidad de Unidades a Retornar:">{formatQuantity(claim.unitsToReturn)}</PrintCell>
          <div className="border border-black px-1.5 py-1">
            <span className="font-semibold">Defecto Identificado Durante: </span>
            <span className="ml-2 inline-flex gap-4">
              {CLAIM_DEFECT_MOMENTS.map((moment) => (
                <Box key={moment} checked={claim.defectFoundDuring === moment} label={`${moment}:`} />
              ))}
            </span>
          </div>
        </div>

        {/* A34:H37: Facturados / Recibidos / Dif / Precio / Total */}
        <table className="mt-1 w-full border-collapse">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border border-black px-1 py-0.5 text-left">Producto</th>
              <th className="border border-black px-1 py-0.5 text-right">Facturados</th>
              <th className="border border-black px-1 py-0.5 text-right">Recibidos</th>
              <th className="border border-black px-1 py-0.5 text-right">Dif</th>
              <th className="border border-black px-1 py-0.5 text-right">Precio</th>
              <th className="border border-black px-1 py-0.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line?.id ?? `vacia-${index}`}>
                <td className="border border-black px-1 py-0.5">{line?.productCode ?? " "}</td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">{line ? formatQuantity(line.invoicedQuantity) : ""}</td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">{line ? formatQuantity(line.receivedQuantity) : ""}</td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">{line ? formatQuantity(line.difference) : ""}</td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">{line ? formatPrice(line.unitPrice) : ""}</td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">{line ? money(line.lineTotal) : ""}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} className="border border-black px-1 py-0.5 text-right font-semibold">
                Total de la reclamacion:
              </td>
              <td className="border border-black px-1 py-0.5 text-right font-bold tabular-nums">{money(claim.totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* III. Descripción: A39, filas 40-43, A45 */}
      <section className="avoid-break mb-2">
        <h2 className="bg-zinc-200 px-1.5 py-0.5 text-[11px] font-bold">III. Descripción de la Reclamación</h2>
        <div className="min-h-[72px] whitespace-pre-line border border-black px-1.5 py-1">{claim.description}</div>
        <div className="border border-t-0 border-black px-1.5 py-1">
          <span className="font-semibold">Comentarios: </span>
          <span className="whitespace-pre-line">{claim.comments ?? ""}</span>
        </div>
        <div className="mt-1 grid grid-cols-3">
          <PrintCell label="Nombre de quién recibe esta Reclamación:">{claim.receivedByName}</PrintCell>
          <PrintCell label="Fecha:">{formatDay(claim.receivedAt)}</PrintCell>
          <PrintCell label="Firma:" />
        </div>
      </section>

      {/* IV. Tratamiento: A51:A62 */}
      <section className="avoid-break mb-2">
        <h2 className="bg-zinc-200 px-1.5 py-0.5 text-[11px] font-bold">
          IV. Tratamiento de la Reclamación{" "}
          <span className="font-normal italic">· Para uso exclusivo del Depto. de Calidad</span>
        </h2>
        <div className="border border-black">
          <div className="border-b border-black px-1.5 py-1">
            <span className="font-semibold">Fecha de primer contacto con el cliente: </span>
            {claim.firstCustomerContactAt ? formatDay(claim.firstCustomerContactAt) : ""}
          </div>
          <div className="min-h-[40px] border-b border-black px-1.5 py-1">
            <span className="font-semibold">Primera respuesta como corrección: </span>
            <span className="whitespace-pre-line">{claim.firstResponseCorrection ?? ""}</span>
          </div>
          <div className="border-b border-black px-1.5 py-1">
            <span className="font-semibold">Se requiere acción correctiva: </span>
            <span className="ml-2 inline-flex gap-4">
              <Box checked={claim.requiresCorrectiveAction === true} label="Si" />
              <Box checked={claim.requiresCorrectiveAction === false} label="No" />
            </span>
            {claim.hcaNumber && <span className="ml-4 font-mono">HCA {claim.hcaNumber}</span>}
          </div>
          <div className="min-h-[40px] border-b border-black px-1.5 py-1">
            <span className="font-semibold">Resultados del análisis Causa Raíz de la reclamación: </span>
            <span className="whitespace-pre-line">{claim.rootCauseAnalysis ?? ""}</span>
          </div>
          <div className="min-h-[40px] border-b border-black px-1.5 py-1">
            <span className="font-semibold">Descripción de las acciones correctivas y/o preventivas tomadas: </span>
            <span className="whitespace-pre-line">{claim.correctiveActions ?? ""}</span>
          </div>
          <div className="grid grid-cols-3 border-b border-black">
            <div className="border-r border-black px-1.5 py-1">
              <span className="font-semibold">Fecha de cierre de la reclamación: </span>
              {claim.closedAt ? formatDay(claim.closedAt.slice(0, 10)) : ""}
            </div>
            <div className="border-r border-black px-1.5 py-1">
              <span className="font-semibold">Tiempo de respuesta a la queja/reclamación: </span>
              {claim.responseDays !== null ? `${claim.responseDays} días` : ""}
            </div>
            <div className="px-1.5 py-1">
              <span className="font-semibold">¿Cliente Satisfecho? </span>
              <span className="ml-1 inline-flex gap-3">
                <Box checked={claim.customerSatisfied === true} label="Si" />
                <Box checked={claim.customerSatisfied === false} label="No" />
              </span>
              <span className="sr-only">{yesNo(claim.customerSatisfied)}</span>
            </div>
          </div>
          <div className="min-h-[32px] border-b border-black px-1.5 py-1">
            <span className="font-semibold">Observaciones: </span>
            <span className="whitespace-pre-line">{claim.observations ?? ""}</span>
          </div>
          <div className="px-1.5 py-1">
            <span className="font-semibold">Nombre y firma del responsable del cierre: </span>
            {claim.closedByName ?? ""}
          </div>
        </div>
      </section>

      {/* Pie: control documental */}
      <footer className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-t border-black pt-1 text-[9px]">
        <span className="font-semibold">{CLAIM_FORM_CONTROL.code}</span>
        <span>Revisión No.: {CLAIM_FORM_CONTROL.revision}</span>
        <span>Sustituye a: {CLAIM_FORM_CONTROL.replaces}</span>
        <span>Ultima Revisión: {CLAIM_FORM_CONTROL.lastRevision}</span>
        <span>Fecha de Creación: {CLAIM_FORM_CONTROL.createdOn}</span>
        <span>Emitido por: {claim.receivedByName}</span>
      </footer>
    </PrintSheet>
  );
}
