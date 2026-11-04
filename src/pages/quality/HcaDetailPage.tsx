import {
  ExternalLink,
  FileText,
  Pencil,
  Printer,
  User,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { qualityApi } from "../../api/quality";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { HcaDocumentSheet } from "../../components/quality/HcaDocumentSheet";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { DetailGroup, DetailRow, DetailTable } from "../../components/ui/DetailTable";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { PageSpinner } from "../../components/ui/PageSpinner";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { useReceipts } from "../../context/useReceipts";
import { useDetail } from "../../hooks/useDetail";
import { usePermissions } from "../../hooks/usePermissions";
import { useProductLinesCatalog } from "../../lib/catalogQueries";
import { formatDay } from "../../lib/dates";
import type { ProductLine } from "../../types/settings";
import { HcaFormModal } from "./HcaFormModal";
import { HcaStatusBadge, PlanItemStatusBadge } from "./StatusBadges";

/**
 * Ficha ejecutiva de una Hoja de Acción Correctiva (HCA, PF-FOR-109).
 * Presenta el formulario completado de manera permanente, idéntico al esquema de Discrepancia,
 * con alternancia fluida al documento oficial, edición completa e impresión.
 */
const EMPTY_PRODUCT_LINES: ProductLine[] = [];

export function HcaDetailPage() {
  const { id } = useParams();
  const sheetId = Number(id);
  const [searchParams] = useSearchParams();
  const { can } = usePermissions();
  const receipts = useReceipts();

  const { data: detail, setData: setDetail, error, reload: retry } = useDetail(sheetId, qualityApi.sheets.get, {
    resource: "quality-sheets",
    notFound: "La HCA no existe o no tienes acceso.",
    failed: "No se pudo cargar la HCA. Vuelve a intentarlo.",
  });

  // Catálogo compartido con el formulario de edición; si falla, queda vacío como antes.
  const productLines = useProductLinesCatalog().data ?? EMPTY_PRODUCT_LINES;
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [viewingDocument, setViewingDocument] = useState(() => searchParams.get("documento") === "1");

  useDynamicBreadcrumb(detail?.sheet.number ?? null);

  async function reload() {
    try {
      setDetail(await qualityApi.sheets.get(sheetId));
      setActionError(null);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? `${err.message} Vuelve a intentarlo.`
          : "Se guardó el cambio, pero no se pudo releer la HCA. Vuelve a intentarlo.",
      );
    }
  }

  if (error) {
    return (
      <div className="max-w-[920px]">
        <ModuleHeader title="Acción Correctiva (HCA)" backTo="/calidad/hca" backLabel="Volver a las HCA" />
        <ErrorRetry onRetry={retry}>{error}</ErrorRetry>
      </div>
    );
  }

  if (detail === null) return <PageSpinner />;

  const { sheet, planItems } = detail;
  const canWrite = can("quality.write");

  if (viewingDocument) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-receipt-in print:block print:h-auto print:min-h-0 print:overflow-visible print:animate-none">
        <HcaDocumentSheet
          sheet={sheet}
          planItems={planItems}
          onBack={() => setViewingDocument(false)}
          backLabel="Volver a la ficha ejecutiva"
        />
      </div>
    );
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setViewingDocument(true)}
        title="Ver y exportar documento oficial (PF-FOR-109)"
      >
        <FileText className="h-[15px] w-[15px] mr-1" />
        Documento
      </Button>

      <Button
        size="sm"
        variant="secondary"
        onClick={() => window.open(`/calidad/hca/${sheetId}/imprimir`, "_blank")}
      >
        <Printer className="h-[15px] w-[15px] mr-1" />
        Imprimir
      </Button>

      {canWrite && (
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          <Pencil className="h-[15px] w-[15px] mr-1" />
          Editar
        </Button>
      )}
    </div>
  );

  return (
    <div className="max-w-[1020px] pb-12">
      <ModuleHeader
        backTo="/calidad/hca"
        backLabel="Volver a las HCA"
        title={`HCA · ${sheet.number}`}
        badge={<HcaStatusBadge status={sheet.status} />}
        action={actions}
      />

      {actionError && (
        <Alert variant="error" className="mb-4">
          {actionError}
        </Alert>
      )}

      <div className="space-y-6">
        {/* Contexto Operativo y Fechas */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
            Información General y Operativa
          </h2>
          <DetailTable>
            <DetailGroup title="Identificación y Producto">
              <DetailRow label="Cliente">
                <span className="font-semibold text-ink">{sheet.clientName}</span>
              </DetailRow>
              <DetailRow label="Línea de producto">
                <span>{sheet.productLineName}</span>
              </DetailRow>
              <DetailRow label="Producto concreto">
                <span>
                  {sheet.productName
                    ? `${sheet.productName}${sheet.productCode ? ` (${sheet.productCode})` : ""}`
                    : "No especificado"}
                </span>
              </DetailRow>
              <DetailRow label="Planta">
                <span>{sheet.plantName ?? "No especificada"}</span>
              </DetailRow>
            </DetailGroup>
            <DetailGroup title="Fechas y Responsable">
              <DetailRow label="Fecha de detección">
                <span>{formatDay(sheet.detectedAt.slice(0, 10))}</span>
              </DetailRow>
              <DetailRow label="Elaborado por">
                <span>{sheet.createdByName || "—"}</span>
              </DetailRow>
              <DetailRow label="Responsable">
                <span className="font-medium text-ink">{sheet.responsibleName}</span>
              </DetailRow>
              {sheet.ticketId && (
                <DetailRow label="Ticket / Incidencia">
                  <Link
                    to="/tickets"
                    className="inline-flex items-center gap-1 font-mono text-brand-red hover:underline"
                  >
                    Ticket #{sheet.ticketId}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </DetailRow>
              )}
            </DetailGroup>
          </DetailTable>
        </div>

        {/* Hecho y Acción Inmediata */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
              Hecho (Descripción de la No Conformidad)
            </h2>
            <div className="rounded-lg bg-zinc-50 border border-zinc-200/80 p-3.5 text-[13.5px] leading-relaxed text-zinc-800 whitespace-pre-line">
              {sheet.description}
            </div>
          </div>

          {sheet.immediateAction && (
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Acción Inmediata de Contención
              </h3>
              <div className="rounded-lg bg-zinc-50 border border-zinc-200/80 p-3 text-[13px] leading-relaxed text-zinc-700">
                {sheet.immediateAction}
              </div>
            </div>
          )}
        </div>

        {/* Causas Identificadas */}
        {sheet.causes.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
              Análisis de Causas Raíz ({sheet.causes.length})
            </h2>
            <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
              {sheet.causes.map((cause, index) => (
                <div key={cause.id} className="flex items-start gap-3 p-3 text-[13px]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-mono text-[11px] font-bold text-zinc-700">
                    {index + 1}
                  </span>
                  <span className="text-zinc-800 leading-normal">{cause.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Plan de Acción */}
        {planItems.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
              Plan de Acción ({planItems.length})
            </h2>
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full text-left border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[11px] font-semibold uppercase text-zinc-500">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Acción</th>
                    <th className="py-2.5 px-3">Responsable</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Evidencia / Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {planItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50">
                      <td className="py-2.5 px-3 font-mono text-center text-zinc-500">{index + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-ink max-w-[280px]">
                        {item.description}
                      </td>
                      <td className="py-2.5 px-3 text-brand-gray">{item.responsibleName}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap tabular-nums text-brand-gray">
                        {formatDay(item.dueDate)}
                      </td>
                      <td className="py-2.5 px-3">
                        <PlanItemStatusBadge status={item.status} />
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600 text-[12px] max-w-[240px]">
                        {item.evidenceNotes && <p className="truncate">{item.evidenceNotes}</p>}
                        {item.attachments && item.attachments.length > 0 && (
                          <span className="inline-block mt-0.5 text-[11px] text-blue-600 font-medium">
                            📎 {item.attachments.length} archivo(s)
                          </span>
                        )}
                        {!item.evidenceNotes && (!item.attachments || item.attachments.length === 0) && (
                          <span className="text-zinc-400 italic">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Verificación de Eficacia & Comentarios */}
        {(sheet.effectivenessNotes || sheet.comments) && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
            {sheet.effectivenessNotes && (
              <div>
                <h2 className="text-[13px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  Verificación de Eficacia
                  {sheet.effectivenessCheckAt ? ` (${formatDay(sheet.effectivenessCheckAt.slice(0, 10))})` : ""}
                </h2>
                <div className="rounded-lg bg-emerald-50/60 border border-emerald-200 p-3 text-[13px] text-emerald-900 leading-relaxed">
                  {sheet.effectivenessNotes}
                </div>
              </div>
            )}

            {sheet.comments && (
              <div>
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Comentarios Adicionales
                </h3>
                <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 text-[13px] text-zinc-700 leading-relaxed">
                  {sheet.comments}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Participantes */}
        {sheet.participants.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
              Participantes ({sheet.participants.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {sheet.participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-lg border border-zinc-200 p-2.5 text-[13px]"
                >
                  <User className="h-4 w-4 text-zinc-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{p.name}</p>
                    {p.acknowledgedAt && (
                      <p className="text-[11px] text-emerald-600">
                        Confirmó el {formatDay(p.acknowledgedAt.slice(0, 10))}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal Editar HCA */}
      {editing && (
        <HcaFormModal
          sheet={sheet}
          productLines={productLines}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            receipts.done({
              action: "editar-hca",
              title: "HCA guardada",
              detail: `Se guardaron los cambios en ${sheet.number}`,
            });
            await reload();
          }}
        />
      )}
    </div>
  );
}
