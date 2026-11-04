import { Logo } from "../Logo";
import { PrintSheet } from "../print/PrintSheet";
import { padRows } from "../print/rows";
import { formatDay } from "../../lib/dates";
import { exportDiscrepancyToExcel } from "../../lib/discrepancyExcelExport";
import { DISCREPANCY_FORM_CONTROL, NOTIFICATION_ITEM } from "../../lib/discrepancies";
import { formatQuantity } from "../../lib/numbers";
import type { LoadDiscrepancy } from "../../types/discrepancies";

function formatHeaderDate(isoDateString: string | null | undefined): string {
  if (!isoDateString) return "—";
  const date = new Date(isoDateString.includes("T") ? isoDateString : `${isoDateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function Mark({ on }: { on: boolean }) {
  return <span className="inline-block w-4 text-center font-bold">{on ? "X" : "\u00A0"}</span>;
}

export interface DiscrepancyDocumentSheetProps {
  discrepancy: LoadDiscrepancy;
  onBack?: () => void;
  backLabel?: string;
  contextCodeOverride?: string;
  referenceKindLabel?: string;
}

export function DiscrepancyDocumentSheet({
  discrepancy,
  onBack,
  backLabel = "Volver",
  contextCodeOverride,
  referenceKindLabel = "Ticket",
}: DiscrepancyDocumentSheetProps) {
  const referenceCode = contextCodeOverride?.trim() || discrepancy.ticketNumber;
  const lines = padRows(discrepancy.lines ?? [], 6);
  const cell = "border border-black px-0.5 py-0.5 align-middle text-[8px] leading-tight";
  const checks = discrepancy.checks ?? [];

  return (
    <PrintSheet
      orientation="landscape"
      title={`${DISCREPANCY_FORM_CONTROL.code} · ${discrepancy.number}`}
      backLabel={backLabel}
      onBack={onBack}
      filename={`${DISCREPANCY_FORM_CONTROL.code}_${discrepancy.number}.pdf`}
      onExportExcel={() => exportDiscrepancyToExcel(discrepancy)}
    >
      <header className="avoid-break mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-4 border-2 border-black px-3 py-2">
        <Logo height={26} />
        <h1 className="text-center text-[13px] font-bold uppercase">{DISCREPANCY_FORM_CONTROL.title}</h1>
        <dl className="grid grid-cols-[auto_auto] gap-x-2 text-[9px]">
          <dt className="font-semibold">Código Documento:</dt>
          <dd>{DISCREPANCY_FORM_CONTROL.code}</dd>
          <dt className="font-semibold">Fecha de Emisión:</dt>
          <dd>{formatHeaderDate(discrepancy.createdAt)}</dd>
          <dt className="font-semibold">Revisión:</dt>
          <dd>{DISCREPANCY_FORM_CONTROL.revision}</dd>
          <dt className="font-semibold">Fecha de Revisión:</dt>
          <dd>{formatHeaderDate(discrepancy.approvedAt || discrepancy.performedAt || discrepancy.createdAt)}</dd>
        </dl>
      </header>

      <p className="mb-2 flex flex-wrap gap-x-6 text-[10px]">
        <span>
          <span className="font-semibold">Investigación:</span> <span className="font-mono">{discrepancy.number}</span>
        </span>
        <span>
          <span className="font-semibold">{referenceKindLabel}:</span>{" "}
          <span className="font-mono">{referenceCode}</span>
        </span>
        <span>
          <span className="font-semibold">Fecha:</span> {formatDay(discrepancy.createdAt.slice(0, 10))}
        </span>
        <span>
          <span className="font-semibold">Estado:</span> {discrepancy.status}
        </span>
      </p>

      <table className="discrepancy-lines-table avoid-break mb-2 w-full max-w-full border-collapse table-fixed text-[8px]">
        <colgroup>
          <col style={{ width: "7%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "4%" }} />
          <col style={{ width: "4%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "11%" }} />
        </colgroup>
        <thead>
          <tr className="bg-zinc-100 font-bold text-center">
            <th className={cell} rowSpan={2}>Factura</th>
            <th className={cell} rowSpan={2}>Cliente</th>
            <th className={cell} rowSpan={2}># Reclamo</th>
            <th className={cell} rowSpan={2}>Código</th>
            <th className={cell} rowSpan={2}>Descripción del Producto</th>
            <th className={`${cell} text-right`} rowSpan={2}>
              <span className="block leading-none">Cant.</span>Sobrante
            </th>
            <th className={`${cell} text-right`} rowSpan={2}>
              <span className="block leading-none">Cant.</span>Faltante
            </th>
            <th className={`${cell} text-center`} colSpan={2}>
              <span className="block leading-none text-[8px]">¿Cumple Para</span>Nota de Crédito?
            </th>
            <th className={cell} rowSpan={2}># N C</th>
            <th className={cell} rowSpan={2}>Despachador</th>
            <th className={cell} rowSpan={2}>Supervisor</th>
          </tr>
          <tr className="bg-zinc-100 font-bold text-center">
            <th className={`${cell} text-center`}>SI</th>
            <th className={`${cell} text-center`}>NO</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={line?.id ?? `vacia-${index}`} className="h-6">
              <td className={`${cell} font-mono break-all text-center`}>{line?.invoiceRef ?? "\u00A0"}</td>
              <td className={`${cell} break-words leading-tight`}>{line?.clientName ?? ""}</td>
              <td className={`${cell} font-mono break-all text-center`}>{line?.claimRef ?? ""}</td>
              <td className={`${cell} font-mono break-all text-center`}>{line?.productCode ?? ""}</td>
              <td className={`${cell} break-words leading-tight`}>{line?.productName ?? ""}</td>
              <td className={`${cell} text-right tabular-nums`}>
                {line && line.surplusQuantity > 0 ? formatQuantity(line.surplusQuantity) : ""}
              </td>
              <td className={`${cell} text-right tabular-nums`}>
                {line && line.shortageQuantity > 0 ? formatQuantity(line.shortageQuantity) : ""}
              </td>
              <td className={`${cell} text-center`}>
                {line ? <Mark on={line.qualifiesForCreditNote === true} /> : ""}
              </td>
              <td className={`${cell} text-center`}>
                {line ? <Mark on={line.qualifiesForCreditNote === false} /> : ""}
              </td>
              <td className={`${cell} font-mono text-center break-all`}>{line?.creditNoteNumber ?? line?.creditRequestNumber ?? ""}</td>
              <td className={`${cell} break-words leading-tight`}>{line?.dispatcherName ?? ""}</td>
              <td className={`${cell} break-words leading-tight`}>{line?.supervisorName ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="avoid-break mb-2 grid grid-cols-[1fr_1.4fr] gap-3 text-[10px]">
        <div className="flex flex-col gap-2.5">
          <div className="border-b border-black pb-1">
            <span className="font-semibold">Realizado por: </span>
            {discrepancy.performedByName ?? ""}
            {discrepancy.performedAt && (
              <span className="ml-2 text-[9px] text-zinc-600">{formatDay(discrepancy.performedAt.slice(0, 10))}</span>
            )}
          </div>
          <div className="border-b border-black pb-1">
            <span className="font-semibold">Aprobado por: </span>
            {discrepancy.status === "Aprobada" ? discrepancy.approvedByName : ""}
            {discrepancy.status === "Aprobada" && discrepancy.approvedAt && (
              <span className="ml-2 text-[9px] text-zinc-600">{formatDay(discrepancy.approvedAt.slice(0, 10))}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 min-w-0">
          <span className="font-semibold shrink-0">Nota:</span>
          <div className="min-h-[56px] flex-1 whitespace-pre-line break-words border border-black px-1.5 py-1 text-[9px] leading-tight">
            {discrepancy.note ?? ""}
          </div>
        </div>
      </section>

      <table className="avoid-break w-full border-collapse table-fixed text-[9px]">
        <colgroup>
          <col style={{ width: "4%" }} />
          <col style={{ width: "80%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "8%" }} />
        </colgroup>
        <thead>
          <tr className="bg-zinc-100 font-bold">
            <th className={`${cell} text-center`} colSpan={2}>
              Puntos de Seguridad a Evaluar
            </th>
            <th className={`${cell} text-center`}>
              <span className="block text-[8px] font-normal leading-none">Marcar X</span>
              Positivo
            </th>
            <th className={`${cell} text-center`}>Negativo</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.itemNumber}>
              <td className={`${cell} text-center tabular-nums font-semibold`}>{check.itemNumber}</td>
              <td className={`${cell} text-left break-words leading-tight px-1.5`}>
                {check.text}
                {check.itemNumber === NOTIFICATION_ITEM && !discrepancy.hasSecurityFinding && check.result === null && (
                  <span className="ml-1 text-[9px] text-zinc-500">(no aplica)</span>
                )}
              </td>
              <td className={`${cell} text-center`}>
                <Mark on={check.result === "Positivo"} />
              </td>
              <td className={`${cell} text-center`}>
                <Mark on={check.result === "Negativo"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintSheet>
  );
}
