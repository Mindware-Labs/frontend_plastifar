import { useParams } from "react-router-dom";
import { discrepanciesApi } from "../../api/discrepancies";
import { Logo } from "../../components/Logo";
import { PrintPending, PrintSheet } from "../../components/print/PrintSheet";
import { padRows } from "../../components/print/rows";
import { usePrintRecord } from "../../components/print/usePrintRecord";
import { formatDay } from "../../lib/dates";
import { DISCREPANCY_FORM_CONTROL, NOTIFICATION_ITEM } from "../../lib/discrepancies";
import { formatQuantity } from "../../lib/numbers";

/** Casilla con «X», como en la plantilla. */
function Mark({ on }: { on: boolean }) {
  return <span className="inline-block w-4 text-center font-bold">{on ? "X" : " "}</span>;
}

/**
 * RF-D8: la investigación con la distribución del PF-FOR-291 en horizontal,
 * el control documental y las dos líneas de firma. Fuera del armazón para
 * que la barra lateral no salga en el papel.
 */
export function DiscrepancyPrintPage() {
  const { id } = useParams();
  const discrepancyId = Number(id);
  const { data: discrepancy, error } = usePrintRecord(
    discrepancyId,
    async (key) => (await discrepanciesApi.get(key)).discrepancy,
    {
      documentTitle: (record) => `${DISCREPANCY_FORM_CONTROL.code} · ${record.number}`,
      failed: "No se pudo cargar la investigación.",
    },
  );
  if (discrepancy === null) return <PrintPending error={error} />;

  const lines = padRows(discrepancy.lines, 6);
  const cell = "border border-black px-1.5 py-1 align-top";

  return (
    <PrintSheet orientation="landscape">
      {/* Cabecera: filas 1 a 3, título y control documental */}
      <header className="avoid-break mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-4 border-2 border-black px-3 py-2">
        <Logo height={26} />
        <h1 className="text-center text-[14px] font-bold uppercase">{DISCREPANCY_FORM_CONTROL.title}</h1>
        <dl className="grid grid-cols-[auto_auto] gap-x-2 text-[9px]">
          <dt className="font-semibold">Código Documento:</dt>
          <dd>{DISCREPANCY_FORM_CONTROL.code}</dd>
          <dt className="font-semibold">Fecha de Emisión:</dt>
          <dd>{DISCREPANCY_FORM_CONTROL.issuedOn}</dd>
          <dt className="font-semibold">Revisión:</dt>
          <dd>{DISCREPANCY_FORM_CONTROL.revision}</dd>
          <dt className="font-semibold">Fecha de Revision:</dt>
          <dd>{DISCREPANCY_FORM_CONTROL.revisedOn}</dd>
        </dl>
      </header>

      <p className="mb-2 flex flex-wrap gap-x-6 text-[10px]">
        <span>
          <span className="font-semibold">Investigación:</span> <span className="font-mono">{discrepancy.number}</span>
        </span>
        <span>
          <span className="font-semibold">Ticket:</span> <span className="font-mono">{discrepancy.ticketNumber}</span>
        </span>
        <span>
          <span className="font-semibold">Fecha:</span> {formatDay(discrepancy.createdAt.slice(0, 10))}
        </span>
        <span>
          <span className="font-semibold">Estado:</span> {discrepancy.status}
        </span>
      </p>

      {/* Líneas: filas 5 a 12 */}
      <table className="avoid-break mb-2 w-full border-collapse">
        <thead>
          <tr className="bg-zinc-100">
            <th className={cell}>Factura</th>
            <th className={cell}>Cliente</th>
            <th className={cell}># Reclamo</th>
            <th className={cell}>Codigo</th>
            <th className={cell}>Descripcion del Producto</th>
            <th className={`${cell} text-right`}>Cantidad Sobrante</th>
            <th className={`${cell} text-right`}>Cantidad Faltante</th>
            <th className={`${cell} text-center`} colSpan={2}>
              Cumple Para Nota de Credito?
            </th>
            <th className={cell}># N C</th>
            <th className={cell}>Despachador</th>
            <th className={cell}>Supervisor</th>
          </tr>
          <tr className="bg-zinc-100">
            <th className={cell} colSpan={7} />
            <th className={`${cell} text-center`}>SI</th>
            <th className={`${cell} text-center`}>NO</th>
            <th className={cell} colSpan={3} />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={line?.id ?? `vacia-${index}`}>
              <td className={`${cell} font-mono`}>{line?.invoiceRef ?? " "}</td>
              <td className={cell}>{line?.clientName ?? ""}</td>
              <td className={`${cell} font-mono`}>{line?.claimRef ?? ""}</td>
              <td className={`${cell} font-mono`}>{line?.productCode ?? ""}</td>
              <td className={cell}>{line?.productName ?? ""}</td>
              <td className={`${cell} text-right tabular-nums`}>{line && line.surplusQuantity > 0 ? formatQuantity(line.surplusQuantity) : ""}</td>
              <td className={`${cell} text-right tabular-nums`}>{line && line.shortageQuantity > 0 ? formatQuantity(line.shortageQuantity) : ""}</td>
              <td className={`${cell} text-center`}>{line ? <Mark on={line.qualifiesForCreditNote === true} /> : ""}</td>
              <td className={`${cell} text-center`}>{line ? <Mark on={line.qualifiesForCreditNote === false} /> : ""}</td>
              <td className={`${cell} font-mono`}>{line?.creditNoteNumber ?? line?.creditRequestNumber ?? ""}</td>
              <td className={cell}>{line?.dispatcherName ?? ""}</td>
              <td className={cell}>{line?.supervisorName ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Firmas y nota: filas 14 a 17 */}
      <section className="avoid-break mb-2 grid grid-cols-[1fr_1.4fr] gap-3">
        <div className="flex flex-col gap-3">
          <div className="border-b border-black pb-1">
            <span className="font-semibold">Realizado por: </span>
            {discrepancy.performedByName ?? ""}
            {discrepancy.performedAt && <span className="ml-2 text-[9px] text-zinc-600">{formatDay(discrepancy.performedAt.slice(0, 10))}</span>}
          </div>
          <div className="border-b border-black pb-1">
            <span className="font-semibold">Aprobado por: </span>
            {discrepancy.status === "Aprobada" ? discrepancy.approvedByName : ""}
            {discrepancy.status === "Aprobada" && discrepancy.approvedAt && (
              <span className="ml-2 text-[9px] text-zinc-600">{formatDay(discrepancy.approvedAt.slice(0, 10))}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <span className="font-semibold">Nota:</span>
          <div className="min-h-[56px] flex-1 whitespace-pre-line border border-black px-1.5 py-1">{discrepancy.note ?? ""}</div>
        </div>
      </section>

      {/* Puntos de seguridad: filas 19 a 29 */}
      <table className="avoid-break w-full border-collapse">
        <thead>
          <tr className="bg-zinc-100">
            <th className={`${cell} text-left`} colSpan={2}>
              Puntos de Seguridad a Evaluar
            </th>
            <th className={`${cell} w-[70px] text-center`}>
              <span className="block text-[8px] font-normal">Marcar X</span>Positivo
            </th>
            <th className={`${cell} w-[70px] text-center`}>Negativo</th>
          </tr>
        </thead>
        <tbody>
          {discrepancy.checks.map((check) => (
            <tr key={check.itemNumber}>
              <td className={`${cell} w-6 text-center tabular-nums`}>{check.itemNumber}</td>
              <td className={cell}>
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
