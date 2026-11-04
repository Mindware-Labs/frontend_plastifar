import { useParams } from "react-router-dom";
import { withdrawalsApi } from "../../api/withdrawals";
import { PrintPending } from "../../components/print/PrintSheet";
import { usePrintRecord } from "../../components/print/usePrintRecord";
import { WithdrawalDocumentSheet } from "../../components/withdrawals/WithdrawalDocumentSheet";
import { WITHDRAWAL_FORM_CONTROL } from "../../lib/withdrawals";

export function WithdrawalPrintPage() {
  const { id } = useParams();
  const withdrawalId = Number(id);
  const { data: detail, error } = usePrintRecord(
    withdrawalId,
    (key) => withdrawalsApi.get(key),
    {
      documentTitle: (record) => `${WITHDRAWAL_FORM_CONTROL.code} · ${record.withdrawal.number}`,
      failed: "No se pudo cargar la solicitud de retiro.",
    },
  );

  if (detail === null) return <PrintPending error={error} />;

  return <WithdrawalDocumentSheet withdrawal={detail.withdrawal} backLabel="Volver al retiro" />;
}
