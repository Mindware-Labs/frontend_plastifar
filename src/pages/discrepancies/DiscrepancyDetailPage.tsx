import { useNavigate, useParams } from "react-router-dom";
import { discrepanciesApi } from "../../api/discrepancies";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { DiscrepancyDocumentSheet } from "../../components/discrepancies/DiscrepancyDocumentSheet";
import { PrintSheetSkeleton } from "../../components/print/PrintSheet";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { useDetail } from "../../hooks/useDetail";

/**
 * Ficha oficial de una Investigación de discrepancia de carga (PF-FOR-291).
 * Presenta el documento oficial integrado directamente en pantalla completa.
 */
export function DiscrepancyDetailPage() {
  const { id } = useParams();
  const discrepancyId = Number(id);
  const navigate = useNavigate();

  const { data: detail, error, reload } = useDetail(discrepancyId, discrepanciesApi.get, {
    resource: "discrepancies",
    notFound: "La investigación no existe o no tienes acceso.",
    failed: "No se pudo cargar la investigación. Vuelve a intentarlo.",
  });

  useDynamicBreadcrumb(detail?.discrepancy.number ?? null);

  if (error) {
    return (
      <div className="max-w-[960px]">
        <ModuleHeader title="Investigación de discrepancia" backTo="/discrepancias" backLabel="Volver a las discrepancias" />
        <ErrorRetry onRetry={reload}>{error}</ErrorRetry>
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="-mx-3 -mb-3 lg:-mx-4 lg:-mb-3.5 flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-fade print:block print:h-auto print:min-h-0 print:overflow-visible">
        <PrintSheetSkeleton orientation="landscape" backLabel="Volver a las discrepancias" />
      </div>
    );
  }

  const { discrepancy } = detail;

  return (
    <div className="-mx-3 -mb-3 lg:-mx-4 lg:-mb-3.5 flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-receipt-in print:block print:h-auto print:min-h-0 print:overflow-visible print:animate-none">
      <DiscrepancyDocumentSheet
        discrepancy={discrepancy}
        onBack={() => navigate("/discrepancias")}
        backLabel="Volver a las discrepancias"
      />
    </div>
  );
}
