import { useNavigate, useParams } from "react-router-dom";
import { claimsApi } from "../../api/claims";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { ClaimDocumentSheet } from "../../components/claims/ClaimDocumentSheet";
import { PrintSheetSkeleton } from "../../components/print/PrintSheet";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { useDetail } from "../../hooks/useDetail";

/**
 * Ficha oficial de una Reclamación de clientes (PF-FOR-034).
 * Presenta el documento oficial integrado directamente en pantalla completa.
 */
export function ClaimDetailPage() {
  const { id } = useParams();
  const claimId = Number(id);
  const navigate = useNavigate();

  const { data: detail, error, reload } = useDetail(claimId, claimsApi.get, {
    notFound: "La reclamación no existe o no tienes acceso.",
    failed: "No se pudo cargar la reclamación. Vuelve a intentarlo.",
  });

  useDynamicBreadcrumb(detail?.claim.ticketNumber ?? null);

  if (error) {
    return (
      <div className="max-w-[920px]">
        <ModuleHeader title="Reclamación" backTo="/reclamaciones" backLabel="Volver a las reclamaciones" />
        <ErrorRetry onRetry={reload}>{error}</ErrorRetry>
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="-mx-3 -mb-3 lg:-mx-4 lg:-mb-3.5 flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-fade print:block print:h-auto print:min-h-0 print:overflow-visible">
        <PrintSheetSkeleton orientation="portrait" backLabel="Volver a las reclamaciones" />
      </div>
    );
  }

  const { claim } = detail;

  return (
    <div className="-mx-3 -mb-3 lg:-mx-4 lg:-mb-3.5 flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-receipt-in print:block print:h-auto print:min-h-0 print:overflow-visible print:animate-none">
      <ClaimDocumentSheet
        claim={claim}
        onBack={() => navigate("/reclamaciones")}
        backLabel="Volver a las reclamaciones"
      />
    </div>
  );
}
