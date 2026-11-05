import { useParams } from "react-router-dom";
import { qualityApi } from "../../api/quality";
import { PrintPending } from "../../components/print/PrintSheet";
import { usePrintRecord } from "../../components/print/usePrintRecord";
import { HcaDocumentSheet } from "../../components/quality/HcaDocumentSheet";

/**
 * RF-H10: Hoja HCA (Hecho, Causa y Acción) en vista de impresión
 * oficial PF-FOR-109.
 */
export function HcaPrintPage() {
  const { id } = useParams();
  const sheetId = Number(id);
  const { data: detail, error } = usePrintRecord(sheetId, qualityApi.sheets.get, {
    documentTitle: (record) => `PF-FOR-109 · ${record.sheet.number}`,
    failed: "No se pudo cargar la HCA.",
  });

  if (detail === null) {
    return <PrintPending error={error} backLabel="Volver a la HCA" orientation="portrait" />;
  }

  return (
    <HcaDocumentSheet
      sheet={detail.sheet}
      planItems={detail.planItems}
      backLabel="Volver a la HCA"
    />
  );
}
