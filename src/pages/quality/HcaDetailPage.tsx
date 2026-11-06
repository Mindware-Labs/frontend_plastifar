import { useNavigate, useParams } from "react-router-dom";
import { qualityApi } from "../../api/quality";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { HcaDocumentSheet } from "../../components/quality/HcaDocumentSheet";
import { PrintSheetSkeleton } from "../../components/print/PrintSheet";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { useDetail } from "../../hooks/useDetail";

/**
 * Ficha oficial de una Hoja de Acción Correctiva (HCA, PF-FOR-109).
 * Presenta el documento oficial integrado directamente en pantalla completa.
 */
export function HcaDetailPage() {
  const { id } = useParams();
  const sheetId = Number(id);
  const navigate = useNavigate();

  const { data: detail, error, reload: retry } = useDetail(sheetId, qualityApi.sheets.get, {
    resource: "hca-sheets",
    notFound: "La HCA no existe o no tienes acceso.",
    failed: "No se pudo cargar la HCA. Vuelve a intentarlo.",
  });

  useDynamicBreadcrumb(detail?.sheet.number ?? null);

  if (error) {
    return (
      <div className="max-w-[920px]">
        <ModuleHeader title="Acción Correctiva (HCA)" backTo="/calidad/hca" backLabel="Volver a las HCA" />
        <ErrorRetry onRetry={retry}>{error}</ErrorRetry>
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="-mx-3 -mb-3 lg:-mx-4 lg:-mb-3.5 flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-fade print:block print:h-auto print:min-h-0 print:overflow-visible">
        <PrintSheetSkeleton orientation="portrait" backLabel="Volver a las HCA" />
      </div>
    );
  }

  const { sheet, planItems } = detail;

  return (
    <div className="-mx-3 -mb-3 lg:-mx-4 lg:-mb-3.5 flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-receipt-in print:block print:h-auto print:min-h-0 print:overflow-visible print:animate-none">
      <HcaDocumentSheet
        sheet={sheet}
        planItems={planItems}
        onBack={() => navigate("/calidad/hca")}
        backLabel="Volver a las HCA"
      />
    </div>
  );
}
