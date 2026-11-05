import { useNavigate, useParams } from "react-router-dom";
import { withdrawalsApi } from "../../api/withdrawals";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { WithdrawalDocumentSheet } from "../../components/withdrawals/WithdrawalDocumentSheet";
import { PrintSheetSkeleton } from "../../components/print/PrintSheet";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { useDetail } from "../../hooks/useDetail";

/**
 * Ficha oficial de una Solicitud de retiro de mercancía (PF-FOR-068).
 * Presenta el documento oficial integrado directamente en pantalla completa.
 */
export function WithdrawalDetailPage() {
  const { id } = useParams();
  const withdrawalId = Number(id);
  const navigate = useNavigate();

  const { data: detail, error, reload } = useDetail(withdrawalId, withdrawalsApi.get, {
    notFound: "La solicitud de retiro no existe o no tienes acceso.",
    failed: "No se pudo cargar la solicitud de retiro. Vuelve a intentarlo.",
  });

  useDynamicBreadcrumb(detail?.withdrawal.number ?? null);

  if (error) {
    return (
      <div className="max-w-[960px]">
        <ModuleHeader title="Solicitud de retiro" backTo="/retiros" backLabel="Volver a los retiros" />
        <ErrorRetry onRetry={reload}>{error}</ErrorRetry>
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="-mx-3 -mb-3 lg:-mx-4 lg:-mb-3.5 flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-fade print:block print:h-auto print:min-h-0 print:overflow-visible">
        <PrintSheetSkeleton orientation="landscape" backLabel="Volver a los retiros" />
      </div>
    );
  }

  const { withdrawal } = detail;

  return (
    <div className="-mx-3 -mb-3 lg:-mx-4 lg:-mb-3.5 flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-receipt-in print:block print:h-auto print:min-h-0 print:overflow-visible print:animate-none">
      <WithdrawalDocumentSheet
        withdrawal={withdrawal}
        onBack={() => navigate("/retiros")}
        backLabel="Volver a los retiros"
      />
    </div>
  );
}
