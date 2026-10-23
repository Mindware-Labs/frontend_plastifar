import { AlertTriangle, Check, CreditCard, Pencil, Printer, RotateCcw, ShieldAlert, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { discrepanciesApi } from "../../api/discrepancies";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { DetailGroup, DetailRow, DetailTable } from "../../components/ui/DetailTable";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { PageSpinner } from "../../components/ui/PageSpinner";
import { SegmentedFilter } from "../../components/ui/SegmentedFilter";
import { Tooltip } from "../../components/ui/Tooltip";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { useDetail } from "../../hooks/useDetail";
import { usePermissions } from "../../hooks/usePermissions";
import { formatInstant } from "../../lib/dates";
import { NOTIFICATION_ITEM, describeStatus } from "../../lib/discrepancies";
import { formatQuantity } from "../../lib/numbers";
import type {
  DiscrepancyCompletionCondition,
  DiscrepancyLine,
  SecurityCheckResult,
} from "../../types/discrepancies";
import { CreditRequestModal } from "../quality/CreditRequestModal";
import { DiscrepancyDecisionModal } from "./DiscrepancyDecisionModal";
import { DiscrepancyFormModal } from "./DiscrepancyFormModal";
import { DiscrepancyStatusBadge, SecurityFindingBadge } from "./DiscrepancyStatusBadge";

type CheckChoice = "" | SecurityCheckResult;

/**
 * Detalle de la investigación: líneas, nota, puntos de seguridad y la ficha
 * de realización y aprobación. Un hallazgo de seguridad se muestra destacado
 * en la cabecera (sección 11 y 15).
 */
export function DiscrepancyDetailPage() {
  const { id } = useParams();
  const discrepancyId = Number(id);
  const { can } = usePermissions();

  const { data: detail, setData: setDetail, error, reload: retry } = useDetail(discrepancyId, discrepanciesApi.get, {
    notFound: "La investigación no existe o no tienes acceso.",
    failed: "No se pudo cargar la investigación. Vuelve a intentarlo.",
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);

  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [deciding, setDeciding] = useState<"aprobar" | "devolver" | null>(null);
  const [creditLine, setCreditLine] = useState<DiscrepancyLine | null>(null);

  /** Respuestas en edición; se guardan de una vez con «Guardar puntos». */
  const [draftChecks, setDraftChecks] = useState<Record<number, CheckChoice> | null>(null);
  const [savingChecks, setSavingChecks] = useState(false);

  useDynamicBreadcrumb(detail?.discrepancy.number ?? null);

  const [lastId, setLastId] = useState(discrepancyId);
  if (discrepancyId !== lastId) {
    setLastId(discrepancyId);
    setActionError(null);
    setDraftChecks(null);
  }

  async function reload() {
    setIsRefetching(true);
    try {
      setDetail(await discrepanciesApi.get(discrepancyId));
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? `${err.message} Vuelve a intentarlo.` : "Se guardó el cambio, pero no se pudo releer. Vuelve a intentarlo.");
    } finally {
      setIsRefetching(false);
    }
  }

  if (error) {
    return (
      <div className="max-w-[960px]">
        <ModuleHeader title="Investigación de discrepancia" />
        <ErrorRetry onRetry={retry}>{error}</ErrorRetry>
      </div>
    );
  }

  if (detail === null) return <PageSpinner />;

  const { discrepancy, completionConditions, canComplete } = detail;
  const scope = discrepancy.departmentId ?? undefined;
  const canWrite = can("discrepancies.write", scope);
  const canApprove = can("discrepancies.approve", scope);
  const canCredit = can("quality.write");
  const investigating = discrepancy.status === "En investigación";
  const isApproved = discrepancy.status === "Aprobada";

  const checks = draftChecks ?? Object.fromEntries(discrepancy.checks.map((check) => [check.itemNumber, check.result ?? ""]));
  const anyPositive = Object.entries(checks).some(([n, value]) => Number(n) !== NOTIFICATION_ITEM && value === "Positivo");
  const checksDirty = draftChecks !== null;

  function setCheck(itemNumber: number, value: CheckChoice) {
    setDraftChecks({ ...checks, [itemNumber]: value });
  }

  async function saveChecks() {
    if (draftChecks === null) return;
    setSavingChecks(true);
    setActionError(null);
    try {
      const saved = await discrepanciesApi.update(discrepancy.id, {
        note: discrepancy.note,
        lines: null,
        checks: Object.entries(draftChecks).map(([n, value]) => ({ itemNumber: Number(n), result: value === "" ? null : value })),
      });
      setDetail(saved);
      setDraftChecks(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "No se pudieron guardar los puntos de seguridad");
    } finally {
      setSavingChecks(false);
    }
  }

  async function reopen() {
    setActionError(null);
    try {
      setDetail(await discrepanciesApi.reopen(discrepancy.id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "No se pudo reabrir");
    }
  }

  const missing = completionConditions.find((condition) => !condition.met);

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => window.open(`/discrepancias/${discrepancy.id}/imprimir`, "_blank")}>
        <Printer className="h-[15px] w-[15px]" />
        Imprimir
      </Button>
      {canWrite && investigating && (
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          <Pencil className="h-[15px] w-[15px]" />
          Editar líneas
        </Button>
      )}
      {canWrite && discrepancy.status === "Devuelta" && (
        <Button size="sm" variant="secondary" onClick={() => void reopen()}>
          <RotateCcw className="h-[15px] w-[15px]" />
          Reabrir
        </Button>
      )}
      {canApprove && discrepancy.status === "Completada" && (
        <>
          <Button size="sm" variant="secondary" onClick={() => setDeciding("devolver")}>
            <ThumbsDown className="h-[15px] w-[15px]" />
            Devolver
          </Button>
          <Button size="sm" onClick={() => setDeciding("aprobar")}>
            <ThumbsUp className="h-[15px] w-[15px]" />
            Aprobar
          </Button>
        </>
      )}
      {canWrite && investigating && (
        <Tooltip content={canComplete ? "Todo listo" : checksDirty ? "Guarda los puntos de seguridad primero" : missing ? `Falta: ${missing.missing}` : "Faltan condiciones"}>
          <Button size="sm" disabled={!canComplete || checksDirty} className={canComplete && !checksDirty ? "" : "pointer-events-none"} onClick={() => setCompleting(true)}>
            <ShieldCheck className="h-[15px] w-[15px]" />
            Dar por completa
          </Button>
        </Tooltip>
      )}
    </div>
  );

  return (
    <div className="max-w-[960px]">
      <ModuleHeader
        title={`${discrepancy.number} · ${discrepancy.ticketNumber}`}
        summary={`${discrepancy.clientName ?? "Sin cliente"} · ${describeStatus(discrepancy.status)}`}
        action={actions}
      />

      {discrepancy.hasSecurityFinding && (
        <div className="mb-3">
          <Alert variant="error">
            <span className="flex items-start gap-2">
              <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong className="font-semibold">Hallazgo de seguridad.</strong> Algún punto del 1 al 8 es positivo.{" "}
                {discrepancy.securityNotifiedAt
                  ? `El aviso automático a Seguridad y Logística salió el ${formatInstant(discrepancy.securityNotifiedAt)}; no sustituye la notificación formal.`
                  : "No se envió el aviso automático: no hay destinatarios configurados. La notificación formal sigue siendo manual."}
              </span>
            </span>
          </Alert>
        </div>
      )}

      {actionError && (
        <div className="mb-3">
          <Alert variant="error">{actionError}</Alert>
        </div>
      )}

      <div className={`transition-opacity ${isRefetching ? "opacity-60" : ""}`}>
        <DetailTable>
          <DetailGroup title="La investigación" hint="PF-FOR-291 · Revisión 1">
            <DetailRow label="Estado">
              <span className="flex flex-wrap items-center gap-2">
                <DiscrepancyStatusBadge status={discrepancy.status} />
                {discrepancy.hasSecurityFinding && <SecurityFindingBadge />}
              </span>
            </DetailRow>
            <DetailRow label="Ticket">
              <Link to={`/tickets/${discrepancy.ticketId}`} className="font-mono text-[12.5px] text-ink hover:text-brand-red">
                {discrepancy.ticketNumber}
              </Link>
              <span className="ml-2 text-[12.5px] text-faint">{discrepancy.ticketSubject}</span>
            </DetailRow>
            <DetailRow label="Cliente del ticket">{discrepancy.clientName ?? <span className="text-faint">—</span>}</DetailRow>
            <DetailRow label="Departamento">{discrepancy.departmentName ?? <span className="text-faint">—</span>}</DetailRow>
            <DetailRow label="Creada">
              {formatInstant(discrepancy.createdAt)}
              {discrepancy.createdByName && <span className="ml-1.5 text-faint">por {discrepancy.createdByName}</span>}
            </DetailRow>
            <DetailRow label="Nota" wide>
              {discrepancy.note ? <p className="whitespace-pre-line">{discrepancy.note}</p> : <span className="text-faint">Ninguna</span>}
            </DetailRow>
          </DetailGroup>

          <DetailGroup title="Líneas en discrepancia" hint={discrepancy.lines.length === 0 ? "Todavía sin líneas." : undefined}>
            {discrepancy.lines.length > 0 && (
              <DetailRow label="Productos" wide>
                <LinesTable
                  lines={discrepancy.lines}
                  canCredit={canCredit && !isApproved}
                  onCredit={(line) => setCreditLine(line)}
                />
              </DetailRow>
            )}
          </DetailGroup>

          <DetailGroup
            title="Puntos de seguridad a evaluar"
            hint={investigating && canWrite ? "Marca Positivo o Negativo; el 9 solo con un positivo del 1 al 8." : undefined}
          >
            <DetailRow label="Lista" wide>
              <ol className="flex flex-col gap-2">
                {discrepancy.checks.map((check) => {
                  const isNinth = check.itemNumber === NOTIFICATION_ITEM;
                  const disabled = !investigating || !canWrite || (isNinth && !anyPositive);
                  const value = checks[check.itemNumber] ?? "";
                  return (
                    <li key={check.itemNumber} className="flex flex-col gap-1.5 rounded-edge border border-line px-3 py-2 sm:flex-row sm:items-center sm:gap-4">
                      <span className="flex min-w-0 flex-1 gap-2 text-[13px] leading-relaxed">
                        <span className="w-5 shrink-0 tabular-nums text-faint">{check.itemNumber}.</span>
                        <span className={isNinth && !anyPositive ? "text-faint" : ""}>{check.text}</span>
                      </span>
                      {disabled ? (
                        <span className={`shrink-0 text-[12.5px] ${value === "Positivo" && !isNinth ? "font-semibold text-brand-red-dark" : "text-faint"}`}>
                          {value === "" ? (isNinth && !anyPositive ? "No aplica" : "Sin responder") : value}
                        </span>
                      ) : (
                        <SegmentedFilter<CheckChoice>
                          aria-label={`Punto ${check.itemNumber}`}
                          value={value}
                          onChange={(next) => setCheck(check.itemNumber, next)}
                          items={[
                            { key: "", label: "—" },
                            { key: "Positivo", label: "Positivo" },
                            { key: "Negativo", label: "Negativo" },
                          ]}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
              {investigating && canWrite && (
                <div className="mt-3 flex items-center gap-3">
                  <Button size="sm" disabled={!checksDirty} isLoading={savingChecks} onClick={() => void saveChecks()}>
                    Guardar puntos
                  </Button>
                  {checksDirty && (
                    <Button size="sm" variant="ghost" onClick={() => setDraftChecks(null)}>
                      Descartar
                    </Button>
                  )}
                </div>
              )}
            </DetailRow>
          </DetailGroup>

          <DetailGroup title="Realización y aprobación">
            <DetailRow label="Realizado por">
              {discrepancy.performedByName ? (
                <>
                  {discrepancy.performedByName}
                  <span className="ml-1.5 text-faint">· {formatInstant(discrepancy.performedAt)}</span>
                </>
              ) : (
                <span className="text-faint">Pendiente de dar por completa</span>
              )}
            </DetailRow>
            <DetailRow label="Aprobado por">
              {discrepancy.approvedByName ? (
                <>
                  {discrepancy.approvedByName}
                  <span className="ml-1.5 text-faint">
                    · {discrepancy.status === "Devuelta" ? "devolvió" : "aprobó"} el {formatInstant(discrepancy.approvedAt)}
                  </span>
                </>
              ) : (
                <span className="text-faint">Pendiente</span>
              )}
            </DetailRow>
            {discrepancy.approvalNote && (
              <DetailRow label="Nota de aprobación" wide>
                <p className="whitespace-pre-line">{discrepancy.approvalNote}</p>
              </DetailRow>
            )}
            {investigating && (
              <DetailRow label="Para completar" wide>
                <ConditionList conditions={completionConditions} />
              </DetailRow>
            )}
          </DetailGroup>
        </DetailTable>
      </div>

      {editing && (
        <DiscrepancyFormModal discrepancy={discrepancy} onClose={() => setEditing(false)} onSaved={(saved) => setDetail(saved)} />
      )}

      {completing && (
        <ConfirmDialog
          tone="warn"
          icon={ShieldCheck}
          title={`Dar por completa ${discrepancy.number}`}
          description={
            <>
              Se sella «Realizado por» con tu nombre y la fecha de hoy. Después solo queda que quien aprueba la firme o la devuelva.
              {anyPositive && " Hay un punto positivo: se enviará el aviso automático a Seguridad y Logística, que no sustituye la notificación formal."}
              <div className="mt-3">
                <ConditionList conditions={completionConditions} />
              </div>
            </>
          }
          confirmLabel="Dar por completa"
          onConfirm={async () => {
            setDetail(await discrepanciesApi.complete(discrepancy.id));
          }}
          onClose={() => setCompleting(false)}
        />
      )}

      {deciding && (
        <DiscrepancyDecisionModal discrepancy={discrepancy} decision={deciding} onClose={() => setDeciding(null)} onSaved={(saved) => setDetail(saved)} />
      )}

      {creditLine && (
        <CreditRequestModal
          defaults={{
            clientId: creditLine.clientId,
            invoiceRef: creditLine.invoiceRef,
            reason: `Discrepancia de carga ${discrepancy.number}: ${creditLine.productName}, ${
              creditLine.shortageQuantity > 0 ? `faltante de ${formatQuantity(creditLine.shortageQuantity)}` : `sobrante de ${formatQuantity(creditLine.surplusQuantity)}`
            } unidades.`,
          }}
          submit={(data) => discrepanciesApi.createCreditRequest(creditLine.id, data)}
          onClose={() => setCreditLine(null)}
          onSaved={() => {
            setCreditLine(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function LinesTable({ lines, canCredit, onCredit }: { lines: DiscrepancyLine[]; canCredit: boolean; onCredit: (line: DiscrepancyLine) => void }) {
  return (
    <DataTable className="overflow-x-auto">
      <thead>
        <HeadRow>
          <Th>Factura</Th>
          <Th># Reclamo</Th>
          <Th>Cliente</Th>
          <Th>Producto</Th>
          <Th className="text-right">Sobrante</Th>
          <Th className="text-right">Faltante</Th>
          <Th>Nota de crédito</Th>
          <Th>Despachador</Th>
          <Th>Supervisor</Th>
        </HeadRow>
      </thead>
      <tbody>
        {lines.map((line) => (
          <Row key={line.id}>
            <Td className="whitespace-nowrap font-mono text-[12px]">{line.invoiceRef}</Td>
            <Td className="whitespace-nowrap font-mono text-[12px] text-brand-gray">{line.claimRef ?? "—"}</Td>
            <Td className="text-[12.5px] text-brand-gray">
              <span className="block max-w-[160px] truncate" title={line.clientName}>
                {line.clientName}
              </span>
            </Td>
            <Td>
              <span className="block text-[12.5px] text-ink">{line.productName}</span>
              <span className="font-mono text-[11px] text-faint">{line.productCode}</span>
            </Td>
            <Td className="text-right tabular-nums">{line.surplusQuantity > 0 ? formatQuantity(line.surplusQuantity) : "—"}</Td>
            <Td className="text-right tabular-nums">{line.shortageQuantity > 0 ? formatQuantity(line.shortageQuantity) : "—"}</Td>
            <Td className="text-[12.5px]">
              {line.qualifiesForCreditNote === null ? (
                <span className="text-warn">Sin decidir</span>
              ) : line.qualifiesForCreditNote ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-brand-green">Sí</span>
                  {line.creditRequestNumber ? (
                    <Link to="/calidad/creditos" className="font-mono text-[11.5px] text-ink hover:text-brand-red">
                      {line.creditRequestNumber}
                    </Link>
                  ) : canCredit ? (
                    <Button size="sm" variant="ghost" onClick={() => onCredit(line)}>
                      <CreditCard className="h-[14px] w-[14px]" />
                      Solicitar crédito
                    </Button>
                  ) : null}
                  {line.creditNoteNumber && <span className="font-mono text-[11.5px] text-faint">NC {line.creditNoteNumber}</span>}
                </span>
              ) : (
                <span className="text-faint">No</span>
              )}
            </Td>
            <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">{line.dispatcherName}</Td>
            <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">{line.supervisorName ?? "—"}</Td>
          </Row>
        ))}
      </tbody>
    </DataTable>
  );
}

function ConditionList({ conditions }: { conditions: DiscrepancyCompletionCondition[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {conditions.map((condition) => (
        <li key={condition.id} className={`flex items-start gap-2 text-[13px] leading-relaxed ${condition.met ? "text-brand-gray" : "text-warn"}`}>
          {condition.met ? (
            <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-green" />
          ) : (
            <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
          )}
          <span className="flex flex-col gap-0.5">
            <span>
              {condition.label}
              <span className="sr-only">{condition.met ? ": cumplida" : ": falta"}</span>
            </span>
            {!condition.met && <span className="text-[12.5px]">{condition.missing}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
