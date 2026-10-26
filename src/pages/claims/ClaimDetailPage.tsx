import { ClipboardList, FileText, Pencil, RotateCcw, ShieldCheck, Stethoscope } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { claimsApi } from "../../api/claims";
import { ApiError } from "../../api/client";
import { fetchAllPages } from "../../api/paging";
import { productLinesApi } from "../../api/productLines";
import { ConditionChecklist } from "../../components/app/ConditionChecklist";
import { DetailLoadError } from "../../components/app/DetailLoadError";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { ProductNameCode } from "../../components/app/ProductNameCode";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { DetailGroup, DetailRow, DetailTable } from "../../components/ui/DetailTable";
import { PageSpinner } from "../../components/ui/PageSpinner";
import { Tooltip } from "../../components/ui/Tooltip";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { useDetail } from "../../hooks/useDetail";
import { usePermissions } from "../../hooks/usePermissions";
import { describeStatus, yesNo } from "../../lib/claims";
import { formatDay, formatInstant } from "../../lib/dates";
import { formatAmount, formatPrice, formatQuantity } from "../../lib/numbers";
import type { CustomerClaim } from "../../types/claims";
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

  const { data: detail, setData: setDetail, error, reload: retry } = useDetail(claimId, claimsApi.get, {
    notFound: "La reclamación no existe o no tienes acceso.",
    failed: "No se pudo cargar la reclamación. Vuelve a intentarlo.",
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);

  const [editing, setEditing] = useState(false);
  const [treating, setTreating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [openingHca, setOpeningHca] = useState<ProductLine[] | "cargando" | null>(null);

  useDynamicBreadcrumb(detail?.claim.ticketNumber ?? null);

  const [lastClaimId, setLastClaimId] = useState(claimId);
  if (claimId !== lastClaimId) {
    setLastClaimId(claimId);
    setActionError(null);
  }

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
      <DetailLoadError className="max-w-[880px]" title="Reclamación" onRetry={retry}>
        {error}
      </DetailLoadError>
    );
  }

  if (detail === null) return <PageSpinner />;

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
                <ConditionChecklist conditions={closureConditions} />
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
                <ConditionChecklist conditions={closureConditions} />
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
    <DataTable className="overflow-x-auto">
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
              <ProductNameCode name={line.productName} code={line.productCode} />
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
  );
}
