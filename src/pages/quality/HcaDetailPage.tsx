import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleSlash,
  Pencil,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { clientsApi } from "../../api/clients";
import { productLinesApi } from "../../api/productLines";
import { qualityApi, type ClosureCondition } from "../../api/quality";
import { staffApi } from "../../api/staff";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { RowAction } from "../../components/ui/RowAction";
import { Spinner } from "../../components/ui/Spinner";
import { Tooltip } from "../../components/ui/Tooltip";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
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
import type { Client } from "../../types/clients";
import type { ActionPlanItem, CorrectiveActionSheet, QualityStaff } from "../../types/quality";
import type { ProductLine } from "../../types/settings";
import { ActionPlanItemModal } from "./ActionPlanItemModal";
import { CancelPlanItemModal } from "./CancelPlanItemModal";
import { CloseSheetModal } from "./CloseSheetModal";
import { EffectivenessModal } from "./EffectivenessModal";
import { HcaModal } from "./HcaModal";
import { HcaStatusBadge, PlanItemStatusBadge } from "./StatusBadges";
import { TicketLink } from "./TicketLink";

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
  const [items, setItems] = useState<ActionPlanItem[] | null>(null);
  const [conditions, setConditions] = useState<ClosureCondition[]>([]);
  const [closable, setClosable] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [staff, setStaff] = useState<QualityStaff[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Error de una accion sobre la pagina ya cargada: no reemplaza la ficha. */
  const [actionError, setActionError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [itemModal, setItemModal] = useState<"nueva" | ActionPlanItem | null>(null);
  const [cancelling, setCancelling] = useState<ActionPlanItem | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  useDynamicBreadcrumb(sheet?.number ?? null);

  function reload() {
    return qualityApi.sheets.get(sheetId).then((data) => {
      setSheet(data.sheet);
      setItems(data.planItems);
      setConditions(data.closureConditions);
      setClosable(data.canClose);
    });
  }

  useEffect(() => {
    Promise.all([
      reload(),
      clientsApi.list({ page: 1, pageSize: 100 }).then((data) => setClients(data.items)),
      productLinesApi.list().then((data) => setProductLines(data.items)),
      staffApi
        .list({ page: 1, pageSize: 100, status: "activos" })
        .then((data) => setStaff(data.items.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` })))),
    ]).catch(() => setError("No se pudo cargar la hoja de corrección"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId]);

  function staffName(staffId: number | null) {
    if (staffId === null) return "—";
    return staff.find((person) => person.id === staffId)?.name ?? "—";
  }

  const sections = [
    { label: "Datos", to: `/calidad/hca/${id}` },
    { label: "Plan de acción", to: `/calidad/hca/${id}/plan` },
    { label: "Cierre", to: `/calidad/hca/${id}/cierre` },
  ];

  if (error) {
    return (
      <div>
        <ModuleHeader sections={sections} />
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }

  if (sheet === null || items === null) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

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
        await reload();
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
    return (
      <Tooltip
        content={
          closable ? "Todo listo para cerrar" : "Faltan condiciones para cerrar; están abajo"
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

      {section === "datos" && (
        <>
          <DataTable>
            <tbody>
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
              <DetailRow label="Cliente">
                {clients.find((client) => client.id === sheet.clientId)?.name ?? "—"}
              </DetailRow>
              <DetailRow label="Línea de producto">
                {productLines.find((line) => line.id === sheet.productLineId)?.name ?? "—"}
              </DetailRow>
              <DetailRow label="Ticket de origen">
                <TicketLink number={sheet.ticketNumber} />
              </DetailRow>
              <DetailRow label="Detectada el">{formatDay(sheet.detectedAt.slice(0, 10))}</DetailRow>
              <DetailRow label="Cierre comprometido">{formatDay(sheet.dueDate)}</DetailRow>
              <DetailRow label="Responsable">{staffName(sheet.responsibleStaffId)}</DetailRow>
              <DetailRow label="Qué ocurrió">
                <p className="max-w-[76ch] whitespace-pre-line">{sheet.description}</p>
              </DetailRow>
              <DetailRow label="Acción inmediata">
                {sheet.immediateAction ? (
                  <p className="max-w-[76ch] whitespace-pre-line">{sheet.immediateAction}</p>
                ) : (
                  <span className="text-faint">Ninguna registrada</span>
                )}
              </DetailRow>
              <DetailRow label="Causa raíz">
                {sheet.rootCause ? (
                  <p className="max-w-[76ch] whitespace-pre-line">{sheet.rootCause}</p>
                ) : (
                  <span className="text-faint">
                    Sin escribir: es obligatoria para pasar a ejecución y para cerrar.
                  </span>
                )}
              </DetailRow>
              {isClosed && (
                <>
                  <DetailRow label="Cerrada el">{formatInstant(sheet.closedAt)}</DetailRow>
                  <DetailRow label="Cerrada por">{staffName(sheet.closedByStaffId)}</DetailRow>
                  <DetailRow label="Nota de cierre">
                    {sheet.closingNote ?? <span className="text-faint">Sin nota</span>}
                  </DetailRow>
                </>
              )}
            </tbody>
          </DataTable>

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

      {section === "plan" && items.length > 0 && (
        <p className="mb-3 text-[12.5px] text-brand-gray">
          {planDebt(items)}
        </p>
      )}

      {section === "plan" &&
        (items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[13.5px] text-faint">
              Esta hoja todavía no tiene plan de acción.
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
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Acción</Th>
                <Th>Responsable</Th>
                <Th>Comprometida</Th>
                <Th>Cumplida</Th>
                <Th>Estado</Th>
                {canWrite && !isClosed && <Th className="w-28 text-right">Acciones</Th>}
              </HeadRow>
            </thead>

            <tbody>
              {items.map((item) => {
                const itemOverdue = isPlanItemOverdue(item);
                const settled = item.status === "Cumplida" || item.status === "Anulada";

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
                      {staffName(item.responsibleStaffId)}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                      {formatDay(item.dueDate)}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                      {item.completedAt ? formatDay(item.completedAt) : <span className="text-faint">—</span>}
                    </Td>
                    <Td>
                      <PlanItemStatusBadge status={item.status} overdue={itemOverdue} />
                    </Td>
                    {canWrite && !isClosed && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Editar la acción de ${staffName(item.responsibleStaffId)}`}
                            icon={Pencil}
                            onClick={() => setItemModal(item)}
                            disabled={settled}
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
        ))}

      {section === "cierre" && (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
              Condiciones de cierre
            </h2>

            <ul className="flex flex-col">
              {conditions.map((condition) => (
                <li
                  key={condition.id}
                  className="flex items-start gap-3 border-b border-line-soft py-3 last:border-b-0"
                >
                  <span
                    aria-hidden
                    className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-edge ${
                      condition.met ? "bg-brand-green/10 text-brand-green" : "bg-warn/10 text-warn"
                    }`}
                  >
                    {condition.met ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                  </span>

                  <span className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium text-ink">
                      {condition.label}
                      <span className="sr-only">{condition.met ? ": cumplida" : ": falta"}</span>
                    </span>
                    {!condition.met && (
                      <span className="max-w-[76ch] text-[12.5px] leading-relaxed text-warn">
                        {condition.missing}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
              Verificación de eficacia
            </h2>

            {sheet.effectivenessCheckAt ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-[12.5px] text-faint">
                  Verificada el {formatDay(sheet.effectivenessCheckAt.slice(0, 10))}
                </p>
                <p className="max-w-[76ch] whitespace-pre-line text-[13px] leading-relaxed text-brand-gray">
                  {sheet.effectivenessNotes}
                </p>
                {canWrite && !isClosed && (
                  <div className="mt-2">
                    <Button variant="secondary" size="sm" onClick={() => setVerifying(true)}>
                      <Pencil className="h-[15px] w-[15px]" />
                      Corregir verificación
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="max-w-[76ch] text-[13px] leading-relaxed text-brand-gray">
                  Todavía no consta que la acción funcionara. Sin esta comprobación la hoja no se
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
              <h2 className="mb-3 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
                Cierre
              </h2>
              <p className="text-[13px] leading-relaxed text-brand-gray">
                Cerrada el {formatInstant(sheet.closedAt)} por {staffName(sheet.closedByStaffId)}.
              </p>
              {sheet.closingNote && (
                <p className="mt-1.5 max-w-[76ch] text-[13px] leading-relaxed text-brand-gray">
                  {sheet.closingNote}
                </p>
              )}
            </section>
          )}
        </div>
      )}

      {editing && (
        <HcaModal
          sheet={sheet}
          clients={clients}
          productLines={productLines}
          staff={staff}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}

      {itemModal !== null && (
        <ActionPlanItemModal
          sheetId={sheet.id}
          sheetNumber={sheet.number}
          item={itemModal === "nueva" ? undefined : itemModal}
          staff={staff}
          onClose={() => setItemModal(null)}
          onSaved={() => {
            setItemModal(null);
            reload();
          }}
        />
      )}

      {cancelling && (
        <CancelPlanItemModal
          item={cancelling}
          onClose={() => setCancelling(null)}
          onSaved={() => {
            setCancelling(null);
            reload();
          }}
        />
      )}

      {verifying && (
        <EffectivenessModal
          sheet={sheet}
          onClose={() => setVerifying(false)}
          onSaved={() => {
            setVerifying(false);
            reload();
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
            reload();
          }}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}

/** Fila de la ficha: etiqueta a la izquierda, valor a la derecha, sin tarjeta. */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Row>
      <Td className="w-[220px] py-3 align-top font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
        {label}
      </Td>
      <Td className="py-3 text-[13px] text-brand-gray">{children}</Td>
    </Row>
  );
}

/**
 * Lo que el plan debe, antes de lo que contiene: la pestana abria con una
 * tabla muda mientras Datos y Cierre si decian que faltaba.
 */
function planDebt(items: ActionPlanItem[]): string {
  const pending = items.filter((item) => !isPlanItemSettled(item));
  const overdue = pending.filter((item) => isPlanItemOverdue(item)).length;

  if (pending.length === 0) {
    return "Todas las acciones del plan están resueltas.";
  }

  const head =
    pending.length === 1 ? "Queda 1 acción sin resolver" : `Quedan ${pending.length} acciones sin resolver`;
  const tail = overdue === 0 ? "" : overdue === 1 ? " · 1 vencida" : ` · ${overdue} vencidas`;
  return `${head}${tail}. La hoja no se cierra hasta que se cumplan o se anulen con justificación.`;
}
