import { FileText, Pencil, RotateCcw, ShieldCheck, Stethoscope } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { claimsApi } from "../../api/claims";
import { ApiError } from "../../api/client";
import { fetchAllPages } from "../../api/paging";
import { productLinesApi } from "../../api/productLines";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { PageSpinner } from "../../components/ui/PageSpinner";
import { Tooltip } from "../../components/ui/Tooltip";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { useDetail } from "../../hooks/useDetail";
import { usePermissions } from "../../hooks/usePermissions";
import { describeStatus } from "../../lib/claims";
import type { ProductLine } from "../../types/settings";
import { HcaModal } from "../quality/HcaModal";
import { ClaimExecutiveSummary } from "./ClaimExecutiveSummary";
import { ClaimDocumentSheet } from "../../components/claims/ClaimDocumentSheet";
import { ClaimFormModal } from "./ClaimFormModal";
import { ClaimTreatmentModal } from "./ClaimTreatmentModal";
import { ReopenClaimModal } from "./ReopenClaimModal";

/** RF-R4 a RF-R7: la ficha ejecutiva de una reclamación. Estilo visual unificado idéntico ... */
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
  const [viewingDocument, setViewingDocument] = useState(false);

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
      <div className="max-w-[920px]">
        <ModuleHeader title="Reclamación" />
        <ErrorRetry onRetry={retry}>{error}</ErrorRetry>
      </div>
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
        onClick={() => setViewingDocument(true)}
        title="Ver y exportar documento oficial (PF-FOR-034)"
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
      {canTreat && !isClosed && (
        <Button size="sm" variant="secondary" onClick={() => setTreating(true)}>
          <Stethoscope className="h-[15px] w-[15px] mr-1" />
          Tratamiento
        </Button>
      )}
      {canTreat && isClosed && (
        <Button size="sm" variant="secondary" onClick={() => setReopening(true)}>
          <RotateCcw className="h-[15px] w-[15px] mr-1" />
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
            <ShieldCheck className="h-[15px] w-[15px] mr-1" />
            Cerrar reclamación
          </Button>
        </Tooltip>
      )}
    </div>
  );

  if (viewingDocument) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-receipt-in">
        <ClaimDocumentSheet
          claim={claim}
          onBack={() => setViewingDocument(false)}
          backLabel="Volver al resumen"
        />
      </div>
    );
  }

  return (
    <div className="max-w-[920px] pb-10 animate-plf-apple-tab">
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
        <ClaimExecutiveSummary
          claim={claim}
          closureConditions={closureConditions}
          canOpenHca={canOpenHca}
          onStartHca={startHca}
          isOpeningHca={openingHca === "cargando"}
        />
      </div>

      {editing && (
        <ClaimFormModal
          ticketId={claim.ticketId}
          ticketNumber={claim.ticketNumber}
          clientName={claim.clientName}
          contactName={claim.contactName}
          contactPhone={claim.contactPhone}
          claim={claim}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void reload();
          }}
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
          title={`Cerrar reclamación ${claim.ticketNumber}`}
          description="Se sella el cierre con tu nombre y la fecha de hoy. Una reclamación cerrada no se edita; para corregirla se reabre con un motivo."
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
