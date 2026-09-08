import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleSlash,
  Pencil,
  Play,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { fetchAllPages } from "../../api/paging";
import { productLinesApi } from "../../api/productLines";
import {
  qualityApi,
  type ActionPlanListResponse,
  type ClosureCondition,
  type PlanItemCounts,
} from "../../api/quality";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { DetailGroup, DetailRow, DetailTable } from "../../components/ui/DetailTable";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { Spinner } from "../../components/ui/Spinner";
import { Tooltip } from "../../components/ui/Tooltip";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import {
  describeDue,
  formatDay,
  formatInstant,
  isPlanItemOverdue,
  isPlanItemSettled,
  isSheetOverdue,
  nextStatus,
} from "../../lib/quality";
import type { ActionPlanItem, CorrectiveActionSheet } from "../../types/quality";
import type { ProductLine } from "../../types/settings";
import { ActionPlanItemModal } from "./ActionPlanItemModal";
import { CancelPlanItemModal } from "./CancelPlanItemModal";
import { CloseSheetModal } from "./CloseSheetModal";
import { EffectivenessModal } from "./EffectivenessModal";
import { HcaModal } from "./HcaModal";
import { HcaStatusBadge, PlanItemStatusBadge } from "./StatusBadges";
import { TicketLink } from "./TicketLink";

/** Criterios de la lista paginada del plan; `sheetId` entra para que cambiar de HCA la reinicie. */
interface PlanListQuery {
  page: number;
  pageSize: number;
  sheetId: number;
}

interface HcaDetailPageProps {
  section: "datos" | "plan" | "cierre";
}

/** RF-Q3, RF-Q4 y RF-Q5: la ficha de una HCA, por secciones. */
export function HcaDetailPage({ section }: HcaDetailPageProps) {
  const { id } = useParams();
  const { can } = usePermissions();
  const canWrite = can("quality.write");

  const sheetId = Number(id);

  const [sheet, setSheet] = useState<CorrectiveActionSheet | null>(null);
  const [conditions, setConditions] = useState<ClosureCondition[]>([]);
  const [closable, setClosable] = useState(false);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [planPageSize, setPlanPageSize] = useState(10);
  const [error, setError] = useState<string | null>(null);
  /** Error de una accion sobre la pagina ya cargada: no reemplaza la ficha. */
  const [actionError, setActionError] = useState<string | null>(null);
  /** Relectura sobre una ficha ya pintada: se atenua, no se reemplaza. */
  const [isRefetching, setIsRefetching] = useState(false);
  /** Cada reintento vuelve a lanzar la carga. */
  const [attempt, setAttempt] = useState(0);

  const [editing, setEditing] = useState(false);
  const [itemModal, setItemModal] = useState<"nueva" | ActionPlanItem | null>(null);
  const [cancelling, setCancelling] = useState<ActionPlanItem | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  useDynamicBreadcrumb(sheet?.number ?? null);

  /**
   * El plan sale de su propio endpoint paginado, no del array que la ficha trae
   * embebido: una HCA con muchas acciones volcaba la lista entera en la tabla.
   *
   * `sheetId` va dentro de los criterios a proposito: asi cambiar de HCA vuelve
   * a la primera pagina y relee, en vez de dejar el plan de la hoja anterior.
   */
  const plan = usePagedList<PlanListQuery, ActionPlanListResponse>({
    fetch: ({ sheetId: id, page, pageSize }) => qualityApi.planItems.list(id, { page, pageSize }),
    criteria: { sheetId, pageSize: planPageSize },
    fallbackError: "No se pudo cargar el plan de acción. Vuelve a intentarlo.",
  });

  /**
   * Relectura tras una accion sobre la ficha ya cargada. No se vacia nada: la
   * tabla se atenua y se repinta. Nunca rechaza —el fallo se cuenta arriba—,
   * porque quien la llama es el `onSaved` de un dialogo que ya se cerro.
   */
  async function reload() {
    setIsRefetching(true);
    try {
      const data = await qualityApi.sheets.get(sheetId);
      setSheet(data.sheet);
      setConditions(data.closureConditions);
      setClosable(data.canClose);
      setActionError(null);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? `${err.message} Vuelve a intentarlo.`
          : "Se guardó el cambio, pero no se pudo releer la HCA. Vuelve a intentarlo.",
      );
    } finally {
      setIsRefetching(false);
    }
  }

  /**
   * Relectura tras tocar una accion del plan. Son dos cosas y hacen falta las
   * dos: la pagina del plan, que es lo que cambio, y la ficha, porque
   * `closureConditions` y `canClose` los calcula el servidor a partir del plan
   * --agregar una accion nueva vuelve a cerrar la puerta que estaba abierta--.
   * Quedarse solo con la lista dejaba el boton «Cerrar HCA» habilitado sobre una
   * hoja que el servidor ya iba a rechazar.
   *
   * Lo que NO se toca aqui es el estado de la hoja ni su historial: eso solo lo
   * mueven las acciones de hoja, que siguen releyendo la ficha por su cuenta.
   */
  async function reloadAfterPlanChange() {
    plan.refresh();
    await reload();
  }

  /**
   * Carga de la ficha. Se vacia primero y se descarta la respuesta si el id
   * cambio: sin esto, ir de HCA-001 a HCA-002 seguia pintando la 001 bajo la
   * miga de la 002, y dos navegaciones rapidas podian resolverse al reves y
   * dejar clavada la hoja equivocada.
   */
  // El vaciado ocurre en render, no en el efecto: en el efecto corre despues de
  // pintar, y en ese hueco se alcanzaba a ver un fotograma de la hoja anterior
  // bajo la miga de la nueva.
  const [lastSheetId, setLastSheetId] = useState(sheetId);
  if (sheetId !== lastSheetId) {
    setLastSheetId(sheetId);
    setSheet(null);
    setConditions([]);
    setClosable(false);
    setError(null);
    setActionError(null);
  }

  useEffect(() => {
    let cancelled = false;

    // Las lineas de producto son catalogo acotado y se recorren enteras; el
    // cliente y el responsable ya no se precargan: sus selectores buscan en el
    // servidor porque ninguno de los dos catalogos tiene tope.
    Promise.all([
      qualityApi.sheets.get(sheetId),
      fetchAllPages<ProductLine>((page, pageSize) => productLinesApi.list({ page, pageSize })),
    ])
      .then(([detail, lines]) => {
        if (cancelled) return;
        setSheet(detail.sheet);
        setConditions(detail.closureConditions);
        setClosable(detail.canClose);
        setProductLines(lines);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar la HCA. Vuelve a intentarlo.");
      });

    return () => {
      cancelled = true;
    };
  }, [sheetId, attempt]);

  // Ya no queda ningun nombre por resolver en el navegador: la HCA, sus
  // acciones y el sello de cierre llegan con el suyo desde el servidor. La
  // lista de personal sobrevive solo para alimentar los `<select>` de los
  // dialogos, que necesitan las opciones y no un nombre suelto.

  const sections = [
    { label: "Datos", to: `/calidad/hca/${id}` },
    { label: "Plan de acción", to: `/calidad/hca/${id}/plan` },
    { label: "Cierre", to: `/calidad/hca/${id}/cierre` },
  ];

  if (error) {
    // La ficha conserva sus pestanas: perder el armazon del registro deja a la
    // persona sin saber donde esta, y el aviso trae la salida.
    return (
      <div>
        <ModuleHeader sections={sections} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <Alert variant="error">{error}</Alert>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (sheet === null) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const planData = plan.data;
  const planItems = planData?.items ?? [];
  const planCounts = planData?.counts;
  const planError = plan.error;
  /**
   * Vencidas de verdad, o `null` cuando no se puede saber: solo se cuentan
   * comparando fechas y solo hay a la vista una pagina. Con el plan entero
   * delante la cifra es exacta; repartido, no se afirma nada.
   */
  const overdueOnPage =
    planData !== null && planData.totalPages <= 1
      ? planItems.filter((item) => isPlanItemOverdue(item) && !isPlanItemSettled(item)).length
      : null;

  const isClosed = sheet.status === "Cerrada";
  const overdue = isSheetOverdue(sheet);
  const advance = nextStatus(sheet);

  async function askAdvance() {
    if (advance.status === null) return;
    setActionError(null);
    try {
      await qualityApi.sheets.advance(sheetId, advance.status);
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "No se pudo avanzar el estado");
    }
  }

  /**
   * Poner en curso no destruye nada ni sella ninguna fecha: se hace directo,
   * sin dialogo de confirmacion. Lo que si necesita confirmacion es cumplir,
   * porque sella el dia, y anular, porque exige justificacion.
   */
  async function startItem(item: ActionPlanItem) {
    setActionError(null);
    try {
      await qualityApi.planItems.start(item.id);
      await reloadAfterPlanChange();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "No se pudo poner la acción en curso");
    }
  }

  function askComplete(item: ActionPlanItem) {
    setConfirmation({
      tone: "warn",
      icon: Check,
      title: "Marcar acción como cumplida",
      description: (
        <>
          Se sella hoy como fecha de cumplimiento de{" "}
          <strong className="font-semibold text-ink">{item.description}</strong>
        </>
      ),
      confirmLabel: "Marcar cumplida",
      onConfirm: async () => {
        await qualityApi.planItems.complete(item.id);
        await reloadAfterPlanChange();
      },
    });
  }

  const primaryAction = (() => {
    if (!canWrite || isClosed) return undefined;

    if (section === "datos") {
      return (
        <Button size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-[15px] w-[15px]" />
          Editar HCA
        </Button>
      );
    }

    if (section === "plan") {
      return (
        <Button size="sm" onClick={() => setItemModal("nueva")}>
          <Plus className="h-[15px] w-[15px]" />
          Nueva acción
        </Button>
      );
    }

    // El boton de cierre existe siempre en la seccion de cierre, apagado
    // mientras falte una condicion: esconderlo dejaria a la persona sin saber
    // que el cierre es lo que esta preparando.
    // El motivo se nombra, no se señala: «están abajo» es falso en una pantalla
    // corta y no significa nada con lector de pantalla.
    const missing = conditions.find((condition) => !condition.met);

    return (
      <Tooltip
        content={
          closable
            ? "Todo listo para cerrar"
            : missing
              ? `Falta: ${missing.missing}`
              : "Faltan condiciones de cierre por cumplir"
        }
      >
        <Button
          size="sm"
          disabled={!closable}
          // Chrome no emite hover sobre un boton deshabilitado, y el envoltorio
          // del Tooltip es quien escucha: sin esto, el motivo de que el cierre
          // este apagado solo se alcanzaba con teclado.
          className={closable ? "" : "pointer-events-none"}
          onClick={() => setClosing(true)}
        >
          <ShieldCheck className="h-[15px] w-[15px]" />
          Cerrar HCA
        </Button>
      </Tooltip>
    );
  })();

  return (
    <div>
      <ModuleHeader sections={sections} action={primaryAction} />

      {actionError && (
        <div className="mb-3">
          <Alert variant="error">{actionError}</Alert>
        </div>
      )}

      {/* Mientras se relee, el contenido se atenua; la rueda es solo de la
          primera carga. */}
      <div className={`transition-opacity ${isRefetching ? "opacity-60" : ""}`}>
      {section === "datos" && (
        <>
          <DetailTable>
            <DetailGroup title="La hoja">
              <DetailRow label="Número">
                <span className="font-mono text-[12.5px] text-ink">{sheet.number}</span>
              </DetailRow>
              <DetailRow label="Estado">
                <span className="flex flex-wrap items-center gap-2">
                  <HcaStatusBadge status={sheet.status} overdue={overdue} />
                  {!isClosed && (
                    <span
                      className={`text-[12px] ${overdue ? "font-medium text-brand-red-dark" : "text-faint"}`}
                    >
                      {describeDue(sheet.dueDate)}
                    </span>
                  )}
                </span>
              </DetailRow>
              <DetailRow label="Responsable">{sheet.responsibleName}</DetailRow>
            </DetailGroup>

            <DetailGroup title="Origen" hint="A quién y a qué afecta.">
              <DetailRow label="Cliente">{sheet.clientName}</DetailRow>
              <DetailRow label="Línea de producto">{sheet.productLineName}</DetailRow>
              <DetailRow label="Ticket de origen">
                <TicketLink number={sheet.ticketNumber} />
              </DetailRow>
            </DetailGroup>

            <DetailGroup title="Plazos">
              <DetailRow label="Detectada el">{formatDay(sheet.detectedAt.slice(0, 10))}</DetailRow>
              <DetailRow label="Cierre comprometido">{formatDay(sheet.dueDate)}</DetailRow>
            </DetailGroup>

            {/* Los tres son prosa, no un dato corto: a dos columnas arrancaban a
                220px del margen y se leian en una franja angosta. */}
            <DetailGroup title="El hallazgo">
              <DetailRow label="Qué ocurrió" wide>
                <p className="whitespace-pre-line">{sheet.description}</p>
              </DetailRow>
              <DetailRow label="Acción inmediata" wide>
                {sheet.immediateAction ? (
                  <p className="whitespace-pre-line">{sheet.immediateAction}</p>
                ) : (
                  <span className="text-faint">Ninguna registrada</span>
                )}
              </DetailRow>
              <DetailRow label="Causa raíz" wide>
                {sheet.rootCause ? (
                  <p className="whitespace-pre-line">{sheet.rootCause}</p>
                ) : (
                  <span className="text-faint">
                    Sin escribir: es obligatoria para pasar a ejecución y para cerrar.
                  </span>
                )}
              </DetailRow>
            </DetailGroup>

            {isClosed && (
              <DetailGroup title="Cierre">
                <DetailRow label="Cerrada el">{formatInstant(sheet.closedAt)}</DetailRow>
                <DetailRow label="Cerrada por">{sheet.closedByName ?? "—"}</DetailRow>
                <DetailRow label="Nota de cierre" wide>
                  {sheet.closingNote ?? <span className="text-faint">Sin nota</span>}
                </DetailRow>
              </DetailGroup>
            )}
          </DetailTable>

          {canWrite && !isClosed && advance.status !== null && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={advance.blockedBy !== null}
                onClick={askAdvance}
              >
                Pasar a {advance.status}
                <ArrowRight className="h-[15px] w-[15px]" />
              </Button>
              {advance.blockedBy && (
                <span className="text-[12.5px] text-warn">{advance.blockedBy}</span>
              )}
            </div>
          )}
        </>
      )}

      {section === "plan" && planError !== null && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <Alert variant="error">{planError}</Alert>
          </div>
          <Button size="sm" variant="secondary" onClick={() => plan.refresh()}>
            Reintentar
          </Button>
        </div>
      )}

      {section === "plan" && planCounts !== undefined && planCounts.all > 0 && (
        <p className="mb-3 text-[12.5px] text-brand-gray">
          {planDebt(planCounts, overdueOnPage)}
        </p>
      )}

      {section === "plan" && planData === null ? (
        planError === null && (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )
      ) : section !== "plan" ? null : (
        planItems.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[13.5px] text-faint">
              Esta HCA todavía no tiene plan de acción.
            </p>
            {canWrite && !isClosed && (
              <div className="mt-3 flex justify-center">
                <Button size="sm" onClick={() => setItemModal("nueva")}>
                  <Plus className="h-[15px] w-[15px]" />
                  Agregar la primera acción
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className={`transition-opacity ${plan.isStale ? "opacity-60" : ""}`}>
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Acción</Th>
                <Th>Responsable</Th>
                <Th>Comprometida</Th>
                <Th>Cumplida</Th>
                <Th>Estado</Th>
                {canWrite && !isClosed && <Th className="w-36 text-right">Acciones</Th>}
              </HeadRow>
            </thead>

            <tbody>
              {planItems.map((item) => {
                const itemOverdue = isPlanItemOverdue(item);
                const settled = isPlanItemSettled(item);

                return (
                  <Row key={item.id}>
                    <Td className="max-w-[460px] text-[12.5px] text-brand-gray">
                      {item.description}
                      {item.cancelReason && (
                        <span className="mt-1 block text-[11.5px] leading-relaxed text-faint">
                          Anulada: {item.cancelReason}
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                      {item.responsibleName}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] tabular-nums text-brand-gray">
                      {formatDay(item.dueDate)}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] tabular-nums text-brand-gray">
                      {item.completedAt ? formatDay(item.completedAt) : <span className="text-faint">—</span>}
                    </Td>
                    <Td>
                      <PlanItemStatusBadge status={item.status} overdue={itemOverdue} />
                    </Td>
                    {canWrite && !isClosed && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Editar la acción de ${item.responsibleName}`}
                            icon={Pencil}
                            onClick={() => setItemModal(item)}
                            disabled={settled}
                          />
                          <RowAction
                            label="Poner en curso"
                            icon={Play}
                            onClick={() => void startItem(item)}
                            disabled={settled || item.status === "En curso"}
                          />
                          <RowAction
                            label="Marcar como cumplida"
                            icon={Check}
                            onClick={() => askComplete(item)}
                            disabled={settled}
                          />
                          <RowAction
                            label="Anular con justificación"
                            icon={CircleSlash}
                            onClick={() => setCancelling(item)}
                            disabled={settled}
                            danger
                          />
                        </div>
                      </Td>
                    )}
                  </Row>
                );
              })}
            </tbody>
          </DataTable>
          </div>
        )
      )}

      {section === "plan" && planData !== null && planData.total > 0 && (
        <Pagination
          page={plan.page}
          pageSize={planPageSize}
          total={planData.total}
          totalPages={planData.totalPages}
          onPageChange={plan.setPage}
          onPageSizeChange={setPlanPageSize}
          noun="acciones"
          nounSingular="acción"
        />
      )}

      {section === "cierre" && (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 font-heading text-[17px] font-bold leading-tight tracking-[-0.01em] text-ink">
              Condiciones de cierre
            </h2>

            {/* Condicion y estado son dos columnas, no una lista: asi se ve de un
                vistazo cuantas faltan sin leer las tres entradas enteras. */}
            <DataTable>
              <thead>
                <HeadRow>
                  <Th>Condición</Th>
                  <Th>Estado</Th>
                </HeadRow>
              </thead>
              <tbody>
                {conditions.map((condition) => (
                  <Row key={condition.id}>
                    <Td className="w-[300px] py-3 align-top text-[13px] font-medium text-ink">
                      {condition.label}
                    </Td>
                    <Td className="py-3 align-top">
                      <span className="flex items-start gap-2">
                        <span
                          aria-hidden
                          className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-edge ${
                            condition.met
                              ? "bg-brand-green/10 text-brand-green"
                              : "bg-warn/10 text-warn"
                          }`}
                        >
                          {condition.met ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span
                          className={`max-w-[76ch] text-[12.5px] leading-relaxed ${
                            condition.met ? "text-brand-green" : "text-warn"
                          }`}
                        >
                          {condition.met ? "Cumplida" : `Falta: ${condition.missing}`}
                        </span>
                      </span>
                    </Td>
                  </Row>
                ))}
              </tbody>
            </DataTable>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-[17px] font-bold leading-tight tracking-[-0.01em] text-ink">
              Verificación de eficacia
            </h2>

            {sheet.effectivenessCheckAt ? (
              <>
                <DetailTable>
                  <tbody>
                    <DetailRow label="Verificada el">
                      {formatDay(sheet.effectivenessCheckAt.slice(0, 10))}
                    </DetailRow>
                    <DetailRow label="Qué se comprobó" wide>
                      <p className="whitespace-pre-line">{sheet.effectivenessNotes}</p>
                    </DetailRow>
                  </tbody>
                </DetailTable>
                {canWrite && !isClosed && (
                  <div className="mt-3">
                    <Button variant="secondary" size="sm" onClick={() => setVerifying(true)}>
                      <Pencil className="h-[15px] w-[15px]" />
                      Corregir verificación
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="max-w-[76ch] text-[13px] leading-relaxed text-brand-gray">
                  Todavía no consta que la acción funcionara. Sin esta comprobación la HCA no se
                  puede cerrar.
                </p>
                {canWrite && !isClosed && (
                  <Button variant="secondary" size="sm" onClick={() => setVerifying(true)}>
                    <ShieldCheck className="h-[15px] w-[15px]" />
                    Registrar verificación
                  </Button>
                )}
              </div>
            )}
          </section>

          {isClosed && (
            <section>
              <h2 className="mb-3 font-heading text-[17px] font-bold leading-tight tracking-[-0.01em] text-ink">
                Cierre
              </h2>
              <DetailTable>
                <tbody>
                  <DetailRow label="Cerrada el">{formatInstant(sheet.closedAt)}</DetailRow>
                  <DetailRow label="Cerrada por">{sheet.closedByName ?? "—"}</DetailRow>
                  <DetailRow label="Nota de cierre" wide>
                    {sheet.closingNote ?? <span className="text-faint">Sin nota</span>}
                  </DetailRow>
                </tbody>
              </DetailTable>
            </section>
          )}
        </div>
      )}

      </div>

      {editing && (
        <HcaModal
          sheet={sheet}
          productLines={productLines}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void reload();
          }}
        />
      )}

      {itemModal !== null && (
        <ActionPlanItemModal
          sheetId={sheet.id}
          sheetNumber={sheet.number}
          item={itemModal === "nueva" ? undefined : itemModal}
          onClose={() => setItemModal(null)}
          onSaved={() => {
            setItemModal(null);
            void reloadAfterPlanChange();
          }}
        />
      )}

      {cancelling && (
        <CancelPlanItemModal
          item={cancelling}
          onClose={() => setCancelling(null)}
          onSaved={() => {
            setCancelling(null);
            void reloadAfterPlanChange();
          }}
        />
      )}

      {verifying && (
        <EffectivenessModal
          sheet={sheet}
          onClose={() => setVerifying(false)}
          onSaved={() => {
            setVerifying(false);
            void reload();
          }}
        />
      )}

      {closing && (
        <CloseSheetModal
          sheet={sheet}
          conditions={conditions}
          onClose={() => setClosing(false)}
          onSaved={() => {
            setClosing(false);
            void reload();
          }}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}

/** Fila de la ficha: etiqueta a la izquierda, valor a la derecha, sin tarjeta. */
/**
 * Lo que el plan debe, antes de lo que contiene: la pestana abria con una
 * tabla muda mientras Datos y Cierre si decian que faltaba.
 */
function planDebt(counts: PlanItemCounts, overdue: number | null): string {
  // Lo pendiente lo cuenta el servidor sobre el plan entero: pendientes y en
  // curso son las dos formas de «sin resolver».
  const pending = counts.pending + counts.inProgress;

  if (pending === 0) {
    return "Todas las acciones del plan están resueltas.";
  }

  const head =
    pending === 1 ? "Queda 1 acción sin resolver" : `Quedan ${pending} acciones sin resolver`;
  // Lo vencido se sabe comparando fechas, y eso solo alcanza a lo que esta
  // cargado. Con el plan repartido en paginas se calla: dar la cifra de una
  // pagina como si fuera la del plan entero es peor que no darla.
  const tail =
    overdue === null || overdue === 0 ? "" : overdue === 1 ? " · 1 vencida" : ` · ${overdue} vencidas`;
  return `${head}${tail}. La HCA no se cierra hasta que se cumplan o se anulen con justificación.`;
}
