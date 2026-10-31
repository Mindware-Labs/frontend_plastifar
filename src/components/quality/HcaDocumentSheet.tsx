import { Logo } from "../Logo";
import { PrintSheet } from "../print/PrintSheet";
import { padRows } from "../print/rows";
import { formatDay } from "../../lib/dates";
import { exportHcaToExcel } from "../../lib/hcaExcelExport";
import { hcaProductLabel } from "../../lib/hcaForm109";
import type { ActionPlanItem, CorrectiveActionSheet } from "../../types/quality";

/** Control documental del pie del PF-FOR-109, tal como está en la plantilla oficial (V0). */
const FORM_CONTROL = {
  code: "PF-FOR-109",
  revision: "00",
  replaces: "N/A",
  lastRevision: "N/A",
  issuedOn: "17 .04.2015",
} as const;

export interface HcaDocumentSheetProps {
  sheet: CorrectiveActionSheet;
  planItems: ActionPlanItem[];
  onBack?: () => void;
  backLabel?: string;
}

/**
 * Hoja HCA (Hecho, Causa y Acción) con el formato idéntico
 * al documento Excel oficial PF-FOR-109. Reutilizable tanto en la vista
 * de impresión aislada como incrustada en el detalle ejecutivo de la HCA.
 */
export function HcaDocumentSheet({
  sheet,
  planItems,
  onBack,
  backLabel = "Volver",
}: HcaDocumentSheetProps) {
  const causes = padRows(sheet.causes, 4);
  const actions = padRows(planItems, 2);
  const rawEvidences = planItems.filter((item) => item.evidenceNotes || (item.attachments && item.attachments.length > 0));
  const evidences = padRows(rawEvidences, 4);
  const participants = padRows(sheet.participants, 4);

  return (
    <PrintSheet
      orientation="portrait"
      title={`${FORM_CONTROL.code} · ${sheet.number}`}
      onBack={onBack}
      backLabel={backLabel}
      filename={`${FORM_CONTROL.code}_${sheet.number}.pdf`}
      onExportExcel={() => exportHcaToExcel(sheet, planItems)}
    >
      <div className="font-['Trebuchet_MS',sans-serif] text-black">
        {/* CABECERA (A1:H5): Logotipo, Título HCA y Datos */}
        <header className="avoid-break mb-1.5 grid grid-cols-[145px_100px_1fr_1fr] border-2 border-black">
          {/* A1:B5 Logotipo */}
          <div className="flex items-center justify-center border-r-2 border-black p-2.5">
            <Logo height={32} />
          </div>

          {/* C1:C5 Título HCA */}
          <div className="flex items-center justify-center border-r-2 border-black text-center font-bold text-[28px] tracking-widest">
            HCA
          </div>

          {/* D2:F4 Columna de datos 1 */}
          <div className="grid grid-rows-3 border-r border-black text-[11px]">
            <div className="flex items-center justify-between border-b border-black px-2.5 py-1 gap-1.5">
              <span className="font-bold text-black">Código:</span>
              <span className="font-mono font-bold text-right truncate text-black">{sheet.number}</span>
            </div>
            <div className="flex items-center justify-between border-b border-black px-2.5 py-1 gap-1.5">
              <span className="font-bold text-black">Fecha:</span>
              <span className="font-bold text-right truncate text-black">{formatDay(sheet.detectedAt.slice(0, 10))}</span>
            </div>
            <div className="flex items-center justify-between px-2.5 py-1 gap-1.5">
              <span className="font-bold text-black whitespace-nowrap">Elaborado por:</span>
              <span className="font-bold text-right truncate text-black">{sheet.createdByName ?? ""}</span>
            </div>
          </div>

          {/* G2:H4 Columna de datos 2 */}
          <div className="grid grid-rows-3 text-[11px]">
            <div className="flex items-center justify-between border-b border-black px-2.5 py-1 gap-1.5">
              <span className="font-bold text-black">Producto:</span>
              <span className="font-bold text-right truncate max-w-[180px] text-black" title={hcaProductLabel(sheet)}>
                {hcaProductLabel(sheet)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-black px-2.5 py-1 gap-1.5">
              <span className="font-bold text-black">Planta:</span>
              <span className="font-bold text-right truncate text-black">{sheet.plantName ?? ""}</span>
            </div>
            <div className="flex items-center justify-between px-2.5 py-1 gap-1.5">
              <span className="font-bold text-black">Responsable:</span>
              <span className="font-bold text-right truncate text-black">{sheet.responsibleName}</span>
            </div>
          </div>
        </header>

        {/* HECHO (A6:A10, área libre B6:H10) */}
        <section className="avoid-break mb-1.5 grid grid-cols-[34px_1fr] border-2 border-black">
          <div
            style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
            className="flex items-center justify-center border-r-2 border-black py-2 text-center text-xs font-bold tracking-widest uppercase select-none"
          >
            Hecho
          </div>
          <div className="min-h-[100px] p-3 text-[11.5px] leading-relaxed whitespace-pre-line">
            <p className="font-medium text-black">{sheet.description}</p>
            {sheet.immediateAction && (
              <p className="mt-2 text-zinc-700">
                <span className="font-bold">Acción inmediata de contención:</span> {sheet.immediateAction}
              </p>
            )}
          </div>
        </section>

        {/* CAUSAS (A11:A14, 4 filas B11:H14) */}
        <section className="avoid-break mb-1.5 grid grid-cols-[34px_1fr] border-2 border-black">
          <div
            style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
            className="flex items-center justify-center border-r-2 border-black py-2 text-center text-xs font-bold tracking-widest uppercase select-none"
          >
            Causas
          </div>
          <div className="grid grid-rows-4 divide-y divide-black text-[11px]">
            {causes.map((cause, index) => (
              <div key={cause?.id ?? `vacia-${index}`} className="flex items-center px-3 py-1.5 gap-2 min-h-[26px]">
                <span className="font-bold select-none text-zinc-600">{index + 1}.</span>
                <span className="text-zinc-900 leading-snug">{cause?.description ?? ""}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ACCIÓN (A15:A34, dividido en Plan, Eficacia y Evidencias) */}
        <section className="avoid-break mb-1.5 grid grid-cols-[34px_1fr] border-2 border-black">
          <div
            style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
            className="flex items-center justify-center border-r-2 border-black py-2 text-center text-xs font-bold tracking-widest uppercase select-none"
          >
            Acción
          </div>
          <div className="flex flex-col">
            {/* Tabla de Acciones (filas del plan de acción) */}
            <table className="w-full border-collapse border-b border-black">
              <thead>
                <tr className="border-b border-black text-center text-[10.5px] font-bold uppercase">
                  <th className="w-7 border-r border-black py-1 text-center font-bold">#</th>
                  <th className="border-r border-black px-2 py-1 text-center font-bold">Acción</th>
                  <th className="w-32 border-r border-black px-2 py-1 text-center font-bold">Responsable</th>
                  <th className="w-20 px-2 py-1 text-center font-bold">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((item, index) => (
                  <tr key={item?.id ?? `vacia-${index}`} className="border-b border-black last:border-b-0">
                    <td className="h-[28px] border-r border-black text-center font-mono text-[11px] font-bold select-none align-middle">
                      {index + 1}
                    </td>
                    <td className="border-r border-black px-2.5 py-1 text-[11px] leading-snug align-middle">
                      {item?.description ?? " "}
                    </td>
                    <td className="border-r border-black px-2 py-1 text-center text-[10.5px] truncate max-w-[130px] align-middle">
                      {item?.responsibleName ?? " "}
                    </td>
                    <td className="px-2 py-1 text-center font-mono text-[10.5px] align-middle">
                      {item ? formatDay(item.dueDate) : " "}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Verificación de eficacia */}
            <div className="border-b border-black py-1 px-2 text-center text-[10px] font-bold uppercase tracking-wider">
              Verificación de eficacia de las acciones tomadas
            </div>
            <div className="border-b border-black p-2 min-h-[45px] text-[10.5px] leading-relaxed">
              {sheet.effectivenessCheckAt ? (
                <div>
                  <span className="font-semibold">
                    Verificada el {formatDay(sheet.effectivenessCheckAt.slice(0, 10))}:
                  </span>{" "}
                  {sheet.effectivenessNotes ?? "Conforme."}
                </div>
              ) : (
                <span className="text-zinc-600 italic">Pendiente de verificación.</span>
              )}
            </div>

            {/* Evidencias de la implementación de las acciones */}
            <div className="border-b border-black py-1 px-2 text-center text-[10px] font-bold uppercase tracking-wider">
              Evidencias de la implementación de las acciones
            </div>
            <div className="grid grid-cols-4 divide-x divide-black min-h-[50px] text-[10px]">
              {evidences.map((item, index) => (
                <div key={item?.id ?? `vacia-${index}`} className="p-1.5 flex flex-col justify-between">
                  {item ? (
                    <>
                      <p className="font-semibold text-zinc-900 leading-tight">{item.description}</p>
                      {item.evidenceNotes && <p className="mt-1 whitespace-pre-line text-zinc-700">{item.evidenceNotes}</p>}
                      {item.attachments && item.attachments.length > 0 && (
                        <p
                          className="mt-1 text-[9px] text-zinc-500 truncate"
                          title={item.attachments.map((a) => a.fileName).join(", ")}
                        >
                          Adjuntos: {item.attachments.map((a) => a.fileName).join(", ")}
                        </p>
                      )}
                    </>
                  ) : (
                    <span> </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PARTICIPANTES (A35:A39, NOMBRE y FIRMA) */}
        <section className="avoid-break mb-1.5 grid grid-cols-[34px_1fr] border-2 border-black">
          <div
            style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
            className="flex items-center justify-center border-r-2 border-black py-2 text-center text-xs font-bold tracking-widest uppercase select-none"
          >
            Participantes
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black text-center text-[12px] font-bold uppercase">
                <th className="border-r border-black px-3 py-1.5 text-center font-bold">Nombre</th>
                <th className="w-[45%] px-3 py-1.5 text-center font-bold">Firma</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant, index) => (
                <tr key={participant?.id ?? `vacia-${index}`} className="border-b border-black last:border-b-0">
                  <td className="h-[30px] border-r border-black px-3 py-1.5 text-[11.5px] font-medium align-middle">
                    {participant?.name ?? " "}
                  </td>
                  <td className="px-3 py-1.5 text-[11px] text-zinc-600 italic align-middle">
                    {participant?.acknowledgedAt
                      ? `Confirmó en el sistema el ${formatDay(participant.acknowledgedAt.slice(0, 10))}`
                      : " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* COMENTARIOS (A40:A42, área libre B40:H42) */}
        <section className="avoid-break mb-2 grid grid-cols-[34px_1fr] border-2 border-black">
          <div
            style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
            className="flex items-center justify-center border-r-2 border-black py-2 text-center text-xs font-bold tracking-widest uppercase select-none"
          >
            Comentarios
          </div>
          <div className="min-h-[75px] p-3 text-[11.5px] leading-relaxed whitespace-pre-line">
            {sheet.comments ?? ""}
          </div>
        </section>

        {/* CONTROL DOCUMENTAL EN EL PIE DE PÁGINA (PF-FOR-109) */}
        <footer className="mt-3 grid grid-cols-3 border-t border-black pt-1.5 text-[10px] text-zinc-800 leading-normal">
          <div className="space-y-0.5">
            <p>
              <span className="font-semibold">Revisión:</span> {FORM_CONTROL.revision}
            </p>
            <p>
              <span className="font-semibold">Sustituye a:</span> {FORM_CONTROL.replaces}
            </p>
          </div>
          <div className="space-y-0.5 text-center">
            <p>
              <span className="font-semibold">Última revisión:</span> {FORM_CONTROL.lastRevision}
            </p>
            <p>
              <span className="font-semibold">Emitido por:</span> {sheet.createdByName ?? sheet.responsibleName}
            </p>
          </div>
          <div className="space-y-0.5 text-right">
            <p>
              <span className="font-semibold">Fecha emisión:</span> {FORM_CONTROL.issuedOn}
            </p>
            <p className="font-bold">{FORM_CONTROL.code}</p>
          </div>
        </footer>
      </div>
    </PrintSheet>
  );
}
