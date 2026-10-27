import { useParams } from "react-router-dom";
import { withdrawalsApi } from "../../api/withdrawals";
import { Logo } from "../../components/Logo";
import { PrintPending, PrintSheet } from "../../components/print/PrintSheet";
import { padRows } from "../../components/print/rows";
import { usePrintRecord } from "../../components/print/usePrintRecord";
import { formatPrice, formatQuantity } from "../../lib/numbers";
import { exportWithdrawalToExcel } from "../../lib/withdrawalExcelExport";
import { splitIsoDate, WITHDRAWAL_FORM_CONTROL } from "../../lib/withdrawals";

/**
 * RF-M8: la solicitud con la distribución exacta del PF-FOR-068 (FR-Retiro de Mercancia),
 * en horizontal, con 15 renglones de producto, la fecha partida en DIA/MES/AÑO y las
 * tres líneas de firma (Vendedor, Almacén, Cliente) dentro del marco oficial.
 */
export function WithdrawalPrintPage() {
  const { id } = useParams();
  const withdrawalId = Number(id);
  const { data: withdrawal, error } = usePrintRecord(
    withdrawalId,
    async (key) => (await withdrawalsApi.get(key)).withdrawal,
    {
      documentTitle: (record) => `${WITHDRAWAL_FORM_CONTROL.code} · ${record.number}`,
      failed: "No se pudo cargar la solicitud.",
    },
  );
  if (withdrawal === null) return <PrintPending error={error} />;

  const { day, month, year } = splitIsoDate(withdrawal.requestDate);
  const sortedLines = [...(withdrawal.lines ?? [])].sort((a, b) => a.position - b.position);
  const lines = padRows(sortedLines, 15);
  const cell = "border border-black px-2 py-1 text-center align-middle text-[11px]";

  return (
    <PrintSheet
      orientation="landscape"
      filename={`${WITHDRAWAL_FORM_CONTROL.code}_${withdrawal.number || withdrawal.id}.pdf`}
      onExportExcel={() => exportWithdrawalToExcel(withdrawal)}
    >
      {/* Marco exterior completo A1:N32 del formato oficial FR-Retiro de Mercancia */}
      <div className="avoid-break border border-black font-sans text-[11px] text-black">
        {/* Filas 1 a 4: Recuadro superior con logo a la izquierda */}
        <div className="flex min-h-[68px] items-center justify-between border-b border-black px-4 py-2.5">
          <Logo height={42} />
          <div className="text-right text-[10px] text-zinc-700">
            <span className="font-mono font-semibold text-black">{withdrawal.number}</span>
            {withdrawal.ticketNumber && (
              <span className="ml-3 font-mono text-zinc-600">Ticket: {withdrawal.ticketNumber}</span>
            )}
          </div>
        </div>

        {/* Fila 5: Barra de título centrada */}
        <div className="border-b border-black py-1 text-center text-[12px] font-bold uppercase tracking-wide">
          SOLICITUD RETIRO DE MERCANCIA
        </div>

        {/* Filas 6 a 10: Nombre Empresa, Por Devolución / Por Cambio y cuadro FECHA (DIA / MES / AÑO) */}
        <div className="border-b border-black px-3 py-2.5">
          <div className="grid grid-cols-[1fr_260px] items-start gap-6">
            {/* Columna izquierda: Nombre Empresa y casillas de motivo */}
            <div className="space-y-2.5">
              <div className="flex items-end gap-3 pt-1">
                <span className="shrink-0 font-bold">Nombre Empresa</span>
                <div className="min-h-[22px] flex-1 border-b border-black px-2 text-center font-medium">
                  {withdrawal.clientName}
                </div>
              </div>

              <div className="pt-1">
                <div className="inline-grid grid-cols-[130px_72px] items-center">
                  <span className="py-1 pr-2">Por Devolución</span>
                  <div className="flex h-6 items-center justify-center border border-black font-bold">
                    {withdrawal.reason === "Por devolución" ? "X" : "\u00A0"}
                  </div>
                  <span className="py-1 pr-2">Por Cambio</span>
                  <div className="flex h-6 items-center justify-center border border-t-0 border-black font-bold">
                    {withdrawal.reason === "Por cambio" ? "X" : "\u00A0"}
                  </div>
                </div>
              </div>
            </div>

            {/* Columna derecha: Línea superior + Tabla FECHA (DIA / MES / AÑO) */}
            <div className="flex flex-col">
              <div className="mb-1.5 h-[22px] border-b border-black" />
              <table className="w-full border-collapse text-center text-[11px]">
                <thead>
                  <tr>
                    <th colSpan={3} className="border border-black py-0.5 font-normal">
                      FECHA
                    </th>
                  </tr>
                  <tr>
                    <th className="w-1/3 border border-black py-0.5 font-normal">DIA</th>
                    <th className="w-1/3 border border-black py-0.5 font-normal">MES</th>
                    <th className="w-1/3 border border-black py-0.5 font-normal">AÑO</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="h-7 border border-black font-medium tabular-nums">{day ? Number(day) || day : ""}</td>
                    <td className="h-7 border border-black font-medium tabular-nums">
                      {month ? Number(month) || month : ""}
                    </td>
                    <td className="h-7 border border-black font-medium tabular-nums">{year}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Fila 11: Franja separadora de la plantilla */}
        <div className="h-3 border-b border-black" />

        {/* Filas 12 a 27: Tabla de productos (15 renglones mínimo) */}
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${cell} w-[11%] border-t-0 border-l-0 font-normal`}>CODIGO</th>
              <th className={`${cell} w-[11%] border-t-0 font-normal`}>CANT.</th>
              <th className={`${cell} w-[11%] border-t-0 font-normal`}>UNID</th>
              <th className={`${cell} w-[39%] border-t-0 font-normal`}>DESCRICION</th>
              <th className={`${cell} w-[14%] border-t-0 font-normal`}>P. UNIT.</th>
              <th className={`${cell} w-[14%] border-t-0 border-r-0 font-normal`}>VALOR</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const unitSuffix = line?.quantityUnit ? line.quantityUnit.trim().toUpperCase() : "";
              const qtyText = line ? `${formatQuantity(line.quantity)}${unitSuffix}` : "";
              return (
                <tr key={line?.id ?? `vacia-${index}`} className="h-[22px]">
                  <td className={`${cell} border-l-0 font-mono`}>{line?.productCode ?? "\u00A0"}</td>
                  <td className={`${cell} tabular-nums`}>{qtyText}</td>
                  <td className={cell}>{line?.packDetail ?? ""}</td>
                  <td className={cell}>{line?.productName ?? ""}</td>
                  <td className={`${cell} tabular-nums`}>{line ? formatPrice(line.unitPrice) : ""}</td>
                  <td className={`${cell} border-r-0 tabular-nums`}>{line ? formatPrice(line.lineValue) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Filas 28 a 32: Bloque de firmas (Vendedor, Almacén, Cliente) */}
        <div className="px-8 pt-8 pb-4">
          <div className="grid grid-cols-3 gap-12 text-center">
            <div>
              <div className="min-h-[22px] border-b border-black px-2 pb-0.5 font-medium uppercase">
                {withdrawal.requestedByName ?? ""}
              </div>
              <p className="pt-1 text-[11px]">Vendedor</p>
            </div>
            <div>
              <div className="min-h-[22px] border-b border-black px-2 pb-0.5 font-medium uppercase">
                {withdrawal.warehouseStaffName ?? ""}
              </div>
              <p className="pt-1 text-[11px]">Almacén</p>
            </div>
            <div>
              <div className="min-h-[22px] border-b border-black px-2 pb-0.5 font-medium uppercase">
                {withdrawal.customerSignerName ?? ""}
              </div>
              <p className="pt-1 text-[11px]">Cliente</p>
            </div>
          </div>
        </div>
      </div>
    </PrintSheet>
  );
}
