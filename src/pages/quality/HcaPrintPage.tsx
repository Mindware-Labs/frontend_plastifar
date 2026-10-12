import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { qualityApi, type SheetDetailResponse } from "../../api/quality";
import { Logo } from "../../components/Logo";
import { formatDay } from "../../lib/quality";

/** Control documental del pie del PF-FOR-109, tal como está en la plantilla entregada (V0). */
const FORM_CONTROL = {
  code: "PF-FOR-109",
  revision: "00",
  replaces: "N/A",
  lastRevision: "N/A",
  issuedOn: "17.04.2015",
} as const;

function Cell({ label, children, className = "" }: { label: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-black px-1.5 py-1 ${className}`}>
      <span className="font-semibold">{label} </span>
      <span>{children ?? ""}</span>
    </div>
  );
}

/** Renglones vacíos hasta completar los del papel; con más datos, sigue. */
function pad<T>(items: T[], minimum: number): (T | null)[] {
  return items.length >= minimum ? items : [...items, ...Array<null>(minimum - items.length).fill(null)];
}

/**
 * RF-H10: la HCA con la distribución y el control documental del PF-FOR-109 y
 * el logotipo de Plastifar (la plantilla heredada traía otro). Fuera del
 * armazón de la aplicación para que la barra lateral no salga en el papel. Lo
 * que el formulario no tiene —estados, verificación de eficacia— queda solo en
 * pantalla (sección 15).
 */
export function HcaPrintPage() {
  const { id } = useParams();
  const sheetId = Number(id);
  const [detail, setDetail] = useState<SheetDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    qualityApi.sheets
      .get(sheetId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        document.title = `${FORM_CONTROL.code} · ${data.sheet.number}`;
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "No se pudo cargar la HCA.");
      });
    return () => {
      cancelled = true;
    };
  }, [sheetId]);

  useEffect(() => {
    if (detail === null) return;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [detail]);

  if (error) return <p className="p-8 text-[13px] text-red-700">{error}</p>;
  if (detail === null) return <p className="p-8 text-[13px] text-zinc-500">Preparando la impresión…</p>;

  const { sheet, planItems } = detail;
  const causes = pad(sheet.causes, 4);
  const actions = pad(planItems, 2);
  const evidences = pad(planItems.filter((item) => item.evidenceNotes || item.attachments.length > 0), 4);
  const participants = pad(sheet.participants, 4);

  return (
    <div className="mx-auto max-w-[800px] bg-white p-8 text-[11px] leading-snug text-black print:p-0">
      <style>{`
        @page { size: letter; margin: 14mm; }
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .avoid-break { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">
        <span>Vista de impresión. Si el diálogo no se abrió, usa el botón.</span>
        <button type="button" onClick={() => window.print()} className="rounded bg-black px-3 py-1 text-[12px] font-semibold text-white">
          Imprimir
        </button>
      </div>

      {/* Cabecera: C1:C5 título, D2:H4 datos */}
      <header className="avoid-break mb-2 grid grid-cols-[auto_1fr_1fr] items-stretch border-2 border-black">
        <div className="flex flex-col items-center justify-center gap-1 border-r border-black px-4 py-2">
          <Logo height={28} />
          <span className="text-[18px] font-bold tracking-wide">HCA</span>
          <span className="text-[9px] uppercase">Hecho, Causa y Acción</span>
        </div>
        <div className="grid grid-rows-3 border-r border-black">
          <Cell label="Codigo:" className="border-0 border-b">
            <span className="font-mono">{sheet.number}</span>
          </Cell>
          <Cell label="Fecha:" className="border-0 border-b">{formatDay(sheet.detectedAt.slice(0, 10))}</Cell>
          <Cell label="Elaborado por:" className="border-0">{sheet.createdByName ?? ""}</Cell>
        </div>
        <div className="grid grid-rows-3">
          <Cell label="Producto:" className="border-0 border-b">
            {sheet.productName ? `${sheet.productCode} · ${sheet.productName}` : sheet.productLineName}
          </Cell>
          <Cell label="Planta:" className="border-0 border-b">{sheet.plantName ?? ""}</Cell>
          <Cell label="Responsable:" className="border-0">{sheet.responsibleName}</Cell>
        </div>
      </header>

      {/* HECHO: A6:A10 */}
      <section className="avoid-break mb-2 grid grid-cols-[110px_1fr] border border-black">
        <div className="flex items-center justify-center border-r border-black bg-zinc-200 px-2 font-bold uppercase">Hecho</div>
        <div className="min-h-[80px] whitespace-pre-line px-2 py-1.5">
          {sheet.description}
          {sheet.immediateAction && (
            <p className="mt-1.5 text-[10px]">
              <span className="font-semibold">Acción inmediata: </span>
              {sheet.immediateAction}
            </p>
          )}
          <p className="mt-1.5 text-[10px]">
            <span className="font-semibold">Cliente: </span>
            {sheet.clientName}
            {sheet.ticketNumber && (
              <>
                {" · "}
                <span className="font-semibold">Ticket: </span>
                <span className="font-mono">{sheet.ticketNumber}</span>
              </>
            )}
          </p>
        </div>
      </section>

      {/* CAUSAS: A12:A18, cuatro renglones */}
      <section className="avoid-break mb-2 grid grid-cols-[110px_1fr] border border-black">
        <div className="flex items-center justify-center border-r border-black bg-zinc-200 px-2 font-bold uppercase">Causas</div>
        <ol className="list-none">
          {causes.map((cause, index) => (
            <li key={cause?.id ?? `vacia-${index}`} className="flex min-h-[22px] gap-2 border-b border-black px-2 py-1 last:border-0">
              <span className="w-4 shrink-0 tabular-nums text-zinc-500">{index + 1}.</span>
              <span className="whitespace-pre-line">{cause?.description ?? ""}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* PLAN DE ACCIÓN: A20:A33 */}
      <section className="avoid-break mb-2 border border-black">
        <div className="border-b border-black bg-zinc-200 px-2 py-0.5 font-bold uppercase">Plan de acción</div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border-b border-r border-black px-1.5 py-0.5 text-left">Acción (qué)</th>
              <th className="w-[170px] border-b border-r border-black px-1.5 py-0.5 text-left">Quién</th>
              <th className="w-[100px] border-b border-r border-black px-1.5 py-0.5 text-left">Cuándo</th>
              <th className="w-[90px] border-b border-black px-1.5 py-0.5 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((item, index) => (
              <tr key={item?.id ?? `vacia-${index}`}>
                <td className="min-h-[22px] border-b border-r border-black px-1.5 py-1 align-top">{item?.description ?? " "}</td>
                <td className="border-b border-r border-black px-1.5 py-1 align-top">{item?.responsibleName ?? ""}</td>
                <td className="border-b border-r border-black px-1.5 py-1 align-top tabular-nums">{item ? formatDay(item.dueDate) : ""}</td>
                <td className="border-b border-black px-1.5 py-1 align-top">
                  {item ? (item.completedAt ? `Cumplida ${formatDay(item.completedAt)}` : item.status) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-b border-t border-black bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase">
          Evidencias de la implementación de las acciones
        </div>
        <div className="grid grid-cols-2">
          {evidences.map((item, index) => (
            <div
              key={item?.id ?? `vacia-${index}`}
              className={`min-h-[44px] px-1.5 py-1 ${index % 2 === 0 ? "border-r border-black" : ""} ${index < evidences.length - 2 ? "border-b border-black" : ""}`}
            >
              {item && (
                <>
                  <p className="text-[10px] font-semibold">{item.description}</p>
                  {item.evidenceNotes && <p className="whitespace-pre-line">{item.evidenceNotes}</p>}
                  {item.attachments.length > 0 && (
                    <p className="text-[10px] text-zinc-600">
                      Adjuntos: {item.attachments.map((attachment) => attachment.fileName).join(", ")}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* PARTICIPANTES: A35:A39 */}
      <section className="avoid-break mb-2 border border-black">
        <div className="border-b border-black bg-zinc-200 px-2 py-0.5 font-bold uppercase">Participantes</div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border-b border-r border-black px-1.5 py-0.5 text-left">Nombre</th>
              <th className="w-[45%] border-b border-black px-1.5 py-0.5 text-left">Firma</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant, index) => (
              <tr key={participant?.id ?? `vacia-${index}`}>
                <td className="h-[26px] border-b border-r border-black px-1.5 py-1">{participant?.name ?? " "}</td>
                <td className="border-b border-black px-1.5 py-1 text-[9px] text-zinc-500">
                  {participant?.acknowledgedAt ? `Confirmó en el sistema el ${formatDay(participant.acknowledgedAt.slice(0, 10))}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* COMENTARIOS: A40:A42 */}
      <section className="avoid-break mb-2 grid grid-cols-[110px_1fr] border border-black">
        <div className="flex items-center justify-center border-r border-black bg-zinc-200 px-2 font-bold uppercase">Comentarios</div>
        <div className="min-h-[44px] whitespace-pre-line px-2 py-1.5">{sheet.comments ?? ""}</div>
      </section>

      <footer className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-t border-black pt-1 text-[9px]">
        <span className="font-semibold">{FORM_CONTROL.code}</span>
        <span>Revisión: {FORM_CONTROL.revision}</span>
        <span>Sustituye a: {FORM_CONTROL.replaces}</span>
        <span>Última revisión: {FORM_CONTROL.lastRevision}</span>
        <span>Fecha emisión: {FORM_CONTROL.issuedOn}</span>
        <span>Emitido por: {sheet.createdByName ?? sheet.responsibleName}</span>
      </footer>
    </div>
  );
}
