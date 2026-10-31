import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Pencil,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { fetchAllPages } from "../../api/paging";
import { productLinesApi } from "../../api/productLines";
import { qualityApi } from "../../api/quality";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { HcaDocumentSheet } from "../../components/quality/HcaDocumentSheet";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { DetailGroup, DetailRow, DetailTable } from "../../components/ui/DetailTable";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { Modal } from "../../components/ui/Modal";
import { PageSpinner } from "../../components/ui/PageSpinner";
import { Tooltip } from "../../components/ui/Tooltip";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { useReceipts } from "../../context/useReceipts";
import { useDetail } from "../../hooks/useDetail";
import { usePermissions } from "../../hooks/usePermissions";
import { formatDay } from "../../lib/dates";
import { describeDue, isPlanItemOverdue, isSheetOverdue, nextStatus, today } from "../../lib/quality";
import type { ProductLine } from "../../types/settings";
import { HcaFormModal } from "./HcaFormModal";
import { HcaStatusBadge, PlanItemStatusBadge } from "./StatusBadges";

/**
 * Ficha ejecutiva de una Hoja de Acción Correctiva (HCA, PF-FOR-109).
 * Permite visualizar el avance de hecho, causa, plan de acción, evidencias,
 * verificación de eficacia y puerta de cierre, además de alternar de forma
 * fluida e integrada con la vista del documento oficial.
 */
export function HcaDetailPage() {
  const { id } = useParams();
  const sheetId = Number(id);
  const [searchParams] = useSearchParams();
  const { can } = usePermissions();
  const receipts = useReceipts();

  const { data: detail, setData: setDetail, error, reload: retry } = useDetail(sheetId, qualityApi.sheets.get, {
    notFound: "La HCA no existe o no tienes acceso.",
    failed: "No se pudo cargar la HCA. Vuelve a intentarlo.",
  });

  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closingNote, setClosingNote] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const [registeringEffectiveness, setRegisteringEffectiveness] = useState(false);
  const [effDate, setEffDate] = useState(today());
  const [effNotes, setEffNotes] = useState("");

  const [viewingDocument, setViewingDocument] = useState(() => searchParams.get("documento") === "1");

  useDynamicBreadcrumb(detail?.sheet.number ?? null);

  useEffect(() => {
    fetchAllPages<ProductLine>((page, size) => productLinesApi.list({ page, pageSize: size }))
      .then(setProductLines)
      .catch(() => setProductLines([]));
  }, []);

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

  async function handleAdvance() {
    if (!detail) return;
    const { status: target, blockedBy } = nextStatus(detail.sheet);
    if (!target || blockedBy) return;

    setActionError(null);
    try {
      await qualityApi.sheets.advance(sheetId, target);
      receipts.done({
        action: "avanzar-hca",
        title: "Estado actualizado",
        detail: `La HCA avanzó al estado ${target}`,
      });
      setAdvancing(false);
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "No se pudo avanzar el estado de la HCA");
    }
  }

  async function handleClose() {
    if (!detail) return;
    setActionError(null);
    try {
      await qualityApi.sheets.close(sheetId, closingNote.trim() || null);
      receipts.done({
        action: "cerrar-hca",
        title: "HCA cerrada",
        detail: `La hoja ${detail.sheet.number} ha sido cerrada satisfactoriamente`,
      });
      setClosing(false);
      setClosingNote("");
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "No se pudo cerrar la HCA");
    }
  }

  async function handleSaveEffectiveness() {
    if (!detail || !effNotes.trim()) return;
    setActionError(null);
    try {
      await qualityApi.sheets.registerEffectiveness(sheetId, effDate, effNotes.trim());
      receipts.done({
        action: "registrar-eficacia",
        title: "Eficacia registrada",
        detail: "Se registró la verificación de eficacia de las acciones",
      });
      setRegisteringEffectiveness(false);
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "No se pudo registrar la eficacia");
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

  const { sheet, planItems, closureConditions, canClose } = detail;
  const canWrite = can("quality.write");
  const isClosed = sheet.status === "Cerrada";
  const overdue = isSheetOverdue(sheet);
  const next = nextStatus(sheet);
  const missingCondition = closureConditions.find((c) => !c.met);

  if (viewingDocument) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-receipt-in">
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

      {canWrite && !isClosed && (
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          <Pencil className="h-[15px] w-[15px] mr-1" />
          Editar
        </Button>
      )}

      {canWrite && !isClosed && next.status && (
        <Tooltip content={next.blockedBy ?? `Pasar a '${next.status}'`}>
          <Button
            size="sm"
            variant="secondary"
            disabled={Boolean(next.blockedBy)}
            className={next.blockedBy ? "pointer-events-none opacity-50" : ""}
            onClick={() => setAdvancing(true)}
          >
            <ArrowRight className="h-[15px] w-[15px] mr-1" />
            Avanzar a {next.status}
          </Button>
        </Tooltip>
      )}

      {canWrite && !isClosed && sheet.status === "En verificación" && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setEffDate(sheet.effectivenessCheckAt ? sheet.effectivenessCheckAt.slice(0, 10) : today());
            setEffNotes(sheet.effectivenessNotes ?? "");
            setRegisteringEffectiveness(true);
          }}
        >
          <CheckCircle2 className="h-[15px] w-[15px] mr-1 text-emerald-600" />
          Verificar eficacia
        </Button>
      )}

      {canWrite && !isClosed && (
        <Tooltip
          content={
            canClose
              ? "Todo listo para cerrar la HCA"
              : missingCondition
                ? `Falta: ${missingCondition.missing}`
                : "Faltan condiciones para cerrar"
          }
        >
          <Button
            size="sm"
            disabled={!canClose}
            className={canClose ? "" : "pointer-events-none opacity-50"}
            onClick={() => setClosing(true)}
          >
            <ShieldCheck className="h-[15px] w-[15px] mr-1" />
            Cerrar HCA
          </Button>
        </Tooltip>
      )}
    </div>
  );

  return (
    <div className="max-w-[1020px] pb-12">
      <ModuleHeader
        backTo="/calidad/hca"
        backLabel="Volver a las HCA"
        title={`HCA · ${sheet.number}`}
        badge={<HcaStatusBadge status={sheet.status} overdue={overdue} />}
        action={actions}
      />

      {actionError && (
        <Alert variant="error" className="mb-4">
          {actionError}
        </Alert>
      )}

      {overdue && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[13px] text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Esta acción correctiva tiene la fecha comprometida de cierre vencida desde el{" "}
            <strong>{formatDay(sheet.dueDate)}</strong> ({describeDue(sheet.dueDate)}).
          </span>
        </div>
      )}

      {isClosed && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-[13px] text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <div>
            <p className="font-semibold">
              HCA cerrada el {sheet.closedAt ? formatDay(sheet.closedAt.slice(0, 10)) : ""}
              {sheet.closedByName ? ` por ${sheet.closedByName}` : ""}.
            </p>
            {sheet.closingNote && (
              <p className="mt-1 text-emerald-800 italic">"{sheet.closingNote}"</p>
            )}
          </div>
        </div>
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
              <DetailRow label="Fecha comprometida">
                <span className={overdue ? "font-semibold text-red-600" : ""}>
                  {formatDay(sheet.dueDate)} ({describeDue(sheet.dueDate)})
                </span>
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
                    to={`/tickets`}
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

          <div>
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Acción Inmediata de Contención
            </h3>
            <div className="rounded-lg bg-zinc-50 border border-zinc-200/80 p-3 text-[13px] leading-relaxed text-zinc-700">
              {sheet.immediateAction || (
                <span className="text-zinc-400 italic">No se registró acción inmediata preliminar.</span>
              )}
            </div>
          </div>
        </div>

        {/* Causas Identificadas */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-zinc-500">
              Análisis de Causas Raíz ({sheet.causes.length})
            </h2>
            {sheet.causes.length === 0 && !isClosed && (
              <span className="text-[12px] text-amber-600 font-medium">
                Se requiere al menos 1 causa para pasar a ejecución
              </span>
            )}
          </div>
          {sheet.causes.length === 0 ? (
            <p className="text-[13px] text-zinc-400 italic py-2">
              No se han registrado causas aún. Haz clic en "Editar" para agregarlas.
            </p>
          ) : (
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
          )}
        </div>

        {/* Plan de Acción */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-zinc-500">
              Plan de Acción ({planItems.length})
            </h2>
          </div>
          {planItems.length === 0 ? (
            <p className="text-[13px] text-zinc-400 italic py-2">
              No se han registrado acciones correctivas en el plan.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full text-left border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[11px] font-semibold uppercase text-zinc-500">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Acción</th>
                    <th className="py-2.5 px-3">Responsable</th>
                    <th className="py-2.5 px-3">Vencimiento</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Evidencia / Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {planItems.map((item, index) => {
                    const itemOverdue = isPlanItemOverdue(item);
                    return (
                      <tr key={item.id} className="hover:bg-zinc-50/50">
                        <td className="py-2.5 px-3 font-mono text-center text-zinc-500">{index + 1}</td>
                        <td className="py-2.5 px-3 font-medium text-ink max-w-[280px]">
                          {item.description}
                        </td>
                        <td className="py-2.5 px-3 text-brand-gray">{item.responsibleName}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">
                          <span className={itemOverdue ? "text-red-600 font-medium" : "text-brand-gray"}>
                            {formatDay(item.dueDate)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <PlanItemStatusBadge status={item.status} overdue={itemOverdue} />
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Verificación de Eficacia & Condiciones de Cierre */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Eficacia */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
              Verificación de Eficacia
            </h2>
            {sheet.effectivenessCheckAt ? (
              <div className="rounded-lg bg-emerald-50/60 border border-emerald-200 p-3 text-[13px]">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-900 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Verificada el {formatDay(sheet.effectivenessCheckAt.slice(0, 10))}</span>
                </div>
                <p className="text-emerald-800 leading-relaxed whitespace-pre-line">
                  {sheet.effectivenessNotes || "Conforme."}
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3.5 text-[13px] text-zinc-500">
                <p className="italic">Pendiente de verificación de eficacia.</p>
                <p className="text-[12px] text-zinc-400 mt-1">
                  La verificación de eficacia es un requisito indispensable para poder cerrar la HCA.
                </p>
              </div>
            )}
          </div>

          {/* Checklist de Cierre */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
              Condiciones para Cierre Oficial
            </h2>
            <div className="space-y-2">
              {closureConditions.map((cond) => (
                <div
                  key={cond.id}
                  className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-[12.5px] ${
                    cond.met
                      ? "border-emerald-200 bg-emerald-50/40 text-emerald-900"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700"
                  }`}
                >
                  {cond.met ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-zinc-400 mt-0.5" />
                  )}
                  <div>
                    <span className="font-medium">{cond.label}</span>
                    {!cond.met && cond.missing && (
                      <p className="text-[11.5px] text-amber-700 mt-0.5">{cond.missing}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

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
                    {p.acknowledgedAt ? (
                      <p className="text-[11px] text-emerald-600">
                        Confirmó el {formatDay(p.acknowledgedAt.slice(0, 10))}
                      </p>
                    ) : (
                      <p className="text-[11px] text-zinc-400 italic">Pendiente de confirmación</p>
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

      {/* Modal Confirmar Avance de Estado */}
      {advancing && (
        <ConfirmDialog
          title={`Avanzar HCA a ${next.status}`}
          description={`¿Confirmas que deseas avanzar el estado de la hoja ${sheet.number} a "${next.status}"?`}
          confirmLabel="Avanzar estado"
          onConfirm={handleAdvance}
          onClose={() => setAdvancing(false)}
        />
      )}

      {/* Modal Verificar Eficacia */}
      {registeringEffectiveness && (
        <Modal
          onClose={() => setRegisteringEffectiveness(false)}
          title="Registrar verificación de eficacia"
          maxWidth="max-w-lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setRegisteringEffectiveness(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!effNotes.trim()}
                onClick={handleSaveEffectiveness}
              >
                Guardar verificación
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-zinc-700 mb-1">
                Fecha de verificación
              </label>
              <input
                type="date"
                value={effDate}
                onChange={(e) => setEffDate(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-zinc-700 mb-1">
                Notas y observaciones de eficacia *
              </label>
              <textarea
                rows={4}
                value={effNotes}
                onChange={(e) => setEffNotes(e.target.value)}
                placeholder="Describe los resultados obtenidos tras la implementación del plan de acción..."
                className="w-full rounded-md border border-zinc-300 p-2.5 text-[13px]"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Cerrar HCA */}
      {closing && (
        <Modal
          onClose={() => setClosing(false)}
          title={`Cerrar Acción Correctiva · ${sheet.number}`}
          maxWidth="max-w-lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setClosing(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleClose}>
                <ShieldCheck className="h-4 w-4 mr-1 text-white" />
                Confirmar cierre
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-[13px] text-zinc-600">
              Una HCA cerrada se considera concluida en el Sistema de Gestión de Calidad. Si
              deseas agregar una nota de cierre para el historial, puedes indicarla a continuación:
            </p>
            <div>
              <label className="block text-[12px] font-semibold text-zinc-700 mb-1">
                Nota de cierre (opcional)
              </label>
              <textarea
                rows={3}
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                placeholder="Comentarios finales sobre el cierre del caso..."
                className="w-full rounded-md border border-zinc-300 p-2.5 text-[13px]"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
