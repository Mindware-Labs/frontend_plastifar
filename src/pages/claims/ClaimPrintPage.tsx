import { useParams } from "react-router-dom";
import { claimsApi } from "../../api/claims";
import { PrintPending } from "../../components/print/PrintSheet";
import { usePrintRecord } from "../../components/print/usePrintRecord";
import { ClaimDocumentSheet } from "../../components/claims/ClaimDocumentSheet";
import { CLAIM_FORM_CONTROL } from "../../lib/claims";

/** RF-R9: la reclamación con la distribución y el control documental del PF-FOR-034 */
export function ClaimPrintPage() {
  const { id } = useParams();
  const claimId = Number(id);
  const { data: claim, error } = usePrintRecord(
    claimId,
    async (key) => (await claimsApi.get(key)).claim,
    {
      documentTitle: (record) => `${CLAIM_FORM_CONTROL.code} · ${record.ticketNumber}`,
      failed: "No se pudo cargar la reclamación.",
    },
  );

  if (claim === null) {
    return <PrintPending error={error} backLabel="Volver a la reclamación" orientation="portrait" />;
  }

  return <ClaimDocumentSheet claim={claim} backLabel="Volver a la reclamación" />;
}
