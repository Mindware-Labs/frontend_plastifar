import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { withdrawalsApi } from "../../api/withdrawals";
import { Logo } from "../../components/Logo";
import { formatPrice, formatQuantity } from "../../lib/claims";
import { formatAmount } from "../../lib/quality";
import { WITHDRAWAL_FORM_CONTROL } from "../../lib/withdrawals";
import type { MerchandiseWithdrawal } from "../../types/withdrawals";

/** Casilla con «X», como en la plantilla. */
function Mark({ on }: { on: boolean }) {
  return <span className="inline-block h-4 w-5 border border-black text-center font-bold leading-4">{on ? "X" : " "}</span>;
}

function pad<T>(items: T[], minimum: number): (T | null)[] {
  return items.length >= minimum ? items : [...items, ...Array<null>(minimum - items.length).fill(null)];
}

/**
 * RF-W4 (la impresión): la solicitud con la distribución del PF-FOR-068 en
 * horizontal, los quince renglones de líneas, las tres firmas y el control
 * documental del pie. Fuera del armazón para que la barra lateral no salga en
 * el papel.
 */
export function WithdrawalPrintPage() {
  const { id } = useParams();
  const withdrawalId = Number(id);
  const [withdrawal, setWithdrawal] = useState<MerchandiseWithdrawal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    withdrawalsApi
      .get(withdrawalId)
      .then((detail) => {
        if (cancelled) return;
        setWithdrawal(detail.withdrawal);
        document.title = `${WITHDRAWAL_FORM_CONTROL.code} · ${detail.withdrawal.number}`;
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "No se pudo cargar la solicitud de retiro.");
      });
    return () => {
      cancelled = true;
    };
  }, [withdrawalId]);

  useEffect(() => {
    if (withdrawal === null) return;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [withdrawal]);

  if (error) return <p className="p-8 text-[13px] text-red-700">{error}</p>;
  if (withdrawal === null) return <p className="p-8 text-[13px] text-zinc-500">Preparando la impresión…</p>;

  const lines = pad(withdrawal.lines, 15);
  const [year, month, day] = withdrawal.requestDate.split("-");
  const cell = "border border-black px-1.5 py-1 align-top";
  const money = (value: number | null) => (value === null || withdrawal.currency === null ? "" : formatAmount(value, withdrawal.currency));

  return (
    <div className="mx-auto max-w-[1040px] bg-white p-8 text-[10.5px] leading-snug text-black print:p-0">
      <style>{`
        @page { size: letter landscape; margin: 12mm; }
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .avoid-break { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">
        <span>Vista de impresión (horizontal). Si el diálogo no se abrió, usa el botón.</span>
        <button type="button" onClick={() => window.print()} className="rounded bg-black px-3 py-1 text-[12px] font-semibold text-white">
          Imprimir
        </button>
      </div>

      {/* Filas 1 a 5: logo y título */}
      <header className="avoid-break mb-3 flex items-center justify-between gap-4">
        <Logo height={26} />
        <h1 className="flex-1 text-center text-[15px] font-bold uppercase">{WITHDRAWAL_FORM_CONTROL.title}</h1>
        <span className="text-right text-[9.5px]">
          <span className="block">
            <span className="font-semibold">No.:</span> <span className="font-mono">{withdrawal.number}</span>
          </span>
          <span className="block">
            <span className="font-semibold">Ticket:</span> <span className="font-mono">{withdrawal.ticketNumber}</span>
          </span>
        </span>
      </header>

      {/* Filas 6 a 9: empresa, fecha y motivo */}
      <section className="avoid-break mb-3 grid grid-cols-[1fr_auto] gap-6">
        <div className="flex flex-col gap-2">
          <p className="flex gap-2">
            <span className="font-semibold">Nombre Empresa:</span>
            <span className="flex-1 border-b border-black">{withdrawal.clientName}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="w-[100px] font-semibold">Por Devolución</span>
            <Mark on={withdrawal.reason === "Por devolución"} />
          </p>
          <p className="flex items-center gap-2">
            <span className="w-[100px] font-semibold">Por Cambio</span>
            <Mark on={withdrawal.reason === "Por cambio"} />
          </p>
        </div>
        <table className="border-collapse self-start">
          <thead>
            <tr>
              <th className={`${cell} text-center`} colSpan={3}>
                FECHA
              </th>
            </tr>
            <tr>
              <th className={`${cell} w-12 text-center`}>DIA</th>
              <th className={`${cell} w-12 text-center`}>MES</th>
              <th className={`${cell} w-16 text-center`}>AÑO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${cell} text-center tabular-nums`}>{day}</td>
              <td className={`${cell} text-center tabular-nums`}>{month}</td>
              <td className={`${cell} text-center tabular-nums`}>{year}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Filas 12 a 27: líneas */}
      <table className="avoid-break mb-1 w-full border-collapse">
        <thead>
          <tr className="bg-zinc-100">
            <th className={cell}>CODIGO</th>
            <th className={`${cell} text-right`}>CANT.</th>
            <th className={cell}>UNID</th>
            <th className={cell}>DESCRICION</th>
            <th className={`${cell} text-right`}>P. UNIT.</th>
            <th className={`${cell} text-right`}>VALOR</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={line?.id ?? `vacia-${index}`}>
              <td className={`${cell} font-mono`}>{line?.productCode ?? " "}</td>
              <td className={`${cell} text-right tabular-nums`}>{line ? `${formatQuantity(line.quantity)} ${line.quantityUnit}` : ""}</td>
              <td className={`${cell} font-mono`}>{line?.packDetail ?? ""}</td>
              <td className={cell}>{line?.productName ?? ""}</td>
              <td className={`${cell} text-right tabular-nums`}>{line && line.unitPrice !== null ? formatPrice(line.unitPrice) : ""}</td>
              <td className={`${cell} text-right tabular-nums`}>{line ? money(line.lineValue) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={`${cell} text-right font-semibold`} colSpan={5}>
              TOTAL
            </td>
            <td className={`${cell} text-right font-semibold tabular-nums`}>{money(withdrawal.currency ? withdrawal.totalValue : null)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Filas 30 y 31: las tres firmas */}
      <section className="avoid-break mt-12 grid grid-cols-3 gap-10">
        <Signature label="Vendedor" name={withdrawal.requestedByName} />
        <Signature label="Almacén" name={withdrawal.warehouseStaffName} />
        <Signature label="Cliente" name={withdrawal.customerSignerName} />
      </section>

      {/* Pie: control documental */}
      <footer className="avoid-break mt-8 flex flex-wrap justify-between gap-x-6 border-t border-black pt-1 text-[8.5px]">
        <span>{WITHDRAWAL_FORM_CONTROL.code}</span>
        <span>Revisión: {WITHDRAWAL_FORM_CONTROL.revision}</span>
        <span>Sustituye a: {WITHDRAWAL_FORM_CONTROL.replaces}</span>
        <span>Ultima revisión: {WITHDRAWAL_FORM_CONTROL.lastRevision}</span>
        <span>Fecha de emisión: {WITHDRAWAL_FORM_CONTROL.issuedOn}</span>
        <span>Emitido por: {withdrawal.requestedByName}</span>
      </footer>
    </div>
  );
}

function Signature({ label, name }: { label: string; name: string | null }) {
  return (
    <div className="text-center">
      <div className="min-h-[18px] border-b border-black pb-0.5 text-[10px]">{name ?? ""}</div>
      <span className="font-semibold">{label}</span>
    </div>
  );
}
