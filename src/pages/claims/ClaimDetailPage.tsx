import { AlertTriangle, Check, ClipboardList, FileText, Pencil, RotateCcw, ShieldCheck, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { claimsApi } from "../../api/claims";
import { ApiError } from "../../api/client";
import { fetchAllPages } from "../../api/paging";
import { productLinesApi } from "../../api/productLines";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { DetailGroup, DetailRow, DetailTable } from "../../components/ui/DetailTable";
import { Spinner } from "../../components/ui/Spinner";
import { Tooltip } from "../../components/ui/Tooltip";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { usePermissions } from "../../hooks/usePermissions";
import { describeStatus, formatPrice, formatQuantity, yesNo } from "../../lib/claims";
import { formatAmount, formatDay, formatInstant } from "../../lib/quality";
import type { ClaimClosureCondition, ClaimDetail, CustomerClaim } from "../../types/claims";
import type { ProductLine } from "../../types/settings";
import { HcaModal } from "../quality/HcaModal";
import { ClaimFormModal } from "./ClaimFormModal";
import { ClaimStatusBadge } from "./ClaimStatusBadge";
import { ClaimTreatmentModal } from "./ClaimTreatmentModal";
import { ReopenClaimModal } from "./ReopenClaimModal";

/**
 * RF-R4 a RF-R7: la ficha de una reclamación con sus cuatro secciones. La
 * sección IV se distingue como zona de Calidad; quien no tiene `claims.treat`
 * la ve en modo lectura.
 */
export function ClaimDetailPage() {
  const { id } = useParams();
  const claimId = Number(id);
  const { can } = usePermissions();

  const [detail, setDetail] = useState<ClaimDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const [editing, setEditing] = useState(false);
  const [treating, setTreating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [openingHca, setOpeningHca] = useState<ProductLine[] | "cargando" | null>(null);

  useDynamicBreadcrumb(detail?.claim.ticketNumber ?? null);

  const [lastClaimId, setLastClaimId] = useState(claimId);
  if (claimId !== lastClaimId) {
    setLastClaimId(claimId);
    setDetail(null);
    setError(null);
    setActionError(null);
  }

  useEffect(() => {
    let cancelled = false;
    claimsApi
      .get(claimId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 404
            ? "La reclamación no existe o no tienes acceso."
            : "No se pudo cargar la reclamación. Vuelve a intentarlo.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [claimId, attempt]);

  async function reload() {
    setIsRefetching(true);
    try {
      setDetail(await claimsApi.get(claimId));
      setActionError(null);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? `${err.message} Vuelve a intentarlo.`
          : "Se guardó el cambio, pero no se pudo releer la reclamación. Vuelve a intentarlo.",
      );
    } finally {
      setIsRefetching(false);
    }
  }

  /** RF-R7: la HCA se abre desde la reclamación heredando cliente y ticket. */
  async function startHca() {
    setOpeningHca("cargando");
    try {
      const lines = await fetchAllPages<ProductLine>((page, pageSize) => productLinesApi.list({ page, pageSize }));
      setOpeningHca(lines);
    } catch {
      setOpeningHca(null);
      setActionError("No se pudieron cargar las líneas de producto para abrir la HCA.");
    }
  }

  if (error) {
    return (
      <div className="max-w-[880px]">
        <ModuleHeader title="Reclamación" />
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

  if (detail === null) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const { claim, closureConditions, canClose } = detail;
  const scope = claim.departmentId ?? undefined;
  const canWrite = can("claims.write", scope);
  const canTreat = can("claims.treat", scope);
  const canOpenHca = can("quality.write");
  const isClosed = claim.status === "Cerrada";

  const missing = closureConditions.find((condition) => !condition.met);

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => window.open(`/reclamaciones/${claim.id}/imprimir`, "_blank")}
      >
        <FileText className="h-[15px] w-[15px]" />
        Imprimir
      </Button>
      {canWrite && !isClosed && (
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          <Pencil className="h-[15px] w-[15px]" />
          Editar
        </Button>
      )}
      {canTreat && !isClosed && (
        <Button size="sm" variant="secondary" onClick={() => setTreating(true)}>
          <Stethoscope className="h-[15px] w-[15px]" />
          Tratamiento
        </Button>
      )}
      {canTreat && isClosed && (
        <Button size="sm" variant="secondary" onClick={() => setReopening(true)}>
          <RotateCcw className="h-[15px] w-[15px]" />
          Reabrir
        </Button>
      )}
      {canTreat && !isClosed && (
        <Tooltip
          content={
            canClose
              ? "Todo listo para cerrar"
              : claim.status === "Registrada"
                ? "Registra primero el tratamiento de la sección IV"
                : missing
                  ? `Falta: ${missing.missing}`
                  : "Faltan condiciones de cierre"
          }
        >
          <Button
            size="sm"
            disabled={!canClose}
            className={canClose ? "" : "pointer-events-none"}
            onClick={() => setClosing(true)}
          >
            <ShieldCheck className="h-[15px] w-[15px]" />
            Cerrar reclamación
          </Button>
        </Tooltip>
      )}
    </div>
  );

  return (
    <div className="max-w-[880px]">
      <ModuleHeader
        title={`Reclamación · ${claim.ticketNumber}`}
        summary={`${claim.clientName} · ${describeStatus(claim.status)}`}
        action={actions}
      />

      {actionError && (
        <div className="mb-3">
          <Alert variant="error">{actionError}</Alert>
        </div>
      )}

      <div className={`transition-opacity ${isRefetching ? "opacity-60" : ""}`}>
        <DetailTable>
          <DetailGroup title="La reclamación" hint="PF-FOR-034 · Revisión 03">
            <DetailRow label="Código">
              <Link to={`/tickets/${claim.ticketId}`} className="font-mono text-[12.5px] text-ink hover:text-brand-red">
                {claim.ticketNumber}
              </Link>
              <span className="ml-2 text-[12.5px] text-faint">{claim.ticketSubject}</span>
            </DetailRow>
            <DetailRow label="Estado">
              <span className="flex flex-wrap items-center gap-2">
                <ClaimStatusBadge status={claim.status} />
                {claim.closedAt && (
                  <span className="text-[12px] text-faint">
                    Cerrada el {formatInstant(claim.closedAt)} por {claim.closedByName ?? "—"}
                    {claim.responseDays !== null && ` · ${claim.responseDays} días de respuesta`}
                  </span>
                )}
              </span>
            </DetailRow>
            <DetailRow label="Fecha de la reclamación">{formatDay(claim.claimDate)}</DetailRow>
            <DetailRow label="Departamento">{claim.departmentName ?? "—"}</DetailRow>
          </DetailGroup>

          <DetailGroup title="I. Información general" hint="Del cliente del ticket; no se duplica.">
            <DetailRow label="Empresa">
              {claim.clientName}
              {claim.clientCode && <span className="ml-2 font-mono text-[11.5px] text-faint">{claim.clientCode}</span>}
            </DetailRow>
            <DetailRow label="Contacto">{claim.contactName ?? <span className="text-faint">Sin contacto en el ticket</span>}</DetailRow>
            <DetailRow label="Teléfonos">
              {[claim.contactPhone, claim.clientPhone].filter(Boolean).join(" · ") || <span className="text-faint">—</span>}
            </DetailRow>
            <DetailRow label="País">{claim.country ?? <span className="text-faint">—</span>}</DetailRow>
          </DetailGroup>

          <DetailGroup title="II. Sobre la reclamación">
            <DetailRow label="Motivo del reclamo">
              {claim.reason}
              {claim.reason === "Otros" && claim.reasonOther && <span className="ml-1.5 text-faint">· {claim.reasonOther}</span>}
            </DetailRow>
            <DetailRow label="Planta involucrada">{claim.plants.map((plant) => plant.name).join(", ")}</DetailRow>
            <DetailRow label="Área afectada">{claim.affectedAreas.join(", ")}</DetailRow>
            <DetailRow label="Fecha de producción (# lote)">{claim.productionLot ?? <span className="text-faint">—</span>}</DetailRow>
            <DetailRow label="Factura">{claim.invoiceRef ?? <span className="text-faint">—</span>}</DetailRow>
            <DetailRow label="Número de PO">{claim.poNumber ?? <span className="text-faint">—</span>}</DetailRow>
            <DetailRow label="Defecto identificado durante">
              {claim.defectFoundDuring ?? <span className="text-faint">Sin indicar</span>}
            </DetailRow>
            <DetailRow label="Unidades a retornar">{formatQuantity(claim.unitsToReturn)}</DetailRow>
            <DetailRow label="Productos reclamados" wide>
              <LinesTable claim={claim} />
            </DetailRow>
            <DetailRow label="Total de la reclamación">
              <strong className="font-heading text-[14px] font-bold tabular-nums text-ink">
                {claim.currency ? formatAmount(claim.totalAmount, claim.currency) : formatQuantity(claim.totalAmount)}
              </strong>
            </DetailRow>
          </DetailGroup>

          <DetailGroup title="III. Descripción de la reclamación">
            <DetailRow label="Descripción" wide>
              <p className="whitespace-pre-line">{claim.description}</p>
            </DetailRow>
            <DetailRow label="Comentarios" wide>
              {claim.comments ? <p className="whitespace-pre-line">{claim.comments}</p> : <span className="text-faint">Ninguno</span>}
            </DetailRow>
            <DetailRow label="Recibida por">
              {claim.receivedByName} · {formatDay(claim.receivedAt)}
            </DetailRow>
            <DetailRow label="Primer contacto con el cliente">
              {claim.firstCustomerContactAt ? formatDay(claim.firstCustomerContactAt) : <span className="text-faint">Sin registrar</span>}
            </DetailRow>
          </DetailGroup>

          <DetailGroup
            title="IV. Tratamiento de la reclamación"
            hint={canTreat ? "Para uso exclusivo del Depto. de Calidad." : "Para uso exclusivo del Depto. de Calidad. Solo lectura para tu rol."}
          >
            <DetailRow label="Primera respuesta como corrección" wide>
              {claim.firstResponseCorrection ? (
                <p className="whitespace-pre-line">{claim.firstResponseCorrection}</p>
              ) : (
                <span className="text-faint">Sin escribir: es obligatoria para cerrar.</span>
              )}
            </DetailRow>
            <DetailRow label="Se requiere acción correctiva">
              <span className="flex flex-wrap items-center gap-2">
                {yesNo(claim.requiresCorrectiveAction)}
                {claim.hcaNumber ? (
                  <Link
                    to={`/calidad/hca/${claim.hcaId}`}
                    className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ink hover:text-brand-red"
                  >
                    <ClipboardList aria-hidden className="h-3.5 w-3.5 text-faint" />
                    {claim.hcaNumber}
                  </Link>
                ) : claim.requiresCorrectiveAction === true && canOpenHca && !isClosed ? (
                  <Button size="sm" variant="secondary" onClick={startHca} isLoading={openingHca === "cargando"}>
                    <ClipboardList className="h-[14px] w-[14px]" />
                    Abrir HCA
                  </Button>
                ) : claim.requiresCorrectiveAction === true ? (
                  <span className="text-[12px] text-warn">Falta la HCA ligada al ticket.</span>
                ) : null}
              </span>
            </DetailRow>
            <DetailRow label="Análisis de causa raíz" wide>
              {claim.rootCauseAnalysis ? <p className="whitespace-pre-line">{claim.rootCauseAnalysis}</p> : <span className="text-faint">—</span>}
            </DetailRow>
            <DetailRow label="Acciones correctivas y/o preventivas" wide>
              {claim.correctiveActions ? <p className="whitespace-pre-line">{claim.correctiveActions}</p> : <span className="text-faint">—</span>}
            </DetailRow>
            <DetailRow label="¿Cliente satisfecho?">{yesNo(claim.customerSatisfied)}</DetailRow>
            <DetailRow label="Observaciones" wide>
              {claim.observations ? <p className="whitespace-pre-line">{claim.observations}</p> : <span className="text-faint">—</span>}
            </DetailRow>
            {!isClosed && (
              <DetailRow label="Para cerrar" wide>
                <ClosureList conditions={closureConditions} />
              </DetailRow>
            )}
          </DetailGroup>
        </DetailTable>
      </div>

      {editing && (
        <ClaimFormModal
          ticketId={claim.ticketId}
          ticketNumber={claim.ticketNumber}
          clientName={claim.clientName}
          claim={claim}
          onClose={() => setEditing(false)}
          onSaved={(saved) => setDetail(saved)}
        />
      )}

      {treating && (
        <ClaimTreatmentModal claim={claim} onClose={() => setTreating(false)} onSaved={(saved) => setDetail(saved)} />
      )}

      {reopening && (
        <ReopenClaimModal claim={claim} onClose={() => setReopening(false)} onSaved={(saved) => setDetail(saved)} />
      )}

      {closing && (
        <ConfirmDialog
          tone="warn"
          icon={ShieldCheck}
          title={`Cerrar la reclamación de ${claim.ticketNumber}`}
          description={
            <>
              Se sella el cierre con tu nombre y la fecha de hoy. Una reclamación cerrada no se edita; para corregirla
              se reabre con un motivo.
              <div className="mt-3">
                <ClosureList conditions={closureConditions} />
              </div>
            </>
          }
          confirmLabel="Cerrar reclamación"
          onConfirm={async () => {
            setDetail(await claimsApi.close(claim.id, null));
          }}
          onClose={() => setClosing(false)}
        />
      )}

      {openingHca !== null && openingHca !== "cargando" && (
        <HcaModal
          productLines={openingHca}
          defaults={{ clientId: claim.clientId, ticketId: claim.ticketId, description: claim.description }}
          onClose={() => setOpeningHca(null)}
          onSaved={() => {
            setOpeningHca(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function LinesTable({ claim }: { claim: CustomerClaim }) {
  return (
    <div className="overflow-x-auto rounded-edge border border-line">
      <DataTable>
        <thead>
          <HeadRow>
            <Th>Producto</Th>
            <Th className="text-right">Compradas</Th>
            <Th className="text-right">Defectuosas</Th>
            <Th className="text-right">Facturados</Th>
            <Th className="text-right">Recibidos</Th>
            <Th className="text-right">Dif.</Th>
            <Th className="text-right">Precio</Th>
            <Th className="text-right">Total</Th>
          </HeadRow>
        </thead>
        <tbody>
          {claim.lines.map((line) => (
            <Row key={line.id}>
              <Td>
                <span className="block text-[12.5px] text-ink">{line.productName}</span>
                <span className="font-mono text-[11px] text-faint">{line.productCode}</span>
              </Td>
              <Td className="text-right tabular-nums">{formatQuantity(line.unitsPurchased)}</Td>
              <Td className="text-right tabular-nums">{formatQuantity(line.defectiveQuantity)}</Td>
              <Td className="text-right tabular-nums">{formatQuantity(line.invoicedQuantity)}</Td>
              <Td className="text-right tabular-nums">{formatQuantity(line.receivedQuantity)}</Td>
              <Td className={`text-right tabular-nums ${line.difference < 0 ? "text-warn" : ""}`}>
                {formatQuantity(line.difference)}
              </Td>
              <Td className="text-right tabular-nums">{formatPrice(line.unitPrice)}</Td>
              <Td className="text-right font-medium tabular-nums text-ink">
                {claim.currency ? formatAmount(line.lineTotal, claim.currency) : formatQuantity(line.lineTotal)}
              </Td>
            </Row>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

/** Lo que falta para cerrar, tal como lo resuelve el servidor. */
function ClosureList({ conditions }: { conditions: ClaimClosureCondition[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {conditions.map((condition) => (
        <li
          key={condition.id}
          className={`flex items-start gap-2 text-[13px] leading-relaxed ${condition.met ? "text-brand-gray" : "text-warn"}`}
        >
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
