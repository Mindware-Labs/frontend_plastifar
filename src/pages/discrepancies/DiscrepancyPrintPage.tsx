import { useParams } from "react-router-dom";
import { discrepanciesApi } from "../../api/discrepancies";
import { DiscrepancyDocumentSheet } from "../../components/discrepancies/DiscrepancyDocumentSheet";
import { PrintPending } from "../../components/print/PrintSheet";
import { usePrintRecord } from "../../components/print/usePrintRecord";
import { DISCREPANCY_FORM_CONTROL } from "../../lib/discrepancies";

/** RF-D8: la investigación con la distribución del PF-FOR-291 en horizontal, el control documental... */
export function DiscrepancyPrintPage() {
  const { id } = useParams();
  const discrepancyId = Number(id);
  const { data: discrepancy, error } = usePrintRecord(
    discrepancyId,
    async (key) => (await discrepanciesApi.get(key)).discrepancy,
    {
      documentTitle: (record) => `${DISCREPANCY_FORM_CONTROL.code} · ${record.number}`,
      failed: "No se pudo cargar la investigación.",
    },
  );
  if (discrepancy === null) {
    return <PrintPending error={error} backLabel="Volver a la discrepancia" orientation="landscape" />;
  }

  return <DiscrepancyDocumentSheet discrepancy={discrepancy} backLabel="Volver a la discrepancia" />;
}
