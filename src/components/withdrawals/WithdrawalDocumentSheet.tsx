import { Logo } from "../Logo";
import { PrintSheet } from "../print/PrintSheet";
import { padRows } from "../print/rows";
import { formatPrice, formatQuantity } from "../../lib/numbers";
import { WITHDRAWAL_FORM_CONTROL } from "../../lib/withdrawals";
import { exportWithdrawalToExcel } from "../../lib/withdrawalExcelExport";
import type { MerchandiseWithdrawal } from "../../types/withdrawals";

function splitIsoDate(iso: string | null | undefined): { day: string; month: string; year: string } {
  if (!iso) return { day: "—", month: "—", year: "—" };
  const parts = iso.split("-");
  if (parts.length >= 3) {
    return { year: parts[0], month: parts[1], day: parts[2].slice(0, 2) };
  }
  return { day: "—", month: "—", year: "—" };
}

export interface WithdrawalDocumentSheetProps {
  withdrawal: MerchandiseWithdrawal;
  onBack?: () => void;
  backLabel?: string;
  contextCodeOverride?: string;
  referenceKindLabel?: string;
}

export function WithdrawalDocumentSheet({
  withdrawal,
  onBack,
  backLabel = "Volver",
  contextCodeOverride,
  referenceKindLabel = "Ticket",
}: WithdrawalDocumentSheetProps) {
  const referenceCode = contextCodeOverride?.trim() || withdrawal.ticketNumber;
  const { day, month, year } = splitIsoDate(withdrawal.requestDate);
  const sortedLines = [...(withdrawal.lines ?? [])].sort((a, b) => a.position - b.position);
  const lines = padRows(sortedLines, 15);
  const cell = "border border-black px-2 py-1 text-center align-middle text-[11px]";

  return (
    <PrintSheet
      orientation="landscape"
      title={`${WITHDRAWAL_FORM_CONTROL.code} · ${withdrawal.number || withdrawal.id}`}
      backLabel={backLabel}
      onBack={onBack}
      filename={`${WITHDRAWAL_FORM_CONTROL.code}_${withdrawal.number || withdrawal.id}.pdf`}
      onExportExcel={() => exportWithdrawalToExcel(withdrawal)}
    >
      <div className="avoid-break border border-black font-sans text-[11px] text-black">
        <div className="flex min-h-[68px] items-center justify-between border-b border-black px-4 py-2.5">
          <Logo height={42} />
          <div className="text-right text-[10px] text-zinc-700">
            <span className="font-mono font-semibold text-black">{withdrawal.number}</span>
            {referenceCode && (
              <span className="ml-3 font-mono text-zinc-600">
                {referenceKindLabel}: {referenceCode}
              </span>
            )}
          </div>
        </div>

        <div className="border-b border-black py-1 text-center text-[12px] font-bold uppercase tracking-wide">
          SOLICITUD RETIRO DE MERCANCIA
        </div>

        <div className="border-b border-black px-3 py-2.5">
          <div className="grid grid-cols-[1fr_260px] items-start gap-6">
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

        <div className="h-3 border-b border-black" />

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

        <div className="px-8 pt-8 pb-4">
          <div className="grid grid-cols-3 gap-12 text-center">
            <div>
              <div className="min-h-[22px] border-b border-black px-2 pb-0.5 font-medium uppercase">
                {/* Vendedor: se deja en blanco para firma manual. */}
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
